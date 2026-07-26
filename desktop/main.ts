import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  session,
  Tray,
  type IpcMainEvent,
} from "electron";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  desktopIpcChannels,
  parseCancelTargetNotificationPayload,
  parseScheduleTargetNotificationPayload,
} from "./ipc-contracts.js";
import { TargetNotificationScheduler } from "./notification-scheduler.js";
import { FileNotificationStateStore } from "./notification-state.js";
import { desktopWebPreferences } from "./security.js";
import {
  DesktopWindowLifecycle,
  type TrayActions,
} from "./window-lifecycle.js";

const require = createRequire(import.meta.url);
const isSquirrelStartup = process.platform === "win32" &&
  Boolean(require("electron-squirrel-startup"));
const testRuntime = app.isPackaged
  ? undefined
  : (await import("./test-runtime.js")).readDesktopTestRuntime();
const isSmokeTest = testRuntime?.isSmokeTest ?? false;
const compiledDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(compiledDirectory, "..", "..");
const rendererPath = join(projectRoot, "dist", "desktop-renderer", "index.html");
const rendererUrl = pathToFileURL(rendererPath).href;

if (testRuntime?.userDataPath) {
  app.setPath("userData", testRuntime.userDataPath);
}

app.enableSandbox();
app.setAppUserModelId("com.squirrel.IntentHour.IntentHour");

let mainWindow: BrowserWindow | undefined;
let notificationScheduler: TargetNotificationScheduler | undefined;

function denyRendererPermissions(): void {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
}

function trayIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "assets", "tray-icon.png")
    : join(projectRoot, "desktop", "assets", "tray-icon.png");
}

function appIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "assets", "intenthour.ico")
    : join(projectRoot, "desktop", "assets", "intenthour.ico");
}

function createTray(actions: TrayActions): Tray {
  let image = nativeImage.createFromPath(trayIconPath());
  if (image.isEmpty()) {
    image = nativeImage.createFromPath(
      join(projectRoot, "artifacts", "visual", "home-desktop.png"),
    ).resize({ width: 16, height: 16 });
  } else {
    image = image.resize({ width: 16, height: 16 });
  }

  const tray = new Tray(image);
  tray.setToolTip("IntentHour");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open IntentHour", click: actions.open },
    { label: "Hide Window", click: actions.hide },
    { type: "separator" },
    { label: "Quit IntentHour", click: actions.quit },
  ]));
  tray.on("click", actions.open);
  tray.on("double-click", actions.open);
  return tray;
}

async function verifySmokeBoundary(
  window: BrowserWindow,
  timeout: NodeJS.Timeout,
): Promise<void> {
  try {
    let rendererState: unknown;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      rendererState = await window.webContents.executeJavaScript(`({
        runtimeText: document.querySelector("#runtime")?.textContent ?? "",
        processType: typeof globalThis.process,
        bridgeKeys: Object.keys(globalThis.intentHourDesktop ?? {}).sort()
      })`);
      if (
        typeof rendererState === "object" &&
        rendererState !== null &&
        "runtimeText" in rendererState &&
        typeof rendererState.runtimeText === "string" &&
        rendererState.runtimeText.includes(process.versions.electron)
      ) {
        break;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }

    if (
      typeof rendererState !== "object" ||
      rendererState === null ||
      !("runtimeText" in rendererState) ||
      typeof rendererState.runtimeText !== "string" ||
      !("processType" in rendererState) ||
      rendererState.processType !== "undefined" ||
      !("bridgeKeys" in rendererState) ||
      !Array.isArray(rendererState.bridgeKeys) ||
      !rendererState.runtimeText.includes(process.platform) ||
      !rendererState.runtimeText.includes(process.versions.electron) ||
      rendererState.bridgeKeys.join(",") !== [
        "cancelFocusTargetNotification",
        "onFocusTargetNotificationDelivered",
        "runtime",
        "scheduleFocusTargetNotification",
      ].join(",")
    ) {
      throw new Error("Desktop preload or renderer isolation check failed.");
    }

    clearTimeout(timeout);
    app.quit();
  } catch (error: unknown) {
    clearTimeout(timeout);
    console.error("Desktop smoke boundary verification failed.", error);
    app.exit(1);
  }
}

