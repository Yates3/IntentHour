import { focusSessionSchema, type FocusSession } from "./contracts";
import type { DomainResult } from "./focus-session-lifecycle";

export type StartSessionInput = {
  intention: string;
  targetMinutes: number;
};

export type StartSessionDependencies = {
  nowMs: number;
  deviceId: string;
  ids: {
    uuid(): string;
  };
};

export function startSession(
  input: StartSessionInput,
  dependencies: StartSessionDependencies,
): DomainResult<FocusSession> {
  if (!input || typeof input.intention !== "string") {
    return { ok: false, error: "INVALID_INTENTION" };
  }
  if (!Number.isFinite(dependencies.nowMs)) {
    return { ok: false, error: "INVALID_CURRENT_TIME" };
  }

  const timestamp = new Date(dependencies.nowMs).toISOString();
  let id: string;
  try {
    id = dependencies.ids.uuid();
  } catch {
    return { ok: false, error: "INVALID_SESSION_ID" };
  }

  const parsed = focusSessionSchema.safeParse({
    id,
    deviceId: dependencies.deviceId,
    intention: input.intention.trim(),
    targetMinutes: input.targetMinutes,
    status: "running",
    startedAt: timestamp,
    pausedAt: null,
    endedAt: null,
    totalPausedMs: 0,
    outcome: null,
    outcomeNote: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  if (!focusSessionSchema.shape.id.safeParse(id).success) {
    return { ok: false, error: "INVALID_SESSION_ID" };
  }
  if (!focusSessionSchema.shape.deviceId.safeParse(dependencies.deviceId).success) {
    return { ok: false, error: "INVALID_DEVICE_ID" };
  }
  if (!focusSessionSchema.shape.intention.safeParse(input.intention).success) {
    return { ok: false, error: "INVALID_INTENTION" };
  }
  if (!focusSessionSchema.shape.targetMinutes.safeParse(input.targetMinutes).success) {
    return { ok: false, error: "INVALID_TARGET_DURATION" };
  }

  return { ok: false, error: "INVALID_SESSION_STATE" };
}
