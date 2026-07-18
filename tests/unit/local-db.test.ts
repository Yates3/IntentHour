import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localDb, pruneFreeHistory } from "../../src/lib/local-db";
import { interruption, session } from "./fixtures";

describe("free seven-day history", () => {
  beforeEach(async () => {
    await localDb.open();
    await Promise.all([localDb.sessions.clear(), localDb.interruptions.clear(), localDb.meta.clear()]);
  });
  afterEach(async () => {
    await Promise.all([localDb.sessions.clear(), localDb.interruptions.clear(), localDb.meta.clear()]);
  });

  it("removes stale ended sessions and their interruptions", async () => {
    const old = session({ endedAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z" });
    await localDb.sessions.put(old);
    await localDb.interruptions.put(interruption());
    await pruneFreeHistory(Date.parse("2026-07-18T09:00:00.000Z"));
    await expect(localDb.sessions.get(old.id)).resolves.toBeUndefined();
    await expect(localDb.interruptions.where("sessionId").equals(old.id).count()).resolves.toBe(0);
  });

  it("preserves active sessions even when their start is old", async () => {
    const active = session({ status: "running", endedAt: null, outcome: null, startedAt: "2026-07-01T09:00:00.000Z" });
    await localDb.sessions.put(active);
    await pruneFreeHistory(Date.parse("2026-07-18T09:00:00.000Z"));
    await expect(localDb.sessions.get(active.id)).resolves.toMatchObject({ status: "running" });
  });
});
