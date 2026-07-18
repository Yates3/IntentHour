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

  it("formats accessible timer values", () => {
    expect(formatClock(65_001)).toBe("01:06");
    expect(formatClock(-1)).toBe("00:00");
    expect(formatDuration(92 * 60_000)).toBe("1h 32m");
  });
});
