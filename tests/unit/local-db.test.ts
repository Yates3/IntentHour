import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getCurrentSession,
  getSessionInterruptions,
  localDb,
  pruneFreeHistory,
} from "../../src/lib/local-db";
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

  it("preserves paused sessions even when their start is old", async () => {
    const paused = session({
      id: "33333333-3333-4333-8333-333333333333",
      status: "paused",
      endedAt: null,
      outcome: null,
      startedAt: "2026-07-01T09:00:00.000Z",
      pausedAt: "2026-07-01T09:10:00.000Z",
    });
    await localDb.sessions.put(paused);

    await pruneFreeHistory(Date.parse("2026-07-18T09:00:00.000Z"));

    await expect(localDb.sessions.get(paused.id)).resolves.toMatchObject({ status: "paused" });
  });

  it("preserves an ended session exactly on the seven-day boundary", async () => {
    const boundary = session({
      endedAt: "2026-07-11T09:00:00.000Z",
      updatedAt: "2026-07-11T09:00:00.000Z",
    });
    await localDb.sessions.put(boundary);

    await pruneFreeHistory(Date.parse("2026-07-18T09:00:00.000Z"));

    await expect(localDb.sessions.get(boundary.id)).resolves.toBeDefined();
  });

  it("does not remove a valid ended session or its interruptions while pruning stale data", async () => {
    const stale = session({
      id: "33333333-3333-4333-8333-333333333333",
      endedAt: "2026-07-01T09:00:00.000Z",
      updatedAt: "2026-07-01T09:00:00.000Z",
    });
    const valid = session({
      id: "44444444-4444-4444-8444-444444444444",
      endedAt: "2026-07-17T09:00:00.000Z",
      updatedAt: "2026-07-17T09:00:00.000Z",
    });
    const validMark = interruption({
      id: "55555555-5555-4555-8555-555555555555",
      sessionId: valid.id,
    });
    await localDb.sessions.bulkPut([stale, valid]);
    await localDb.interruptions.put(validMark);

    await pruneFreeHistory(Date.parse("2026-07-18T09:00:00.000Z"));

    await expect(localDb.sessions.get(stale.id)).resolves.toBeUndefined();
    await expect(localDb.sessions.get(valid.id)).resolves.toBeDefined();
    await expect(localDb.interruptions.get(validMark.id)).resolves.toBeDefined();
  });
});

describe("active session restoration", () => {
  beforeEach(async () => {
    await localDb.open();
    await Promise.all([localDb.sessions.clear(), localDb.interruptions.clear(), localDb.meta.clear()]);
  });
  afterEach(async () => {
    await Promise.all([localDb.sessions.clear(), localDb.interruptions.clear(), localDb.meta.clear()]);
  });

  it("does not restore completed or discarded sessions as active", async () => {
    await localDb.sessions.bulkPut([
      session(),
      session({
        id: "33333333-3333-4333-8333-333333333333",
        status: "discarded",
        outcome: null,
      }),
    ]);

    await expect(getCurrentSession()).resolves.toBeUndefined();
  });

  it("restores a paused session and ignores newer terminal records", async () => {
    const paused = session({
      id: "33333333-3333-4333-8333-333333333333",
      status: "paused",
      endedAt: null,
      outcome: null,
      pausedAt: "2026-07-13T08:10:00.000Z",
      updatedAt: "2026-07-13T08:10:00.000Z",
    });
    const completed = session({ updatedAt: "2026-07-13T09:00:00.000Z" });
    await localDb.sessions.bulkPut([paused, completed]);

    await expect(getCurrentSession()).resolves.toMatchObject({
      id: paused.id,
      status: "paused",
    });
  });

  it("CURRENT BEHAVIOR: chooses the most recently updated record when multiple active sessions exist", async () => {
    const older = session({
      id: "33333333-3333-4333-8333-333333333333",
      status: "running",
      endedAt: null,
      outcome: null,
      updatedAt: "2026-07-13T08:10:00.000Z",
    });
    const newer = session({
      id: "44444444-4444-4444-8444-444444444444",
      status: "paused",
      endedAt: null,
      outcome: null,
      pausedAt: "2026-07-13T08:20:00.000Z",
      updatedAt: "2026-07-13T08:20:00.000Z",
    });
    await localDb.sessions.bulkPut([older, newer]);

    await expect(getCurrentSession()).resolves.toMatchObject({ id: newer.id });
    await expect(localDb.sessions.count()).resolves.toBe(2);
  });

  it("returns interruptions ordered by occurredAt", async () => {
    const later = interruption({
      id: "33333333-3333-4333-8333-333333333333",
      occurredAt: "2026-07-13T08:20:00.000Z",
    });
    const earlier = interruption({
      occurredAt: "2026-07-13T08:05:00.000Z",
    });
    await localDb.interruptions.bulkPut([later, earlier]);

    await expect(getSessionInterruptions(earlier.sessionId)).resolves.toEqual([earlier, later]);
  });
});
