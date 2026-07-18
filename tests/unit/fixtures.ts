import type { FocusSession, Interruption } from "../../shared/contracts";

export function session(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    deviceId: "device-test",
    intention: "Ship the launch narrative",
    targetMinutes: 50,
    status: "completed",
    startedAt: "2026-07-13T08:00:00.000Z",
    pausedAt: null,
    endedAt: "2026-07-13T08:45:00.000Z",
    totalPausedMs: 0,
    outcome: "moved_forward",
    outcomeNote: null,
    createdAt: "2026-07-13T08:00:00.000Z",
    updatedAt: "2026-07-13T08:45:00.000Z",
    ...overrides,
  };
}

export function interruption(overrides: Partial<Interruption> = {}): Interruption {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    sessionId: "11111111-1111-4111-8111-111111111111",
    category: "new_idea",
    occurredAt: "2026-07-13T08:10:00.000Z",
    offsetSeconds: 600,
    note: null,
    createdAt: "2026-07-13T08:10:00.000Z",
    updatedAt: "2026-07-13T08:10:00.000Z",
    ...overrides,
  };
}
