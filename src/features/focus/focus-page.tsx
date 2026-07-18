import { useEffect, useState } from "react";
import { Check, ChevronRight, Lightbulb, MessageSquare, MoreHorizontal, Pause, Play, Volume2 } from "lucide-react";
import type { InterruptionCategory, SessionOutcome } from "../../../shared/contracts";
import { useFocusSession } from "../../hooks/use-focus-session";
import { formatClock } from "../../lib/time";

const categories: Array<{ id: InterruptionCategory; label: string; icon: React.ReactNode }> = [
  { id: "message", label: "Message", icon: <MessageSquare /> },
  { id: "new_idea", label: "New idea", icon: <Lightbulb /> },
  { id: "noise", label: "Noise", icon: <Volume2 /> },
  { id: "task_switch", label: "Task switch", icon: <ChevronRight /> },
  { id: "other", label: "Other", icon: <MoreHorizontal /> },
];

export function FocusPage() {
  const focus = useFocusSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<InterruptionCategory>("new_idea");
  const [note, setNote] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key.toLowerCase() !== "d" || target?.matches("input, textarea, select, [contenteditable=true]")) return;
      if (focus.session) {
        event.preventDefault();
        setDrawerOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus.session]);

  if (!focus.ready) return <div className="screen-center muted">Restoring your focus record…</div>;
  if (!focus.session) return <NewSession onStart={focus.start} />;

  const progress = Math.max(0, Math.min(1, focus.remaining / (focus.session.targetMinutes * 60_000)));
  return <div className="focus-screen">
    <header className="app-topbar"><span><i /> ACTIVE SESSION</span><strong>{focus.session.status === "paused" ? "PAUSED" : "LOCAL TIMER"}</strong></header>
    <div className="focus-workspace">
      <main className="focus-main">
        <div className="live-timer" style={{ "--progress": `${progress * 100}%` } as React.CSSProperties}>
          <div><small>INTENTION</small><h1>{focus.session.intention}</h1><time aria-live="off">{formatClock(focus.remaining)}</time><small>{focus.session.targetMinutes} MIN TARGET</small></div>
        </div>
        <div className="timer-controls"><button className="button button-secondary" onClick={() => void focus.togglePause()}>{focus.session.status === "paused" ? <Play /> : <Pause />}{focus.session.status === "paused" ? "RESUME" : "PAUSE"}</button><button className="button button-secondary" onClick={() => setFinishOpen(true)}>END SESSION</button></div>
        <button className="button button-outline mark-button" onClick={() => setDrawerOpen(true)}>MARK DISTRACTION</button>
        <p className="return-copy">One tap. Then return to the work.</p><small className="shortcut"><kbd>D</kbd> MARK DISTRACTION</small>
      </main>
      <aside className="interruption-rail"><h2>INTERRUPTIONS</h2>{focus.interruptions.length === 0 ? <p>No drift marked. Stay with the outcome.</p> : focus.interruptions.map((item) => <div key={item.id}><time>{new Date(item.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><span>{categories.find((category) => category.id === item.category)?.label}</span></div>)}<strong>{focus.interruptions.length} MARKED</strong></aside>
    </div>
    {drawerOpen ? <div className="drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setDrawerOpen(false); }}><aside className="distraction-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><button className="drawer-close" aria-label="Close" onClick={() => setDrawerOpen(false)}>×</button><h2 id="drawer-title">WHAT PULLED YOU AWAY?</h2><p>Choose one. Add context after the session.</p><div className="drawer-options">{categories.map((category) => <button key={category.id} className={selectedCategory === category.id ? "selected" : ""} onClick={() => setSelectedCategory(category.id)}>{category.icon}<span>{category.label}</span><i /></button>)}</div><label className="note-field">Optional note<textarea value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="Keep it brief. Return to the work." /></label><div className="drawer-actions"><button className="button button-secondary" onClick={() => setDrawerOpen(false)}>CANCEL</button><button className="button button-outline" onClick={() => void focus.markInterruption(selectedCategory, note).then(() => { setNote(""); setDrawerOpen(false); })}>MARK AND RETURN</button></div><small className="shortcut"><kbd>D</kbd> MARK DISTRACTION</small></aside></div> : null}
    {finishOpen ? <FinishDialog onCancel={() => setFinishOpen(false)} onFinish={(outcome, outcomeNote) => void focus.finish(outcome, outcomeNote).then(() => setFinishOpen(false))} onDiscard={() => void focus.discard().then(() => setFinishOpen(false))} /> : null}
  </div>;
}

function NewSession({ onStart }: { onStart: (input: { intention: string; targetMinutes: number }) => Promise<void> }) {
  const [intention, setIntention] = useState("");
  const [targetMinutes, setTargetMinutes] = useState(50);
  return <div className="new-session-screen"><div className="session-form"><span className="form-orbit" aria-hidden="true" /><h1>What will be true<br />when this session ends?</h1><p>Choose one concrete outcome. You can mark the drift without leaving the work.</p><form onSubmit={(event) => { event.preventDefault(); if (intention.trim()) void onStart({ intention, targetMinutes }); }}><label>INTENTION<input autoFocus value={intention} maxLength={240} onChange={(event) => setIntention(event.target.value)} placeholder="Finish launch narrative" /></label><label>TARGET DURATION<select value={targetMinutes} onChange={(event) => setTargetMinutes(Number(event.target.value))}><option value={25}>25 minutes</option><option value={40}>40 minutes</option><option value={50}>50 minutes</option><option value={75}>75 minutes</option><option value={90}>90 minutes</option></select></label><button className="button button-primary" type="submit" disabled={!intention.trim()}>START FOCUS SESSION <ChevronRight /></button></form><small><Check /> No account. No screen monitoring. Stored locally.</small></div></div>;
}

function FinishDialog({ onCancel, onFinish, onDiscard }: { onCancel: () => void; onFinish: (outcome: SessionOutcome, note?: string) => void; onDiscard: () => void }) {
  const outcomes: Array<{ id: SessionOutcome; label: string }> = [{ id: "completed", label: "Completed" }, { id: "moved_forward", label: "Moved forward" }, { id: "changed_direction", label: "Changed direction" }, { id: "blocked", label: "Got in the way" }];
  const [selected, setSelected] = useState<SessionOutcome>("moved_forward"); const [note, setNote] = useState("");
  return <div className="modal-backdrop"><div className="finish-dialog" role="dialog" aria-modal="true"><h2>CLOSE THE LOOP</h2><p>What happened to the outcome you chose?</p><div className="outcome-grid">{outcomes.map((outcome) => <button key={outcome.id} className={selected === outcome.id ? "selected" : ""} onClick={() => setSelected(outcome.id)}><Check />{outcome.label}</button>)}</div><label>OPTIONAL NOTE<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="What helped or got in the way?" /></label><div className="finish-actions"><button className="text-button danger" onClick={onDiscard}>Discard session</button><span /><button className="button button-secondary" onClick={onCancel}>KEEP FOCUSING</button><button className="button button-outline" onClick={() => onFinish(selected, note)}>SAVE RESULT</button></div></div></div>;
}
