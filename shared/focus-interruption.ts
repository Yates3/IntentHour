import {
  focusSessionSchema,
  interruptionCategorySchema,
  interruptionSchema,
  type FocusSession,
  type Interruption,
  type InterruptionCategory,
} from "./contracts";
import type { DomainResult } from "./focus-session-lifecycle";

export interface IdGenerator {
  uuid(): string;
}

export type RecordInterruptionInput = {
  category: InterruptionCategory;
  note?: string;
};

export type RecordInterruptionDependencies = {
  nowMs: number;
  ids: IdGenerator;
};

export function getInterruptionWallClockOffsetSeconds(
  session: FocusSession,
  nowMs: number,
): DomainResult<number> {
  const startedAtMs = Date.parse(session.startedAt);
  const updatedAtMs = Date.parse(session.updatedAt);

  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(startedAtMs) ||
    !Number.isFinite(updatedAtMs) ||
    nowMs < startedAtMs ||
    nowMs < updatedAtMs
  ) {
    return { ok: false, error: "INVALID_CURRENT_TIME" };
  }

  return {
    ok: true,
    value: Math.floor((nowMs - startedAtMs) / 1_000),
  };
}

export function recordInterruption(
  session: FocusSession,
  input: RecordInterruptionInput,
  dependencies: RecordInterruptionDependencies,
): DomainResult<Interruption> {
  if (session.status !== "running") {
    return { ok: false, error: "SESSION_NOT_RUNNING" };
  }
  if (
    !focusSessionSchema.safeParse(session).success ||
    session.pausedAt != null
  ) {
    return { ok: false, error: "INVALID_SESSION_STATE" };
  }
  if (
    !input ||
    !interruptionCategorySchema.safeParse(input.category).success
  ) {
    return { ok: false, error: "INVALID_INTERRUPTION_CATEGORY" };
  }
  if (input.note !== undefined && typeof input.note !== "string") {
    return { ok: false, error: "INVALID_INTERRUPTION_NOTE" };
  }

  const note = input.note?.trim() || null;
  if (!interruptionSchema.shape.note.safeParse(note).success) {
    return { ok: false, error: "INVALID_INTERRUPTION_NOTE" };
  }

  const offset = getInterruptionWallClockOffsetSeconds(
    session,
    dependencies.nowMs,
  );
  if (!offset.ok) return offset;

  let id: string;
  try {
    id = dependencies.ids.uuid();
  } catch {
    return { ok: false, error: "INVALID_INTERRUPTION_ID" };
  }
  if (!interruptionSchema.shape.id.safeParse(id).success) {
    return { ok: false, error: "INVALID_INTERRUPTION_ID" };
  }

  const timestamp = new Date(dependencies.nowMs).toISOString();
  const interruption = interruptionSchema.safeParse({
    id,
    sessionId: session.id,
    category: input.category,
    occurredAt: timestamp,
    offsetSeconds: offset.value,
    note,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  if (!interruption.success) {
    return { ok: false, error: "INVALID_SESSION_STATE" };
  }

  return { ok: true, value: interruption.data };
}
