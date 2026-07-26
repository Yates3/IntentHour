import Dexie, { type EntityTable } from "dexie";
import {
  focusSessionSchema,
  interruptionSchema,
  type FocusSession,
  type Interruption,
} from "../../../shared/contracts";

export const DESKTOP_DATABASE_NAME = "intenthour-desktop-v1";

type MetaRecord = {
  key: string;
  value: string;
};

class DesktopDatabase extends Dexie {
  sessions!: EntityTable<FocusSession, "id">;
  interruptions!: EntityTable<Interruption, "id">;
  meta!: EntityTable<MetaRecord, "key">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      sessions: "id, status, startedAt, endedAt, updatedAt",
      interruptions: "id, sessionId, occurredAt, updatedAt",
      meta: "key",
    });
  }
}

export class DesktopLocalStore {
  readonly database: DesktopDatabase;

  constructor(name = DESKTOP_DATABASE_NAME) {
    this.database = new DesktopDatabase(name);
  }

  async getDeviceId(): Promise<string> {
    const existing = await this.database.meta.get("deviceId");
    if (existing) return existing.value;

    const value = crypto.randomUUID();
    await this.database.meta.put({ key: "deviceId", value });
    return value;
  }

  async getActiveSession(): Promise<FocusSession | undefined> {
    const candidates = await this.database.sessions
      .where("status")
      .anyOf(["running", "paused"])
      .toArray();

    return [...candidates]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  async saveSession(session: FocusSession): Promise<void> {
    await this.database.sessions.put(focusSessionSchema.parse(session));
  }

  async listEndedSessions(): Promise<FocusSession[]> {
    const ended = await this.database.sessions
      .where("status")
      .anyOf(["completed", "discarded"])
      .toArray();

    return ended.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );
  }

  async saveInterruption(interruption: Interruption): Promise<void> {
    await this.database.interruptions.put(
      interruptionSchema.parse(interruption),
    );
  }

  async listInterruptionsBySession(
    sessionId: string,
  ): Promise<Interruption[]> {
    return this.database.interruptions
      .where("sessionId")
      .equals(sessionId)
      .sortBy("occurredAt");
  }

  close(): void {
    this.database.close();
  }
}

export const desktopLocalStore = new DesktopLocalStore();
