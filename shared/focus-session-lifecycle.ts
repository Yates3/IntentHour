import {
  focusSessionSchema,
  outcomeSchema,
  type FocusSession,
  type SessionOutcome,
} from "./contracts";

export type FocusLifecycleError =
  | "INVALID_INTENTION"
  | "INVALID_TARGET_DURATION"
  | "INVALID_DEVICE_ID"
  | "INVALID_SESSION_ID"
  | "SESSION_NOT_RUNNING"
  | "SESSION_NOT_PAUSED"
  | "SESSION_NOT_ACTIVE"
  | "OUTCOME_REQUIRED"
  | "INVALID_RESULT_NOTE"
  | "INVALID_INTERRUPTION_CATEGORY"
  | "INVALID_INTERRUPTION_NOTE"
  | "INVALID_INTERRUPTION_ID"
  | "INVALID_SESSION_STATE"
  | "INVALID_CURRENT_TIME";

export type DomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: FocusLifecycleError };

export type FinishSessionInput = {
  outcome: SessionOutcome;
  outcomeNote?: string;
};

function invalidSessionState(): DomainResult<never> {
  return { ok: false, error: "INVALID_SESSION_STATE" };
}

function timestampFor(nowMs: number): DomainResult<string> {
  if (!Number.isFinite(nowMs)) {
    return { ok: false, error: "INVALID_CURRENT_TIME" };
  }
  const date = new Date(nowMs);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "INVALID_CURRENT_TIME" };
  }
  return { ok: true, value: date.toISOString() };
}

function isBeforeSessionTime(session: FocusSession, nowMs: number): boolean {
  const startedAtMs = Date.parse(session.startedAt);
  const updatedAtMs = Date.parse(session.updatedAt);
  return !Number.isFinite(startedAtMs) ||
    !Number.isFinite(updatedAtMs) ||
    nowMs < startedAtMs ||
    nowMs < updatedAtMs;
}

function settleOpenPause(
  session: FocusSession,
  nowMs: number,
): DomainResult<FocusSession> {
  if (session.status !== "running" && session.status !== "paused") {
    return { ok: false, error: "SESSION_NOT_ACTIVE" };
  }
  if (session.totalPausedMs < 0) {
    return invalidSessionState();
  }
  if (isBeforeSessionTime(session, nowMs)) {
    return { ok: false, error: "INVALID_CURRENT_TIME" };
  }

  if (session.status === "running") {
    if (session.pausedAt != null) {
      return invalidSessionState();
    }
    return { ok: true, value: session };
  }

  if (session.pausedAt == null) {
    return invalidSessionState();
  }
  const pausedAtMs = Date.parse(session.pausedAt);
  if (!Number.isFinite(pausedAtMs)) {
    return invalidSessionState();
  }
  if (nowMs < pausedAtMs) {
    return { ok: false, error: "INVALID_CURRENT_TIME" };
  }

  return {
    ok: true,
    value: {
      ...session,
      pausedAt: null,
      totalPausedMs: session.totalPausedMs + (nowMs - pausedAtMs),
    },
  };
}

export function pauseSession(
  session: FocusSession,
  nowMs: number,
): DomainResult<FocusSession> {
  if (session.status !== "running") {
    return { ok: false, error: "SESSION_NOT_RUNNING" };
  }
  if (session.pausedAt != null || session.totalPausedMs < 0) {
    return invalidSessionState();
  }
  const timestamp = timestampFor(nowMs);
  if (!timestamp.ok) return timestamp;
  if (isBeforeSessionTime(session, nowMs)) {
    return { ok: false, error: "INVALID_CURRENT_TIME" };
  }

  return {
    ok: true,
    value: {
      ...session,
      status: "paused",
      pausedAt: timestamp.value,
      updatedAt: timestamp.value,
    },
  };
}

export function finishSession(
  session: FocusSession,
  input: FinishSessionInput,
  nowMs: number,
): DomainResult<FocusSession> {
  if (session.status !== "running" && session.status !== "paused") {
    return { ok: false, error: "SESSION_NOT_ACTIVE" };
  }
  if (!input || !outcomeSchema.safeParse(input.outcome).success) {
    return { ok: false, error: "OUTCOME_REQUIRED" };
  }

  if (input.outcomeNote !== undefined && typeof input.outcomeNote !== "string") {
    return { ok: false, error: "INVALID_RESULT_NOTE" };
  }
  const outcomeNote = input.outcomeNote?.trim() || null;
  if (!focusSessionSchema.shape.outcomeNote.safeParse(outcomeNote).success) {
    return { ok: false, error: "INVALID_RESULT_NOTE" };
  }

  const timestamp = timestampFor(nowMs);
  if (!timestamp.ok) return timestamp;
  const settled = settleOpenPause(session, nowMs);
  if (!settled.ok) return settled;

  return {
    ok: true,
    value: {
      ...settled.value,
      status: "completed",
      endedAt: timestamp.value,
      pausedAt: null,
      outcome: input.outcome,
      outcomeNote,
      updatedAt: timestamp.value,
    },
  };
}

export function discardSession(
  session: FocusSession,
  nowMs: number,
): DomainResult<FocusSession> {
  if (session.status !== "running" && session.status !== "paused") {
    return { ok: false, error: "SESSION_NOT_ACTIVE" };
  }

  const timestamp = timestampFor(nowMs);
  if (!timestamp.ok) return timestamp;
  const settled = settleOpenPause(session, nowMs);
  if (!settled.ok) return settled;

  return {
    ok: true,
    value: {
      ...settled.value,
      status: "discarded",
      endedAt: timestamp.value,
      pausedAt: null,
      outcome: null,
      outcomeNote: null,
      updatedAt: timestamp.value,
    },
  };
}

export function resumeSession(
  session: FocusSession,
  nowMs: number,
): DomainResult<FocusSession> {
  if (session.status !== "paused") {
    return { ok: false, error: "SESSION_NOT_PAUSED" };
  }
  if (session.pausedAt == null || session.totalPausedMs < 0) {
    return invalidSessionState();
  }
  const pausedAtMs = Date.parse(session.pausedAt);
  if (!Number.isFinite(pausedAtMs)) {
    return invalidSessionState();
  }
  const timestamp = timestampFor(nowMs);
  if (!timestamp.ok) return timestamp;
  if (isBeforeSessionTime(session, nowMs) || nowMs < pausedAtMs) {
    return { ok: false, error: "INVALID_CURRENT_TIME" };
  }

  return {
    ok: true,
    value: {
      ...session,
      status: "running",
      pausedAt: null,
      totalPausedMs: session.totalPausedMs + (nowMs - pausedAtMs),
      updatedAt: timestamp.value,
    },
  };
}
