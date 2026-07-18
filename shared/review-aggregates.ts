import type { FocusSession, Interruption, InterruptionCategory } from "./contracts";

export interface ReviewEvidence {
  top_interruption: string;
  morning_completion: string;
  long_session_drift: string;
  intention_kept: string;
}

export function buildReviewAggregates(sessions: FocusSession[], interruptions: Interruption[]) {
  const categories: Record<InterruptionCategory, number> = { message: 0, new_idea: 0, noise: 0, task_switch: 0, other: 0 };
  interruptions.forEach((item) => { categories[item.category] += 1; });
  const ranked = (Object.entries(categories) as Array<[InterruptionCategory, number]>).sort((a, b) => b[1] - a[1]);
  const top = ranked[0] ?? ["other", 0] as const;
  const keptSessions = sessions.filter((session) => session.outcome === "completed" || session.outcome === "moved_forward");
  const morning = sessions.filter((session) => new Date(session.startedAt).getUTCHours() < 11);
  const morningKept = morning.filter((session) => session.outcome === "completed" || session.outcome === "moved_forward");
  const durationMinutes = sessions.map((session) => Math.max(1, Math.round(((session.endedAt ? Date.parse(session.endedAt) : Date.parse(session.updatedAt)) - Date.parse(session.startedAt) - session.totalPausedMs) / 60000)));
  const average = durationMinutes.length ? durationMinutes.reduce((sum, value) => sum + value, 0) / durationMinutes.length : 0;
  const longIds = new Set(sessions.filter((_, index) => (durationMinutes[index] ?? 0) > average).map((session) => session.id));
  const longDrift = interruptions.filter((item) => longIds.has(item.sessionId)).length;
  const evidence: ReviewEvidence = {
    top_interruption: `${categoryLabel(top[0])} was marked ${top[1]} time${top[1] === 1 ? "" : "s"} across ${new Set(interruptions.filter((item) => item.category === top[0]).map((item) => item.sessionId)).size} sessions.`,
    morning_completion: `${morningKept.length} of ${morning.length} sessions before 11:00 UTC protected the intention.`,
    long_session_drift: `${longDrift} distractions were marked in sessions longer than the weekly average of ${Math.round(average)} minutes.`,
    intention_kept: `${keptSessions.length} of ${sessions.length} sessions ended as completed or moved forward.`,
  };
  return { sessionCount: sessions.length, totalFocusedMinutes: durationMinutes.reduce((sum, value) => sum + value, 0), interruptionCount: interruptions.length, intentionKeptCount: keptSessions.length, categoryCounts: categories, sessionsBefore11Utc: morning.length, keptBefore11Utc: morningKept.length, averageSessionMinutes: Math.round(average), longSessionDistractions: longDrift, evidence };
}

export function categoryLabel(category: string) {
  return category.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());
}
