import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import {
  DesktopLocalStore,
} from "../../desktop/renderer/src/local-store";
import { interruption, session } from "./fixtures";

const databaseNames = new Set<string>();

function createStore(): { name: string; store: DesktopLocalStore } {
  const name = `intenthour-desktop-test-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return { name, store: new DesktopLocalStore(name) };
}

afterEach(async () => {
  for (const name of databaseNames) {
    await Dexie.delete(name);
  }
  databaseNames.clear();
});

describe("DesktopLocalStore", () => {
  it("keeps the desktop database independent and restores the latest active session", async () => {
    const { name, store } = createStore();
    const older = session({
      id: "33333333-3333-4333-8333-333333333333",
      status: "running",
      endedAt: null,
      outcome: null,
      updatedAt: "2026-07-26T08:10:00.000Z",
    });
    const newer = session({
      id: "44444444-4444-4444-8444-444444444444",
      status: "paused",
      pausedAt: "2026-07-26T08:20:00.000Z",
      endedAt: null,
      outcome: null,
      updatedAt: "2026-07-26T08:20:00.000Z",
    });
    await store.saveSession(older);
    await store.saveSession(newer);
    store.close();

    const reopened = new DesktopLocalStore(name);
    await expect(reopened.getActiveSession()).resolves.toMatchObject({
      id: newer.id,
      status: "paused",
    });
    await expect(reopened.database.sessions.count()).resolves.toBe(2);
    reopened.close();
  });

  it("lists only ended sessions in newest-first order", async () => {
    const { store } = createStore();
    const completed = session({
      updatedAt: "2026-07-26T08:30:00.000Z",
    });
    const discarded = session({
      id: "33333333-3333-4333-8333-333333333333",
      status: "discarded",
      outcome: null,
      updatedAt: "2026-07-26T09:00:00.000Z",
    });
    const active = session({
      id: "44444444-4444-4444-8444-444444444444",
      status: "running",
      endedAt: null,
      outcome: null,
      updatedAt: "2026-07-26T10:00:00.000Z",
    });
    await Promise.all([
      store.saveSession(completed),
      store.saveSession(discarded),
      store.saveSession(active),
    ]);

    await expect(store.listEndedSessions()).resolves.toEqual([
      discarded,
      completed,
    ]);
    store.close();
  });

  it("persists interruptions with their session and chronological order", async () => {
    const { store } = createStore();
    const later = interruption({
      id: "33333333-3333-4333-8333-333333333333",
      occurredAt: "2026-07-26T08:20:00.000Z",
      createdAt: "2026-07-26T08:20:00.000Z",
      updatedAt: "2026-07-26T08:20:00.000Z",
    });
    const earlier = interruption({
      occurredAt: "2026-07-26T08:05:00.000Z",
      createdAt: "2026-07-26T08:05:00.000Z",
      updatedAt: "2026-07-26T08:05:00.000Z",
    });
    await store.saveInterruption(later);
    await store.saveInterruption(earlier);

    await expect(
      store.listInterruptionsBySession(earlier.sessionId),
    ).resolves.toEqual([earlier, later]);
    store.close();
  });

  it("persists one stable device ID inside the desktop database", async () => {
    const { name, store } = createStore();
    const first = await store.getDeviceId();
    const second = await store.getDeviceId();
    expect(second).toBe(first);
    store.close();

    const reopened = new DesktopLocalStore(name);
    await expect(reopened.getDeviceId()).resolves.toBe(first);
    reopened.close();
  });
});
