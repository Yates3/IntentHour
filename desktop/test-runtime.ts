import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export type DesktopTestRuntime = Readonly<{
  isSmokeTest: boolean;
  notificationDelayMs?: number;
  userDataPath?: string;
}>;

export function readDesktopTestRuntime(
  argv = process.argv,
  environment = process.env,
): DesktopTestRuntime {
  const notificationDelay = Number(
    environment.INTENTHOUR_DESKTOP_E2E_NOTIFICATION_DELAY_MS,
  );
  const configuredProfile = environment.INTENTHOUR_DESKTOP_E2E_PROFILE;
  const isSmokeTest = argv.includes("--smoke-test");

  return Object.freeze({
    isSmokeTest,
    ...(Number.isSafeInteger(notificationDelay) && notificationDelay >= 0
      ? { notificationDelayMs: notificationDelay }
      : {}),
    ...(configuredProfile
      ? { userDataPath: resolve(configuredProfile) }
      : isSmokeTest
        ? { userDataPath: join(tmpdir(), "intenthour-desktop-smoke") }
        : {}),
  });
}
