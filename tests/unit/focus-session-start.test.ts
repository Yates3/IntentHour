import { describe, expect, it } from "vitest";
import { startSession } from "../../shared/focus-session-start";

const NOW = Date.parse("2026-07-26T08:00:00.000Z");
const ID = "33333333-3333-4333-8333-333333333333";

describe("startSession", () => {
  it("creates a schema-valid running session from explicit dependencies", () => {
    const input = {
      intention: "  Ship the desktop focus loop  ",
      targetMinutes: 50,
    };
    const original = structuredClone(input);
    const result = startSession(
      input,
      {
        nowMs: NOW,
        deviceId: "desktop-device",
        ids: { uuid: () => ID },
      },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        id: ID,
        deviceId: "desktop-device",
        intention: "Ship the desktop focus loop",
        targetMinutes: 50,
        status: "running",
        startedAt: "2026-07-26T08:00:00.000Z",
        pausedAt: null,
        endedAt: null,
        totalPausedMs: 0,
        outcome: null,
        outcomeNote: null,
        createdAt: "2026-07-26T08:00:00.000Z",
        updatedAt: "2026-07-26T08:00:00.000Z",
      },
    });
    expect(input).toEqual(original);
  });

  it.each([
    [
      { intention: " ", targetMinutes: 50 },
      { nowMs: NOW, deviceId: "desktop-device", ids: { uuid: (): string => ID } },
      "INVALID_INTENTION",
    ],
    [
      { intention: "Focus", targetMinutes: 4 },
      { nowMs: NOW, deviceId: "desktop-device", ids: { uuid: (): string => ID } },
      "INVALID_TARGET_DURATION",
    ],
    [
      { intention: "Focus", targetMinutes: 50 },
      { nowMs: NOW, deviceId: "", ids: { uuid: (): string => ID } },
      "INVALID_DEVICE_ID",
    ],
    [
      { intention: "Focus", targetMinutes: 50 },
      { nowMs: NOW, deviceId: "desktop-device", ids: { uuid: (): string => "bad" } },
      "INVALID_SESSION_ID",
    ],
  ] as const)("rejects invalid session input", (input, dependencies, error) => {
    expect(startSession(input, dependencies)).toEqual({ ok: false, error });
  });

  it("rejects implicit or invalid time instead of reading the clock", () => {
    expect(startSession(
      { intention: "Focus", targetMinutes: 50 },
      {
        nowMs: Number.NaN,
        deviceId: "desktop-device",
        ids: { uuid: () => ID },
      },
    )).toEqual({ ok: false, error: "INVALID_CURRENT_TIME" });
  });
});
