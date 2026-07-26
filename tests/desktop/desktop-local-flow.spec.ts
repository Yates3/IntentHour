import { _electron as electron, expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function createProfile(): string {
  return mkdtempSync(join(tmpdir(), "intenthour-desktop-e2e-"));
}

function removeProfile(profile: string): void {
  const resolvedProfile = resolve(profile);
  const expectedRoot = resolve(tmpdir());
  if (
    !resolvedProfile.startsWith(`${expectedRoot}\\intenthour-desktop-e2e-`)
  ) {
    throw new Error(`Refusing to remove unexpected test profile: ${profile}`);
  }
  rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 3 });
}

async function launch(
  profile: string,
  options: { notificationDelayMs?: number } = {},
) {
  return electron.launch({
    args: ["dist/desktop/main.js"],
    env: {
      ...process.env,
      INTENTHOUR_DESKTOP_E2E_PROFILE: profile,
      ...(options.notificationDelayMs === undefined
        ? {}
        : {
          INTENTHOUR_DESKTOP_E2E_NOTIFICATION_DELAY_MS:
            String(options.notificationDelayMs),
        }),
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
    },
  });
}

async function launchSecondInstance(profile: string): Promise<number | null> {
  const executablePath = join(
    process.cwd(),
    "node_modules",
    "electron",
    "dist",
    "electron.exe",
  );
  return new Promise((resolveExit, reject) => {
    const child = spawn(executablePath, ["dist/desktop/main.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        INTENTHOUR_DESKTOP_E2E_PROFILE: profile,
        ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      },
      stdio: "ignore",
      windowsHide: true,
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Second Electron instance did not exit."));
    }, 10_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolveExit(code);
    });
  });
}

test("completes the local focus lifecycle in the real Electron renderer", async () => {
  const profile = createProfile();
  const app = await launch(profile);
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", {
      name: "Protect the work you chose.",
    })).toBeVisible();
    await page.getByTestId("intention-input").fill("Ship the desktop focus loop");
    await page.getByTestId("start-session").click();

    await expect(page.getByTestId("active-intention"))
      .toHaveText("Ship the desktop focus loop");
    await page.getByTestId("open-interruption").click();
    await page.getByRole("button", { name: "New idea" }).click();
    await page.getByLabel("Optional note").fill("Capture after this session");
    await page.getByTestId("save-interruption").click();
    await expect(page.getByTestId("interruption-count")).toHaveText("1");

    await page.getByTestId("toggle-pause").click();
    await expect(page.getByText("SESSION PAUSED")).toBeVisible();
    await expect(page.getByTestId("open-interruption")).toBeDisabled();
    const pausedRemaining = await page.getByTestId("remaining-time").textContent();
    await page.waitForTimeout(1_100);
    await expect(page.getByTestId("remaining-time")).toHaveText(
      pausedRemaining ?? "",
    );
    await page.getByTestId("toggle-pause").click();
    await expect(page.getByText("FOCUS IN PROGRESS")).toBeVisible();

    await page.getByTestId("finish-session").click();
    await page.getByRole("button", { name: "Moved forward" }).click();
    await page.getByLabel("Optional result note")
      .fill("The local loop is working");
    await page.getByTestId("confirm-finish").click();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByTestId("history-list"))
      .toContainText("Ship the desktop focus loop");
    await expect(page.getByTestId("history-list"))
      .toContainText("moved forward");
    await expect(page.getByTestId("history-list")).toContainText("1");
  } finally {
    await app.close();
    removeProfile(profile);
  }
});

test("restores a paused session and its interruptions after a full app restart", async () => {
  const profile = createProfile();
  let app = await launch(profile);
  try {
    let page = await app.firstWindow();
    await page.getByTestId("intention-input")
      .fill("Verify restart recovery");
    await page.getByTestId("start-session").click();
    await page.getByTestId("open-interruption").click();
    await page.getByRole("button", { name: "Message" }).click();
    await page.getByTestId("save-interruption").click();
    await page.getByTestId("toggle-pause").click();
    await expect(page.getByText("SESSION PAUSED")).toBeVisible();
    const remainingBeforeRestart =
      await page.getByTestId("remaining-time").textContent();

    await app.close();
    app = await launch(profile);
    page = await app.firstWindow();

    await expect(page.getByTestId("active-intention"))
      .toHaveText("Verify restart recovery");
    await expect(page.getByText("SESSION PAUSED")).toBeVisible();
    await expect(page.getByTestId("interruption-count")).toHaveText("1");
    await expect(page.getByTestId("remaining-time"))
      .toHaveText(remainingBeforeRestart ?? "");

    const screenshotPath = process.env.INTENTHOUR_DESKTOP_SCREENSHOT;
    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    await page.getByTestId("discard-session").click();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByTestId("history-list"))
      .toContainText("Verify restart recovery");
    await expect(page.getByTestId("history-list")).toContainText("Discarded");
    await expect(page.getByTestId("history-list")).toContainText("50 min");

    await app.close();
    app = await launch(profile);
    page = await app.firstWindow();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByTestId("history-list"))
      .toContainText("Verify restart recovery");
    await expect(page.getByTestId("history-list")).toContainText("Discarded");
  } finally {
    await app.close();
    removeProfile(profile);
  }
});

test("keeps running in the tray and delivers one target reminder without ending the Session", async () => {
  const profile = createProfile();
  let app = await launch(profile, { notificationDelayMs: 1_000 });
  try {
    let page = await app.firstWindow();
    await page.getByTestId("intention-input")
      .fill("Verify tray notification lifecycle");
    await page.getByTestId("start-session").click();
    await page.getByTestId("toggle-pause").click();
    await expect(page.getByText("SESSION PAUSED")).toBeVisible();
    await page.waitForTimeout(1_200);
    await expect(page.getByTestId("target-reminder-status"))
      .toHaveText("Saved on this device");

    await page.getByTestId("toggle-pause").click();
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close();
    });
    await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isVisible() ?? false
    )).toBe(false);

    await expect(page.getByTestId("target-reminder-status"))
      .toHaveText("Target reminder sent - session stays open", {
        timeout: 5_000,
      });
    await expect(page.getByTestId("active-intention"))
      .toHaveText("Verify tray notification lifecycle");

    await expect(launchSecondInstance(profile)).resolves.toBe(0);
    await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isVisible() ?? false
    )).toBe(true);
    await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().length
    )).toBe(1);
    const trayScreenshotPath =
      process.env.INTENTHOUR_DESKTOP_TRAY_SCREENSHOT;
    if (trayScreenshotPath) {
      await page.screenshot({ path: trayScreenshotPath, fullPage: true });
    }

    await app.close();
    app = await launch(profile, { notificationDelayMs: 300 });
    page = await app.firstWindow();
    await expect(page.getByTestId("active-intention"))
      .toHaveText("Verify tray notification lifecycle");
    await page.waitForTimeout(700);
    await expect(page.getByTestId("target-reminder-status"))
      .toHaveText("Saved on this device");
  } finally {
    await app.close();
    removeProfile(profile);
  }
});
