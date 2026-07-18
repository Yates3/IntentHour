import type { FocusSession } from "../../shared/contracts";

export function elapsedMs(session: FocusSession, now = Date.now()): number {
  const start = Date.parse(session.startedAt);
  const end = session.endedAt ? Date.parse(session.endedAt) : now;
  const currentPause = session.status === "paused" && session.pausedAt
    ? Math.max(0, end - Date.parse(session.pausedAt))
    : 0;
  return Math.max(0, end - start - session.totalPausedMs - currentPause);
}

export function remainingMs(session: FocusSession, now = Date.now()): number {
  return Math.max(0, session.targetMinutes * 60_000 - elapsedMs(session, now));
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes.toString().padStart(2, "0")}m` : `${minutes}m`;
}
