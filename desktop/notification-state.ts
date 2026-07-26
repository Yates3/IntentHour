import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { NotificationStateStore } from "./notification-scheduler.js";

type PersistedNotificationState = {
  version: 1;
  notifiedAtBySession: Record<string, number>;
};

function readState(filePath: string): PersistedNotificationState {
  if (!existsSync(filePath)) {
    return { version: 1, notifiedAtBySession: {} };
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== 1 ||
      !("notifiedAtBySession" in parsed) ||
      typeof parsed.notifiedAtBySession !== "object" ||
      parsed.notifiedAtBySession === null ||
      Array.isArray(parsed.notifiedAtBySession)
    ) {
      return { version: 1, notifiedAtBySession: {} };
    }

    const notifiedAtBySession = Object.fromEntries(
      Object.entries(parsed.notifiedAtBySession)
        .filter((entry): entry is [string, number] =>
          typeof entry[1] === "number" &&
          Number.isSafeInteger(entry[1]) &&
          entry[1] >= 0
        ),
    );
    return { version: 1, notifiedAtBySession };
  } catch {
    return { version: 1, notifiedAtBySession: {} };
  }
}

export class FileNotificationStateStore implements NotificationStateStore {
  private readonly state: PersistedNotificationState;

  constructor(private readonly filePath: string) {
    this.state = readState(filePath);
  }

  has(sessionId: string): boolean {
    return this.state.notifiedAtBySession[sessionId] !== undefined;
  }

  mark(sessionId: string, notifiedAtMs: number): void {
    this.state.notifiedAtBySession[sessionId] = notifiedAtMs;
    writeFileSync(this.filePath, JSON.stringify(this.state), {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}
