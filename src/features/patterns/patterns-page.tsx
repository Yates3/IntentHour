import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Clock3, Lightbulb } from "lucide-react";
import type { FocusSession, Interruption, InterruptionCategory } from "../../../shared/contracts";
import { apiFetch } from "../../lib/api";
import { getRecentSessions, localDb } from "../../lib/local-db";
import { elapsedMs, formatDuration } from "../../lib/time";

const labels: Record<InterruptionCategory, string> = { message: "Message", new_idea: "New idea", noise: "Noise", task_switch: "Task switch", other: "Other" };

export function PatternsPage({ pro, navigate }: { pro: boolean; navigate: (path: string) => void }) {
  const [sessions, setSessions] = useState<FocusSession[]>([]); const [marks, setMarks] = useState<Interruption[]>([]); const [review, setReview] = useState<ReviewResponse>(); const [reviewError, setReviewError] = useState<string>(); const [generating, setGenerating] = useState(false);
  useEffect(() => { void Promise.all([getRecentSessions(), localDb.interruptions.toArray()]).then(([s, i]) => {
    const bounds = previousIsoWeekBounds();
    const weekSessions = s.filter((item) => item.status === "completed" && item.startedAt >= bounds.start && item.startedAt < bounds.end);
    const ids = new Set(weekSessions.map((item) => item.id));
    setSessions(weekSessions);
    setMarks(i.filter((item) => ids.has(item.sessionId)));
  }); }, []);
  const stats = useMemo(() => buildStats(sessions, marks), [sessions, marks]);
  const week = previousIsoWeek();
  useEffect(() => { if (pro) void apiFetch<ReviewResponse>(`/api/reviews/${week}`).then(setReview).catch(() => undefined); }, [pro, week]);
  return <div className="patterns-page"><header className="patterns-header"><div><h1>WEEKLY PATTERNS</h1><p>You protected your intention in {stats.kept} of {stats.sessions.length} sessions.</p></div><span>PREVIOUS COMPLETE WEEK · {week}</span></header>
    <section className="metrics-row"><Metric value={String(stats.sessions.length)} label="SESSIONS" /><Metric value={formatDuration(stats.focusedMs).toUpperCase()} label="FOCUSED" /><Metric value={String(marks.length)} label="DISTRACTIONS" /><Metric accent value={`${stats.keptPercent}%`} label="INTENTION KEPT" /></section>
    <section className="week-rail"><h2>SESSION PATTERN</h2><div>{stats.days.map((day) => <article key={day.label}><strong>{day.label}</strong><span className={day.kept ? "kept" : day.count ? "changed" : "empty"}>{day.kept ? <Check /> : day.count ? <ArrowRight /> : "×"}</span><p>{day.count} {day.count === 1 ? "session" : "sessions"}<small>{day.duration ? formatDuration(day.duration) : "—"}</small></p></article>)}</div></section>
    <div className="pattern-grid"><section><h2>WHAT PULLED YOU AWAY</h2><div className="rank-list">{stats.ranked.map(([category, count]) => <div key={category}><span>{labels[category]}</span><strong>{count}</strong></div>)}</div></section><section className="suggestions"><h2>WHAT THE WEEK SUGGESTS</h2>{review ? review.insights.map((insight) => <article key={insight.headline}><Lightbulb /><div><h3>{insight.headline}</h3><p>{insight.suggestion}</p><small>{review.evidence[insight.evidenceKey]}</small></div></article>) : <div className="review-gate"><Clock3 /><h3>{pro ? "Generate a grounded weekly review" : "Weekly review is a Pro feature"}</h3><p>{pro ? "Only aggregate timing, outcomes, and interruption categories are sent. Your intention text and notes stay private." : "Unlock cloud history, CSV export, and one evidence-backed review per completed week."}</p>{pro ? <button className="button button-outline" disabled={generating || sessions.length < 3} onClick={() => { setGenerating(true); setReviewError(undefined); void apiFetch<ReviewResponse>(`/api/reviews/${week}/generate`, { method: "POST", body: JSON.stringify({}) }).then(setReview).catch((error: Error) => setReviewError(error.message)).finally(() => setGenerating(false)); }}>{generating ? "GENERATING…" : sessions.length < 3 ? "NEED 3 SESSIONS" : "GENERATE REVIEW"}</button> : <button className="button button-outline" onClick={() => navigate("/app/settings")}>UNLOCK PRO</button>}{reviewError ? <em>{reviewError}</em> : null}</div>}</section></div>
    <footer className="review-footer"><span>AI REVIEW · GROUNDED IN AGGREGATES · NO INTENTION TEXT</span>{pro ? <a className="button button-outline" href="/api/export.csv">EXPORT CSV</a> : null}</footer>
  </div>;
}

interface ReviewResponse { insights: Array<{ headline: string; suggestion: string; evidenceKey: string }>; evidence: Record<string, string>; generatedAt: string; model: string; }
function Metric({ value, label, accent }: { value: string; label: string; accent?: boolean }) { return <div className={accent ? "accent" : ""}><strong>{value}</strong><span>{label}</span></div>; }
function buildStats(sessions: FocusSession[], marks: Interruption[]) {
  const kept = sessions.filter((s) => s.outcome === "completed" || s.outcome === "moved_forward").length; const counts = new Map<InterruptionCategory, number>(); marks.forEach((mark) => counts.set(mark.category, (counts.get(mark.category) ?? 0) + 1));
  const ranked = (["new_idea", "message", "task_switch", "noise", "other"] as InterruptionCategory[]).map((key) => [key, counts.get(key) ?? 0] as const);
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((label, index) => { const daySessions = sessions.filter((session) => ((new Date(session.startedAt).getDay() + 6) % 7) === index); return { label, count: daySessions.length, duration: daySessions.reduce((sum, session) => sum + elapsedMs(session), 0), kept: daySessions.some((session) => session.outcome === "completed" || session.outcome === "moved_forward") }; });
  return { sessions, kept, keptPercent: sessions.length ? Math.round((kept / sessions.length) * 100) : 0, focusedMs: sessions.reduce((sum, session) => sum + elapsedMs(session), 0), ranked, days };
}
function previousIsoWeek() { const date = new Date(); date.setUTCDate(date.getUTCDate() - 7); const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() + 4 - day); const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7); return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`; }
function previousIsoWeekBounds() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const currentMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
  return {
    start: new Date(currentMonday.getTime() - 7 * 86400000).toISOString(),
    end: currentMonday.toISOString(),
  };
}
