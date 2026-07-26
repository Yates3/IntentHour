import { describe, expect, it } from "vitest";
import type { FocusSession } from "../../shared/contracts";
import {
  discardSession,
  finishSession,
  pauseSession,
  resumeSession,
  type DomainResult,
} from "../../shared/focus-session-lifecycle";
import { getElapsedMs, getRemainingMs } from "../../shared/focus-time";
import { session } from "./fixtures";

function valueOf(result: DomainResult<FocusSession>): FocusSession {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected success, received ${result.error}`);
  return result.value;
}

function runningSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return session({
    status: "running",
    endedAt: null,
    outcome: null,
    outcomeNote: null,
    pausedAt: null,
    startedAt: "2026-07-13T08:00:00.000Z",
    createdAt: "2026-07-13T08:00:00.000Z",
    updatedAt: "2026-07-13T08:00:00.000Z",
    ...overrides,
  });
}

function pausedSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return runningSession({
    status: "paused",
    pausedAt: "2026-07-13T08:20:00.000Z",
    updatedAt: "2026-07-13T08:20:00.000Z",
    ...overrides,
  });
}

describe("pauseSession", () => {
  it("transitions running to paused without changing accumulated pause time or other fields", () => {
    const running = runningSession({
      totalPausedMs: 5 * 60_000,
      outcomeNote: "Preserve this field",
    });
    const original = structuredClone(running);
    const nowMs = Date.parse("2026-07-13T08:25:00.000Z");

    const paused = valueOf(pauseSession(running, nowMs));

    expect(paused).toEqual({
      ...running,
      status: "paused",
      pausedAt: "2026-07-13T08:25:00.000Z",
      updatedAt: "2026-07-13T08:25:00.000Z",
    });
    expect(paused.totalPausedMs).toBe(5 * 60_000);
    expect(running).toEqual(original);
    expect(paused).not.toBe(running);
  });

  it.each([
    ["paused", pausedSession(), "SESSION_NOT_RUNNING"],
    ["completed", session(), "SESSION_NOT_RUNNING"],
    [
      "discarded",
      session({ status: "discarded", outcome: null }),
      "SESSION_NOT_RUNNING",
    ],
  ] as const)("rejects a %s session", (_status, input, error) => {
    const original = structuredClone(input);

    expect(pauseSession(input, Date.parse("2026-07-13T09:00:00.000Z")))
      .toEqual({ ok: false, error });
    expect(input).toEqual(original);
  });

  it("rejects a running session that already has pausedAt", () => {
    const invalid = runningSession({ pausedAt: "2026-07-13T08:10:00.000Z" });

    expect(pauseSession(invalid, Date.parse("2026-07-13T08:20:00.000Z")))
      .toEqual({ ok: false, error: "INVALID_SESSION_STATE" });
  });

  it("rejects negative accumulated pause time", () => {
    const invalid = runningSession({ totalPausedMs: -1 });

    expect(pauseSession(invalid, Date.parse("2026-07-13T08:20:00.000Z")))
      .toEqual({ ok: false, error: "INVALID_SESSION_STATE" });
  });

  it("rejects an invalid or backward current time", () => {
    const running = runningSession();

    expect(pauseSession(running, Number.NaN))
      .toEqual({ ok: false, error: "INVALID_CURRENT_TIME" });
    expect(pauseSession(running, Date.parse("2026-07-13T07:59:59.999Z")))
      .toEqual({ ok: false, error: "INVALID_CURRENT_TIME" });
  });
});

describe("resumeSession", () => {
  it("settles the open pause interval and transitions paused to running", () => {
    const paused = pausedSession({ totalPausedMs: 5 * 60_000 });
    const original = structuredClone(paused);
    const nowMs = Date.parse("2026-07-13T08:32:00.000Z");

    const resumed = valueOf(resumeSession(paused, nowMs));

    expect(resumed).toEqual({
      ...paused,
      status: "running",
      pausedAt: null,
      totalPausedMs: 17 * 60_000,
      updatedAt: "2026-07-13T08:32:00.000Z",
    });
    expect(paused).toEqual(original);
    expect(resumed).not.toBe(paused);
  });

  it.each([
    ["running", runningSession(), "SESSION_NOT_PAUSED"],
    ["completed", session(), "SESSION_NOT_PAUSED"],
    [
      "discarded",
      session({ status: "discarded", outcome: null }),
      "SESSION_NOT_PAUSED",
    ],
  ] as const)("rejects a %s session", (_status, input, error) => {
    const original = structuredClone(input);

    expect(resumeSession(input, Date.parse("2026-07-13T09:00:00.000Z")))
      .toEqual({ ok: false, error });
    expect(input).toEqual(original);
  });

  it("rejects a paused session without a valid pausedAt", () => {
    const missing = pausedSession({ pausedAt: null });
    const malformed = pausedSession({ pausedAt: "not-a-date" });

    expect(resumeSession(missing, Date.parse("2026-07-13T08:30:00.000Z")))
      .toEqual({ ok: false, error: "INVALID_SESSION_STATE" });
    expect(resumeSession(malformed, Date.parse("2026-07-13T08:30:00.000Z")))
      .toEqual({ ok: false, error: "INVALID_SESSION_STATE" });
  });

  it("rejects negative accumulated pause time", () => {
    const invalid = pausedSession({ totalPausedMs: -1 });

    expect(resumeSession(invalid, Date.parse("2026-07-13T08:30:00.000Z")))
      .toEqual({ ok: false, error: "INVALID_SESSION_STATE" });
  });

  it("rejects an invalid or backward current time without changing accumulated pause time", () => {
    const paused = pausedSession({ totalPausedMs: 5 * 60_000 });

    expect(resumeSession(paused, Number.POSITIVE_INFINITY))
      .toEqual({ ok: false, error: "INVALID_CURRENT_TIME" });
    expect(resumeSession(paused, Date.parse("2026-07-13T08:19:59.999Z")))
      .toEqual({ ok: false, error: "INVALID_CURRENT_TIME" });
    expect(paused.totalPausedMs).toBe(5 * 60_000);
  });
});

describe("pause and resume time integration", () => {
  it("keeps elapsed and remaining frozen while paused and excludes the pause after resume", () => {
    const running = runningSession({ targetMinutes: 50 });
    const paused = valueOf(
      pauseSession(running, Date.parse("2026-07-13T08:20:00.000Z")),
    );

    expect(getElapsedMs(paused, Date.parse("2026-07-13T08:40:00.000Z")))
      .toBe(20 * 60_000);
    expect(getRemainingMs(paused, Date.parse("2026-07-13T08:40:00.000Z")))
      .toBe(30 * 60_000);

    const resumed = valueOf(
      resumeSession(paused, Date.parse("2026-07-13T08:40:00.000Z")),
    );
    expect(getElapsedMs(resumed, Date.parse("2026-07-13T08:50:00.000Z")))
      .toBe(30 * 60_000);
    expect(getRemainingMs(resumed, Date.parse("2026-07-13T08:50:00.000Z")))
      .toBe(20 * 60_000);
  });

  it("accumulates multiple pause intervals without overwriting history", () => {
    const running = runningSession();
    const firstPause = valueOf(
      pauseSession(running, Date.parse("2026-07-13T08:10:00.000Z")),
    );
    const firstResume = valueOf(
      resumeSession(firstPause, Date.parse("2026-07-13T08:15:00.000Z")),
    );
    const secondPause = valueOf(
      pauseSession(firstResume, Date.parse("2026-07-13T08:20:00.000Z")),
    );
    const secondResume = valueOf(
      resumeSession(secondPause, Date.parse("2026-07-13T08:27:00.000Z")),
    );

    expect(firstResume.totalPausedMs).toBe(5 * 60_000);
    expect(secondResume.totalPausedMs).toBe(12 * 60_000);
    expect(getElapsedMs(secondResume, Date.parse("2026-07-13T09:00:00.000Z")))
      .toBe(48 * 60_000);
  });
});

describe("finishSession", () => {
  it("completes a running session with the selected outcome and trimmed result note", () => {
    const running = runningSession();
    const original = structuredClone(running);
    const nowMs = Date.parse("2026-07-13T08:30:00.000Z");

    const completed = valueOf(finishSession(
      running,
      { outcome: "moved_forward", outcomeNote: "  Kept the scope narrow  " },
      nowMs,
    ));

    expect(completed).toEqual({
      ...running,
      status: "completed",
      endedAt: "2026-07-13T08:30:00.000Z",
      pausedAt: null,
      outcome: "moved_forward",
      outcomeNote: "Kept the scope narrow",
      updatedAt: "2026-07-13T08:30:00.000Z",
    });
    expect(running).toEqual(original);
    expect(completed).not.toBe(running);
  });

  it("settles an open pause interval before completion", () => {
    const paused = pausedSession({ totalPausedMs: 5 * 60_000 });
    const original = structuredClone(paused);

    const completed = valueOf(finishSession(
      paused,
      { outcome: "completed" },
      Date.parse("2026-07-13T08:32:00.000Z"),
    ));

    expect(completed.status).toBe("completed");
    expect(completed.pausedAt).toBeNull();
    expect(completed.totalPausedMs).toBe(17 * 60_000);
    expect(completed.outcome).toBe("completed");
    expect(completed.outcomeNote).toBeNull();
    expect(paused).toEqual(original);
  });

  it.each([
    ["completed", session(), "SESSION_NOT_ACTIVE"],
    [
      "discarded",
      session({ status: "discarded", outcome: null }),
      "SESSION_NOT_ACTIVE",
    ],
  ] as const)("rejects finishing a %s session", (_status, input, error) => {
    expect(finishSession(
      input,
      { outcome: "completed" },
      Date.parse("2026-07-13T09:00:00.000Z"),
    )).toEqual({ ok: false, error });
  });

  it("rejects a missing or invalid outcome", () => {
    const running = runningSession();

    expect(finishSession(
      running,
      { outcome: undefined as unknown as "completed" },
      Date.parse("2026-07-13T08:30:00.000Z"),
    )).toEqual({ ok: false, error: "OUTCOME_REQUIRED" });
    expect(finishSession(
      running,
      { outcome: "not-an-outcome" as "completed" },
      Date.parse("2026-07-13T08:30:00.000Z"),
    )).toEqual({ ok: false, error: "OUTCOME_REQUIRED" });
  });

  it("rejects a result note that exceeds the shared schema limit", () => {
    expect(finishSession(
      runningSession(),
      { outcome: "completed", outcomeNote: "x".repeat(501) },
      Date.parse("2026-07-13T08:30:00.000Z"),
    )).toEqual({ ok: false, error: "INVALID_RESULT_NOTE" });
    expect(finishSession(
      runningSession(),
      { outcome: "completed", outcomeNote: 42 as unknown as string },
      Date.parse("2026-07-13T08:30:00.000Z"),
    )).toEqual({ ok: false, error: "INVALID_RESULT_NOTE" });
  });
});

describe("discardSession", () => {
  it("discards a running session and clears outcome fields", () => {
    const running = runningSession({
      outcome: "blocked",
      outcomeNote: "Stale draft result",
    });
    const original = structuredClone(running);

    const discarded = valueOf(discardSession(
      running,
      Date.parse("2026-07-13T08:30:00.000Z"),
    ));

    expect(discarded).toEqual({
      ...running,
      status: "discarded",
      endedAt: "2026-07-13T08:30:00.000Z",
      pausedAt: null,
      outcome: null,
      outcomeNote: null,
      updatedAt: "2026-07-13T08:30:00.000Z",
    });
    expect(running).toEqual(original);
    expect(discarded).not.toBe(running);
  });

  it("intentionally settles an open pause interval before discard", () => {
    const paused = pausedSession({ totalPausedMs: 5 * 60_000 });
    const original = structuredClone(paused);

    const discarded = valueOf(discardSession(
      paused,
      Date.parse("2026-07-13T08:32:00.000Z"),
    ));

    expect(discarded.status).toBe("discarded");
    expect(discarded.pausedAt).toBeNull();
    expect(discarded.totalPausedMs).toBe(17 * 60_000);
    expect(discarded.outcome).toBeNull();
    expect(discarded.outcomeNote).toBeNull();
    expect(paused).toEqual(original);
  });

  it.each([
    ["completed", session(), "SESSION_NOT_ACTIVE"],
    [
      "discarded",
      session({ status: "discarded", outcome: null }),
      "SESSION_NOT_ACTIVE",
    ],
  ] as const)("rejects discarding a %s session", (_status, input, error) => {
    expect(discardSession(
      input,
      Date.parse("2026-07-13T09:00:00.000Z"),
    )).toEqual({ ok: false, error });
  });
});

describe("finish and discard time integration", () => {
  it("freezes ended elapsed time and gives finish and discard the same pause settlement", () => {
    const paused = pausedSession({
      targetMinutes: 50,
      totalPausedMs: 5 * 60_000,
    });
    const endedAtMs = Date.parse("2026-07-13T08:32:00.000Z");
    const completed = valueOf(finishSession(
      paused,
      { outcome: "completed" },
      endedAtMs,
    ));
    const discarded = valueOf(discardSession(paused, endedAtMs));

    expect(completed.totalPausedMs).toBe(discarded.totalPausedMs);
    expect(getElapsedMs(completed, endedAtMs)).toBe(15 * 60_000);
    expect(getElapsedMs(discarded, endedAtMs)).toBe(15 * 60_000);
    expect(getElapsedMs(completed, endedAtMs + 24 * 60 * 60_000))
      .toBe(15 * 60_000);
    expect(getElapsedMs(discarded, endedAtMs + 24 * 60 * 60_000))
      .toBe(15 * 60_000);
  });

  it("preserves multiple settled pauses when a later open pause is terminated", () => {
    const firstPause = valueOf(
      pauseSession(runningSession(), Date.parse("2026-07-13T08:10:00.000Z")),
    );
    const firstResume = valueOf(
      resumeSession(firstPause, Date.parse("2026-07-13T08:15:00.000Z")),
    );
    const secondPause = valueOf(
      pauseSession(firstResume, Date.parse("2026-07-13T08:20:00.000Z")),
    );
    const completed = valueOf(finishSession(
      secondPause,
      { outcome: "moved_forward" },
      Date.parse("2026-07-13T08:27:00.000Z"),
    ));

    expect(completed.totalPausedMs).toBe(12 * 60_000);
    expect(getElapsedMs(completed, Date.parse("2026-07-13T09:00:00.000Z")))
      .toBe(15 * 60_000);
  });

  it("supports termination before and after target while retaining shared remaining semantics", () => {
    const running = runningSession({ targetMinutes: 25 });
    const beforeTarget = valueOf(finishSession(
      running,
      { outcome: "moved_forward" },
      Date.parse("2026-07-13T08:20:00.000Z"),
    ));
    const afterTarget = valueOf(discardSession(
      running,
      Date.parse("2026-07-13T08:40:00.000Z"),
    ));

    expect(getRemainingMs(beforeTarget, Date.parse("2026-07-14T08:00:00.000Z")))
      .toBe(5 * 60_000);
    expect(getRemainingMs(afterTarget, Date.parse("2026-07-14T08:00:00.000Z")))
      .toBe(0);
  });

  it("rejects a backward pause boundary without producing negative paused time", () => {
    const paused = pausedSession({
      pausedAt: "2026-07-13T08:20:00.000Z",
      updatedAt: "2026-07-13T08:20:00.000Z",
      totalPausedMs: 5 * 60_000,
    });
    const nowMs = Date.parse("2026-07-13T08:19:59.999Z");

    expect(finishSession(paused, { outcome: "completed" }, nowMs))
      .toEqual({ ok: false, error: "INVALID_CURRENT_TIME" });
    expect(discardSession(paused, nowMs))
      .toEqual({ ok: false, error: "INVALID_CURRENT_TIME" });
    expect(paused.totalPausedMs).toBe(5 * 60_000);
  });
});
