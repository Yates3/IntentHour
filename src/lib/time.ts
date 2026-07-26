import type { FocusSession } from "../../shared/contracts";
import { getElapsedMs, getRemainingMs } from "../../shared/focus-time";

export function elapsedMs(session: FocusSession, now = Date.now()): number {
  return getElapsedMs(session, now);
}

export function remainingMs(session: FocusSession, now = Date.now()): number {
  return getRemainingMs(session, now);
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