async function createBrowserWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#070b0d",
    icon: appIconPath(),
    title: "IntentHour Desktop",
    webPreferences: {
      ...desktopWebPreferences,
      preload: join(compiledDirectory, "preload.cjs"),
    },
  });
  mainWindow = window;

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, targetUrl) => {
    if (targetUrl !== rendererUrl) event.preventDefault();
  });
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });

  if (isSmokeTest) {
    const timeout = setTimeout(() => {
      console.error("Desktop smoke test timed out before the renderer loaded.");
      app.exit(1);
    }, 15_000);
    window.webContents.once("did-finish-load", () => {
      void verifySmokeBoundary(window, timeout);
    });
    window.webContents.once(
      "did-fail-load",
      (_event, errorCode, errorDescription) => {
        clearTimeout(timeout);
        console.error(
          `Desktop renderer failed to load (${errorCode}): ${errorDescription}`,
        );
        app.exit(1);
      },
    );
  } else {
    window.once("ready-to-show", () => window.show());
  }

  await window.loadFile(rendererPath);
  return window;
}

const lifecycle = new DesktopWindowLifecycle({
  createWindow: createBrowserWindow,
  createTray,
  quitApp: () => app.quit(),
  onError: (error) => {
    console.error("IntentHour Desktop window lifecycle failed.", error);
  },
});

function isTrustedRendererEvent(event: IpcMainEvent): boolean {
  return mainWindow !== undefined &&
    !mainWindow.isDestroyed() &&
    event.sender === mainWindow.webContents &&
    event.senderFrame?.url === rendererUrl;
}

function registerNotificationIpc(): void {
  ipcMain.on(
    desktopIpcChannels.scheduleTargetNotification,
    (event, value: unknown) => {
      if (!isTrustedRendererEvent(event)) return;
      const payload = parseScheduleTargetNotificationPayload(value);
      if (!payload) return;

      notificationScheduler?.schedule({
        ...payload,
        triggerAtMs: testRuntime?.notificationDelayMs === undefined
          ? payload.triggerAtMs
          : Date.now() + testRuntime.notificationDelayMs,
      });
    },
  );
  ipcMain.on(
    desktopIpcChannels.cancelTargetNotification,
    (event, value: unknown) => {
      if (!isTrustedRendererEvent(event)) return;
      const payload = parseCancelTargetNotificationPayload(value);
      if (!payload) return;
      notificationScheduler?.cancel(payload);
    },
  );
}

function createNotificationScheduler(): TargetNotificationScheduler {
  const state = new FileNotificationStateStore(
    join(app.getPath("userData"), "focus-target-notifications.json"),
  );
  return new TargetNotificationScheduler({
    now: () => Date.now(),
    timer: {
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: (handle) =>
        clearTimeout(handle as ReturnType<typeof setTimeout>),
    },
    state,
    createNotification: (onClick) => {
      if (!Notification.isSupported()) return undefined;
      const notification = new Notification({
        title: "IntentHour",
        body: "Your focus target has been reached.\nOpen IntentHour to review or continue.",
        icon: trayIconPath(),
      });
      notification.on("click", onClick);
      return {
        show: () => notification.show(),
      };
    },
    showWindow: () => {
      void lifecycle.showWindow().catch((error: unknown) => {
        console.error("Could not show IntentHour from its notification.", error);
      });
    },
    onDelivered: (payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          desktopIpcChannels.targetNotificationDelivered,
          payload,
        );
      }
    },
    onError: (error) => {
      console.error("IntentHour target notification failed.", error);
    },
  });
}

const hasSingleInstanceLock = !isSquirrelStartup &&
  app.requestSingleInstanceLock();

if (!isSquirrelStartup) {
  if (!hasSingleInstanceLock) {
    app.quit();
  } else {
    app.on("second-instance", () => lifecycle.handleSecondInstance());
    app.whenReady()
      .then(async () => {
        denyRendererPermissions();
        notificationScheduler = createNotificationScheduler();
        registerNotificationIpc();
        lifecycle.ensureTray();
        await lifecycle.showWindow();

        app.on("activate", () => {
          void lifecycle.showWindow().catch((error: unknown) => {
            console.error("Could not activate IntentHour Desktop.", error);
          });
        });
      })
      .catch((error: unknown) => {
        console.error("IntentHour Desktop failed to start.", error);
        app.exit(1);
      });
  }
}

app.on("before-quit", () => {
  notificationScheduler?.cancelAll();
  lifecycle.beforeQuit();
});

app.on("window-all-closed", () => {
  // Windows keeps the process alive in the notification area until explicit Quit.
});
