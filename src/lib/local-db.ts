import Dexie, { type EntityTable } from "dexie";
import type { FocusSession, Interruption } from "../../shared/contracts";

interface MetaRecord {
  key: string;
  value: string;
}

class IntentHourDatabase extends Dexie {
  sessions!: EntityTable<FocusSession, "id">;
  interruptions!: EntityTable<Interruption, "id">;
  meta!: EntityTable<MetaRecord, "key">;

  constructor() {
    super("intenthour");
    this.version(1).stores({
      sessions: "id, status, startedAt, endedAt, updatedAt",
      interruptions: "id, sessionId, occurredAt, updatedAt",
      meta: "key",
    });
  }
}

export const localDb = new IntentHourDatabase();

export async function getDeviceId(): Promise<string> {
  const existing = await localDb.meta.get("deviceId");
  if (existing) return existing.value;
  const value = crypto.randomUUID();
  await localDb.meta.put({ key: "deviceId", value });
  return value;
}

export async function pruneFreeHistory(now = Date.now()): Promise<void> {
  const threshold = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const stale = await localDb.sessions
    .where("endedAt")
    .below(threshold)
    .and((session) => session.status !== "running" && session.status !== "paused")
    .toArray();
  if (stale.length === 0) return;
  const ids = stale.map((session) => session.id);
  await localDb.transaction("rw", localDb.sessions, localDb.interruptions, async () => {
    await localDb.interruptions.where("sessionId").anyOf(ids).delete();
    await localDb.sessions.bulkDelete(ids);
  });
}

export async function getCurrentSession(): Promise<FocusSession | undefined> {
  const candidates = await localDb.sessions
    .where("status")
    .anyOf(["running", "paused"])
    .toArray();
  return [...candidates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export async function getRecentSessions(): Promise<FocusSession[]> {
  return localDb.sessions.orderBy("startedAt").reverse().toArray();
}

export async function getSessionInterruptions(sessionId: string): Promise<Interruption[]> {
  return localDb.interruptions.where("sessionId").equals(sessionId).sortBy("occurredAt");
}
