import {
  _electron as electron,
  expect,
  test,
  type Page,
} from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const localAppData = process.env.LOCALAPPDATA;
const installedExecutable = process.env.INTENTHOUR_INSTALLED_EXE ||
  (localAppData
    ? join(
      localAppData,
      "IntentHour",
      "app-1.0.0",
      "IntentHour.exe",
    )
    : "");

async function launchInstalledApp() {
  if (!installedExecutable || !existsSync(installedExecutable)) {
    throw new Error(
      "Install IntentHour or set INTENTHOUR_INSTALLED_EXE before this test.",
    );
  }
  const scaleFactor = process.env.INTENTHOUR_QA_SCALE_FACTOR;
  return electron.launch({
    executablePath: installedExecutable,
    args: scaleFactor
      ? [`--force-device-scale-factor=${scaleFactor}`]
      : undefined,
  });
}

function launchSecondInstalledInstance(): Promise<number | null> {
  return new Promise((resolveExit, reject) => {
    const child = spawn(installedExecutable, [], {
      stdio: "ignore",
      windowsHide: true,
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("The second installed instance did not exit."));
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

async function ageActiveSession(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolveOpen, reject) => {
      const request = indexedDB.open("intenthour-desktop-v1");
      request.onsuccess = () => resolveOpen(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not open IndexedDB."));
    });

    const transaction = database.transaction("sessions", "readwrite");
    const sessions = await new Promise<Array<Record<string, unknown>>>(
      (resolveRows, reject) => {
        const request = transaction.objectStore("sessions").getAll();
        request.onsuccess = () =>
          resolveRows(request.result as Array<Record<string, unknown>>);
        request.onerror = () =>
          reject(request.error ?? new Error("Could not read Sessions."));
      },
    );
    const active = sessions.find((session) =>
      session.status === "running" || session.status === "paused"
    );
    if (!active) throw new Error("No active installed Session was found.");

    const agedAt = new Date(Date.now() - 26 * 60_000).toISOString();
    active.startedAt = agedAt;
    active.updatedAt = new Date().toISOString();
    transaction.objectStore("sessions").put(active);

    await new Promise<void>((resolveDone, reject) => {
      transaction.oncomplete = () => resolveDone();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Session update failed."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Session update was aborted."));
    });
    database.close();
  });
}

test("installed app preserves the local focus loop, tray, and reminder", async () => {
  let app = await launchInstalledApp();
  try {
    let page = await app.firstWindow();
    await expect(page).toHaveTitle("IntentHour Desktop");

    if (process.env.INTENTHOUR_EXPECT_PRESERVED_HISTORY === "true") {
      await page.getByRole("button", { name: "History" }).click();
      await expect(page.getByTestId("history-list"))
        .toContainText("Installed release QA discard");
      await page.getByRole("button", { name: "Back" }).click();
    }

    await page.getByTestId("intention-input")
      .fill("Installed release QA recovery");
    await page.getByRole("button", { name: "25 min" }).click();
    await page.getByTestId("start-session").click();
    await page.getByTestId("open-interruption").click();
    await page.getByRole("button", { name: "Message" }).click();
    await page.getByTestId("save-interruption").click();
    await page.getByTestId("toggle-pause").click();
    await expect(page.getByText("SESSION PAUSED")).toBeVisible();

    await app.close();
    app = await launchInstalledApp();
    page = await app.firstWindow();
    await expect(page.getByTestId("active-intention"))
      .toHaveText("Installed release QA recovery");
    await expect(page.getByText("SESSION PAUSED")).toBeVisible();
    await expect(page.getByTestId("interruption-count")).toHaveText("1");

    await page.getByTestId("toggle-pause").click();
    await ageActiveSession(page);
    await page.reload();
    await expect(page.getByTestId("target-reminder-status"))
      .toHaveText("Target reminder sent - session stays open", {
        timeout: 10_000,
      });
    await expect(page.getByTestId("active-intention"))
      .toHaveText("Installed release QA recovery");

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close();
    });
    await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isVisible() ?? false
    )).toBe(false);
    await expect(launchSecondInstalledInstance()).resolves.toBe(0);
    await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isVisible() ?? false
    )).toBe(true);
    await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().length
    )).toBe(1);

    await page.getByTestId("finish-session").click();
    await page.getByRole("button", { name: "Moved forward" }).click();
    await page.getByTestId("confirm-finish").click();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByTestId("history-list"))
      .toContainText("Installed release QA recovery");

    await page.getByRole("button", { name: "Back" }).click();
    await page.getByTestId("intention-input")
      .fill("Installed release QA discard");
    await page.getByTestId("start-session").click();
    await page.getByTestId("discard-session").click();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByTestId("history-list"))
      .toContainText("Installed release QA discard");
    await expect(page.getByTestId("history-list")).toContainText("Discarded");

    const screenshotPath = process.env.INTENTHOUR_INSTALLED_SCREENSHOT;
    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  } finally {
    await app.close();
  }
});
