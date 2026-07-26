import type { FocusSession } from "./contracts";

export function getElapsedMs(session: FocusSession, nowMs: number): number {
  const startedAtMs = Date.parse(session.startedAt);
  const endedAtMs = session.endedAt ? Date.parse(session.endedAt) : nowMs;
  const currentPauseMs = session.status === "paused" && session.pausedAt
    ? Math.max(0, endedAtMs - Date.parse(session.pausedAt))
    : 0;

  return Math.max(
    0,
    endedAtMs - startedAtMs - session.totalPausedMs - currentPauseMs,
  );
}

export function getRemainingMs(session: FocusSession, nowMs: number): number {
  return Math.max(
    0,
    session.targetMinutes * 60_000 - getElapsedMs(session, nowMs),
  );
}
