import { useEffect, useState } from "react";
import { CheckCircle2, CircleSlash2, Lightbulb, MessageSquare } from "lucide-react";
import type { FocusSession, Interruption } from "../../../shared/contracts";
import { getRecentSessions, localDb } from "../../lib/local-db";
import { elapsedMs, formatDuration } from "../../lib/time";

export function SessionsPage() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [interruptions, setInterruptions] = useState<Interruption[]>([]);
  useEffect(() => { void Promise.all([getRecentSessions(), localDb.interruptions.toArray()]).then(([nextSessions, marks]) => { setSessions(nextSessions); setInterruptions(marks); }); }, []);
  return <div className="list-page"><header className="page-title"><div><h1>SESSIONS</h1><p>Every chosen outcome and what happened next.</p></div><strong>LOCAL · LAST 7 DAYS</strong></header>
    {sessions.length === 0 ? <EmptySessions /> : <div className="session-list">{sessions.filter((session) => session.status !== "running" && session.status !== "paused").map((session) => { const marks = interruptions.filter((item) => item.sessionId === session.id); return <article key={session.id}><div className="session-result-icon">{session.status === "completed" ? <CheckCircle2 /> : <CircleSlash2 />}</div><div className="session-summary"><time>{new Date(session.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {new Date(session.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><h2>{session.intention}</h2><p>{session.outcome ? session.outcome.replaceAll("_", " ") : "Discarded"} · {formatDuration(elapsedMs(session))}</p></div><div className="session-marks"><span><MessageSquare />{marks.filter((item) => item.category === "message").length}</span><span><Lightbulb />{marks.filter((item) => item.category === "new_idea").length}</span><strong>{marks.length} DISTRACTIONS</strong></div></article>; })}</div>}
  </div>;
}

function EmptySessions() { return <div className="empty-state"><span className="form-orbit" /><h2>Your record starts with one outcome.</h2><p>Complete a focus session and it will appear here for seven days.</p><a className="button button-outline" href="/app">START A SESSION</a></div>; }
