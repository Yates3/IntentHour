import { describe, expect, it } from "vitest";
import type { InterruptionCategory } from "../../shared/contracts";
import {
  getInterruptionWallClockOffsetSeconds,
  recordInterruption,
  type IdGenerator,
} from "../../shared/focus-interruption";
import { session } from "./fixtures";

const firstId = "22222222-2222-4222-8222-222222222222";
const secondId = "33333333-3333-4333-8333-333333333333";
const startedAtMs = Date.parse("2026-07-13T08:00:00.000Z");

function runningSession() {
  return session({
    status: "running",
    endedAt: null,
    outcome: null,
    outcomeNote: null,
    updatedAt: "2026-07-13T08:00:00.000Z",
  });
}

function fixedIds(id = firstId): IdGenerator {
  return { uuid: () => id };
}

describe("recordInterruption", () => {
  it("creates a deterministic interruption for a running session", () => {
    const active = runningSession();

    const result = recordInterruption(
      active,
      { category: "message", note: "  Return to the draft  " },
      { nowMs: startedAtMs + 90_250, ids: fixedIds() },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        id: firstId,
        sessionId: active.id,
        category: "message",
        occurredAt: "2026-07-13T08:01:30.250Z",
        offsetSeconds: 90,
        note: "Return to the draft",
        createdAt: "2026-07-13T08:01:30.250Z",
        updatedAt: "2026-07-13T08:01:30.250Z",
      },
    });
  });

  it("does not mutate the input session", () => {
    const active = runningSession();
    const before = structuredClone(active);

    recordInterruption(
      active,
      { category: "noise" },
      { nowMs: startedAtMs + 10_000, ids: fixedIds() },
    );

    expect(active).toEqual(before);
  });

  it.each([
    ["paused", { status: "paused", pausedAt: "2026-07-13T08:05:00.000Z" }],
    ["completed", { status: "completed" }],
    ["discarded", { status: "discarded", outcome: null }],
  ] as const)("rejects a %s session", (_label, overrides) => {
    const result = recordInterruption(
      session(overrides),
      { category: "message" },
      { nowMs: startedAtMs + 600_000, ids: fixedIds() },
    );

    expect(result).toEqual({ ok: false, error: "SESSION_NOT_RUNNING" });
  });

  it("rejects an invalid category at the domain boundary", () => {
    const result = recordInterruption(
      runningSession(),
      { category: "email" as InterruptionCategory },
      { nowMs: startedAtMs + 1_000, ids: fixedIds() },
    );

    expect(result).toEqual({
      ok: false,
      error: "INVALID_INTERRUPTION_CATEGORY",
    });
  });

  it("rejects a note beyond the shared contract limit", () => {
    const result = recordInterruption(
      runningSession(),
      { category: "other", note: "x".repeat(301) },
      { nowMs: startedAtMs + 1_000, ids: fixedIds() },
    );

    expect(result).toEqual({
      ok: false,
      error: "INVALID_INTERRUPTION_NOTE",
    });
  });

  it("returns zero offset when recorded at the session start", () => {
    const result = recordInterruption(
      runningSession(),
      { category: "new_idea" },
      { nowMs: startedAtMs, ids: fixedIds() },
    );

    expect(result.ok && result.value.offsetSeconds).toBe(0);
  });

  it("rejects a clock earlier than the session start", () => {
    const result = recordInterruption(
      runningSession(),
      { category: "new_idea" },
      { nowMs: startedAtMs - 1, ids: fixedIds() },
    );

    expect(result).toEqual({ ok: false, error: "INVALID_CURRENT_TIME" });
  });

  it("floors wall-clock offsets to whole seconds", () => {
    const result = getInterruptionWallClockOffsetSeconds(
      runningSession(),
      startedAtMs + 1_999,
    );

    expect(result).toEqual({ ok: true, value: 1 });
  });

  it("preserves the existing wall-clock offset semantics after a resumed pause", () => {
    const resumed = runningSession();
    resumed.totalPausedMs = 60_000;
    resumed.updatedAt = "2026-07-13T08:01:30.000Z";

    const result = recordInterruption(
      resumed,
      { category: "task_switch" },
      { nowMs: startedAtMs + 120_000, ids: fixedIds() },
    );

    expect(result.ok && result.value.offsetSeconds).toBe(120);
  });

  it("uses each ID supplied by the injected generator", () => {
    const ids = [firstId, secondId];
    const generator: IdGenerator = {
      uuid: () => ids.shift() ?? "unexpected",
    };

    const first = recordInterruption(
      runningSession(),
      { category: "message" },
      { nowMs: startedAtMs + 1_000, ids: generator },
    );
    const second = recordInterruption(
      runningSession(),
      { category: "noise" },
      { nowMs: startedAtMs + 2_000, ids: generator },
    );

    expect(first.ok && first.value.id).toBe(firstId);
    expect(second.ok && second.value.id).toBe(secondId);
  });

  it("rejects an invalid generated ID", () => {
    const result = recordInterruption(
      runningSession(),
      { category: "message" },
      { nowMs: startedAtMs + 1_000, ids: fixedIds("not-a-uuid") },
    );

    expect(result).toEqual({
      ok: false,
      error: "INVALID_INTERRUPTION_ID",
    });
  });
});
