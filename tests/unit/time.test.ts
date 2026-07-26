import { describe, expect, it } from "vitest";
import { elapsedMs, formatClock, formatDuration, remainingMs } from "../../src/lib/time";
import { session } from "./fixtures";

describe("focus wall clock", () => {
  it("corrects elapsed time from timestamps after a sleeping tab", () => {
    const active = session({ status: "running", endedAt: null, startedAt: "2026-07-13T08:00:00.000Z", targetMinutes: 50 });
    const now = Date.parse("2026-07-13T08:17:30.000Z");
    expect(elapsedMs(active, now)).toBe(17.5 * 60_000);
    expect(remainingMs(active, now)).toBe(32.5 * 60_000);
  });

  it("excludes accumulated and current pauses", () => {
    const paused = session({ status: "paused", endedAt: null, startedAt: "2026-07-13T08:00:00.000Z", pausedAt: "2026-07-13T08:20:00.000Z", totalPausedMs: 5 * 60_000 });
    expect(elapsedMs(paused, Date.parse("2026-07-13T08:32:00.000Z"))).toBe(15 * 60_000);
  });

  it("keeps elapsed and remaining work frozen throughout an open pause", () => {
    const paused = session({
      status: "paused",
      endedAt: null,
      startedAt: "2026-07-13T08:00:00.000Z",
      pausedAt: "2026-07-13T08:20:00.000Z",
      totalPausedMs: 5 * 60_000,
    });
    const firstObservation = Date.parse("2026-07-13T08:25:00.000Z");
    const laterObservation = Date.parse("2026-07-13T09:10:00.000Z");

    expect(elapsedMs(paused, firstObservation)).toBe(15 * 60_000);
    expect(elapsedMs(paused, laterObservation)).toBe(15 * 60_000);
    expect(remainingMs(paused, firstObservation)).toBe(35 * 60_000);
    expect(remainingMs(paused, laterObservation)).toBe(35 * 60_000);
  });

  it("excludes pauses accumulated across multiple pause and resume cycles", () => {
    const resumed = session({
      status: "running",
      endedAt: null,
      startedAt: "2026-07-13T08:00:00.000Z",
      totalPausedMs: 12 * 60_000,
    });

    expect(elapsedMs(resumed, Date.parse("2026-07-13T09:00:00.000Z"))).toBe(48 * 60_000);
    expect(remainingMs(resumed, Date.parse("2026-07-13T09:00:00.000Z"))).toBe(2 * 60_000);
  });

  it("uses endedAt and settled paused time for a completed session", () => {
    const completed = session({
      startedAt: "2026-07-13T08:00:00.000Z",
      endedAt: "2026-07-13T08:45:00.000Z",
      totalPausedMs: 10 * 60_000,
      targetMinutes: 40,
    });

    expect(elapsedMs(completed, Date.parse("2026-07-13T12:00:00.000Z"))).toBe(35 * 60_000);
    expect(remainingMs(completed, Date.parse("2026-07-13T12:00:00.000Z"))).toBe(5 * 60_000);
  });

  it("clamps elapsed work when the observed clock is earlier than startedAt", () => {
    const active = session({
      status: "running",
      endedAt: null,
      startedAt: "2026-07-13T08:00:00.000Z",
      targetMinutes: 25,
    });
    const earlierClock = Date.parse("2026-07-13T07:55:00.000Z");

    expect(elapsedMs(active, earlierClock)).toBe(0);
    expect(remainingMs(active, earlierClock)).toBe(25 * 60_000);
  });

  it("formats accessible timer values", () => {
    expect(formatClock(65_001)).toBe("01:06");
    expect(formatClock(-1)).toBe("00:00");
    expect(formatDuration(92 * 60_000)).toBe("1h 32m");
  });
});
