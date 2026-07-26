import { describe, expect, it } from "vitest";
import { getElapsedMs, getRemainingMs } from "../../shared/focus-time";
import { session } from "./fixtures";

describe("shared focus time", () => {
  it("calculates running elapsed and remaining time from the explicit wall clock", () => {
    const running = session({
      status: "running",
      endedAt: null,
      outcome: null,
      startedAt: "2026-07-13T08:00:00.000Z",
      targetMinutes: 50,
    });
    const nowMs = Date.parse("2026-07-13T08:17:30.000Z");

    expect(getElapsedMs(running, nowMs)).toBe(17.5 * 60_000);
    expect(getRemainingMs(running, nowMs)).toBe(32.5 * 60_000);
  });

  it("clamps remaining time to zero after a running session exceeds its target", () => {
    const running = session({
      status: "running",
      endedAt: null,
      outcome: null,
      startedAt: "2026-07-13T08:00:00.000Z",
      targetMinutes: 25,
    });

    expect(getElapsedMs(running, Date.parse("2026-07-13T08:40:00.000Z"))).toBe(40 * 60_000);
    expect(getRemainingMs(running, Date.parse("2026-07-13T08:40:00.000Z"))).toBe(0);
  });

  it("excludes accumulated paused time from a running session", () => {
    const resumed = session({
      status: "running",
      endedAt: null,
      outcome: null,
      startedAt: "2026-07-13T08:00:00.000Z",
      totalPausedMs: 12 * 60_000,
      targetMinutes: 50,
    });

    expect(getElapsedMs(resumed, Date.parse("2026-07-13T09:00:00.000Z"))).toBe(48 * 60_000);
    expect(getRemainingMs(resumed, Date.parse("2026-07-13T09:00:00.000Z"))).toBe(2 * 60_000);
  });

  it("excludes accumulated and open pause intervals while remaining stays frozen", () => {
    const paused = session({
      status: "paused",
      endedAt: null,
      outcome: null,
      startedAt: "2026-07-13T08:00:00.000Z",
      pausedAt: "2026-07-13T08:20:00.000Z",
      totalPausedMs: 5 * 60_000,
      targetMinutes: 50,
    });
    const firstNowMs = Date.parse("2026-07-13T08:25:00.000Z");
    const laterNowMs = Date.parse("2026-07-13T09:10:00.000Z");

    expect(getElapsedMs(paused, firstNowMs)).toBe(15 * 60_000);
    expect(getElapsedMs(paused, laterNowMs)).toBe(15 * 60_000);
    expect(getRemainingMs(paused, firstNowMs)).toBe(35 * 60_000);
    expect(getRemainingMs(paused, laterNowMs)).toBe(35 * 60_000);
  });

  it("uses endedAt for completed and discarded sessions regardless of nowMs", () => {
    const completed = session({
      status: "completed",
      startedAt: "2026-07-13T08:00:00.000Z",
      endedAt: "2026-07-13T08:45:00.000Z",
      totalPausedMs: 10 * 60_000,
    });
    const discarded = session({
      status: "discarded",
      outcome: null,
      startedAt: "2026-07-13T08:00:00.000Z",
      endedAt: "2026-07-13T08:30:00.000Z",
      totalPausedMs: 5 * 60_000,
    });

    expect(getElapsedMs(completed, Date.parse("2026-07-13T09:00:00.000Z"))).toBe(35 * 60_000);
    expect(getElapsedMs(completed, Date.parse("2026-07-14T09:00:00.000Z"))).toBe(35 * 60_000);
    expect(getElapsedMs(discarded, Date.parse("2026-07-13T09:00:00.000Z"))).toBe(25 * 60_000);
    expect(getElapsedMs(discarded, Date.parse("2026-07-14T09:00:00.000Z"))).toBe(25 * 60_000);
  });

  it("handles start and target boundaries without negative elapsed or remaining values", () => {
    const running = session({
      status: "running",
      endedAt: null,
      outcome: null,
      startedAt: "2026-07-13T08:00:00.000Z",
      targetMinutes: 25,
    });
    const startedAtMs = Date.parse(running.startedAt);

    expect(getElapsedMs(running, startedAtMs)).toBe(0);
    expect(getRemainingMs(running, startedAtMs)).toBe(25 * 60_000);
    expect(getElapsedMs(running, startedAtMs - 5 * 60_000)).toBe(0);
    expect(getRemainingMs(running, startedAtMs - 5 * 60_000)).toBe(25 * 60_000);
    expect(getElapsedMs(running, startedAtMs + 25 * 60_000)).toBe(25 * 60_000);
    expect(getRemainingMs(running, startedAtMs + 25 * 60_000)).toBe(0);
  });

  it("does not mutate the session input", () => {
    const running = session({
      status: "running",
      endedAt: null,
      outcome: null,
      totalPausedMs: 3 * 60_000,
    });
    const original = structuredClone(running);

    getElapsedMs(running, Date.parse("2026-07-13T08:20:00.000Z"));
    getRemainingMs(running, Date.parse("2026-07-13T08:20:00.000Z"));

    expect(running).toEqual(original);
  });
});
