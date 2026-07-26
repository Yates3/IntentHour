import {
  ArrowLeft,
  Check,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Clock3,
  History,
  Lightbulb,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import type {
  FocusSession,
  InterruptionCategory,
  SessionOutcome,
} from "../../../shared/contracts";
import { getElapsedMs } from "../../../shared/focus-time";
import { useDesktopFocus } from "./use-desktop-focus";

const durations = [25, 40, 50, 75, 90];
const categories: Array<{
  value: InterruptionCategory;
  label: string;
  icon: typeof MessageSquare;
}> = [
  { value: "message", label: "Message", icon: MessageSquare },
  { value: "new_idea", label: "New idea", icon: Lightbulb },
  { value: "noise", label: "Noise", icon: Volume2 },
  { value: "task_switch", label: "Task switch", icon: Zap },
  { value: "other", label: "Other", icon: MoreHorizontal },
];
const outcomes: Array<{ value: SessionOutcome; label: string }> = [
  { value: "completed", label: "Completed" },
  { value: "moved_forward", label: "Moved forward" },
  { value: "changed_direction", label: "Changed direction" },
  { value: "blocked", label: "Blocked" },
];

function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatWorked(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  const seconds = Math.floor((Math.max(0, ms) % 60_000) / 1_000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function runtimeText(): string {
  const runtime = window.intentHourDesktop?.runtime;
  return runtime
    ? `${runtime.platform} · Electron ${runtime.electronVersion}`
    : "Desktop runtime";
}

function Brand({ onHistory }: { onHistory: () => void }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-ring"><Clock3 size={16} /></span>
        <span>IntentHour</span>
        <span className="desktop-label">Desktop · Local</span>
      </div>
      <button className="quiet-button" type="button" onClick={onHistory}>
        <History size={16} />
        History
      </button>
    </header>
  );
}

function SetupView({
  historyCount,
  error,
  onStart,
  onHistory,
}: {
  historyCount: number;
  error?: string;
  onStart: (intention: string, targetMinutes: number) => Promise<boolean>;
  onHistory: () => void;
}) {
  const [intention, setIntention] = useState("");
  const [targetMinutes, setTargetMinutes] = useState(50);
  const [saving, setSaving] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    void onStart(intention, targetMinutes).finally(() => setSaving(false));
  };

  return (
    <div className="app-shell">
      <Brand onHistory={onHistory} />
      <main className="setup-layout">
        <section className="setup-copy">
          <p className="eyebrow">DEVICE-LOCAL FOCUS</p>
          <h1>Protect the work<br />you chose.</h1>
          <p className="lede">
            Choose one concrete outcome. The timer, interruptions, and history
            stay on this Windows device.
          </p>
          <button className="history-link" type="button" onClick={onHistory}>
            <span>{historyCount}</span>
            ended {historyCount === 1 ? "session" : "sessions"} on this device
            <ChevronRight size={16} />
          </button>
        </section>

        <form className="start-card" onSubmit={submit}>
          <div className="card-index">01 / INTENTION</div>
          <label htmlFor="intention">What will be true when this session ends?</label>
          <textarea
            id="intention"
            data-testid="intention-input"
            maxLength={240}
            placeholder="Example: Finish the onboarding flow draft"
            value={intention}
            onChange={(event) => setIntention(event.target.value)}
            autoFocus
          />
          <div className="field-meta">
            <span>One observable outcome</span>
            <span>{intention.length}/240</span>
          </div>

          <fieldset>
            <legend>Target duration</legend>
            <div className="duration-options">
              {durations.map((duration) => (
                <button
                  className={duration === targetMinutes ? "selected" : ""}
                  type="button"
                  key={duration}
                  onClick={() => setTargetMinutes(duration)}
                >
                  {duration}<small>min</small>
                </button>
              ))}
            </div>
          </fieldset>

          {error ? <p className="error-banner" role="alert">{error}</p> : null}
          <button
            className="primary-button"
            data-testid="start-session"
            disabled={saving || intention.trim().length === 0}
            type="submit"
          >
            {saving ? "Saving…" : "Begin focus"}
            <ChevronRight size={18} />
          </button>
          <p className="local-note">
            <span className="status-dot" />
            No account. No cloud. Reload-safe local state.
          </p>
        </form>
      </main>
      <footer className="footer-line">
        <span id="runtime">{runtimeText()}</span>
        <span>Local data only</span>
      </footer>
    </div>
  );
}

function InterruptionPanel({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (category: InterruptionCategory, note?: string) => Promise<boolean>;
}) {
  const [category, setCategory] = useState<InterruptionCategory>("message");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    void onSave(category, note).then((saved) => {
      if (saved) onClose();
    }).finally(() => setSaving(false));
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="side-panel" onSubmit={submit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">MARK THE MOMENT</p>
            <h2>What pulled at your attention?</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>
        <div className="category-grid">
          {categories.map(({ value, label, icon: Icon }) => (
            <button
              className={category === value ? "category selected" : "category"}
              type="button"
              key={value}
              onClick={() => setCategory(value)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
        <label htmlFor="interruption-note">Optional note</label>
        <textarea
          id="interruption-note"
          maxLength={300}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Keep it brief. This stays on this device."
        />
        <button className="primary-button" data-testid="save-interruption" disabled={saving} type="submit">
          Save interruption
          <Check size={18} />
        </button>
      </form>
    </div>
  );
}

function FinishPanel({
  onClose,
  onFinish,
}: {
  onClose: () => void;
  onFinish: (outcome: SessionOutcome, note?: string) => Promise<boolean>;
}) {
  const [outcome, setOutcome] = useState<SessionOutcome>("completed");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    void onFinish(outcome, note).then((saved) => {
      if (saved) onClose();
    }).finally(() => setSaving(false));
  };

  return (
    <div className="modal-backdrop centered" role="presentation">
      <form className="finish-panel" onSubmit={submit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">CLOSE THE LOOP</p>
            <h2>What changed because you focused?</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>
        <div className="outcome-list">
          {outcomes.map(({ value, label }) => (
            <button
              className={outcome === value ? "outcome selected" : "outcome"}
              type="button"
              key={value}
              onClick={() => setOutcome(value)}
            >
              <span>{label}</span>
              {outcome === value ? <Check size={17} /> : null}
            </button>
          ))}
        </div>
        <label htmlFor="outcome-note">Optional result note</label>
        <textarea
          id="outcome-note"
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="A short factual note for your local history"
        />
        <button className="primary-button" data-testid="confirm-finish" disabled={saving} type="submit">
          Save result
          <Check size={18} />
        </button>
      </form>
    </div>
  );
}

function ActiveView({
  session,
  elapsedMs,
  remainingMs,
  interruptionCount,
  error,
  targetReminderSent,
  onHistory,
  onTogglePause,
  onInterruption,
  onFinish,
  onDiscard,
}: {
  session: FocusSession;
  elapsedMs: number;
  remainingMs: number;
  interruptionCount: number;
  error?: string;
  targetReminderSent: boolean;
  onHistory: () => void;
  onTogglePause: () => Promise<boolean>;
  onInterruption: () => void;
  onFinish: () => void;
  onDiscard: () => Promise<boolean>;
}) {
  const targetReached = elapsedMs >= session.targetMinutes * 60_000;
  const paused = session.status === "paused";

  return (
    <div className={paused ? "app-shell active-shell is-paused" : "app-shell active-shell"}>
      <Brand onHistory={onHistory} />
      <main className="focus-layout">
        <section className="focus-context">
          <p className="eyebrow">{paused ? "SESSION PAUSED" : "FOCUS IN PROGRESS"}</p>
          <p className="intention-label">Chosen outcome</p>
          <h1 data-testid="active-intention">{session.intention}</h1>
          <div className="session-metrics">
            <div>
              <span>Target</span>
              <strong>{session.targetMinutes} min</strong>
            </div>
            <div>
              <span>Focused</span>
              <strong data-testid="elapsed-work">{formatWorked(elapsedMs)}</strong>
            </div>
            <div>
              <span>Interruptions</span>
              <strong data-testid="interruption-count">{interruptionCount}</strong>
            </div>
          </div>
        </section>

        <section className="timer-stage" aria-live="polite">
          <div className="timer-orbit">
            <span className="orbit-marker" />
            <div>
              <p>{paused ? "Time held" : targetReached ? "Target reached" : "Remaining"}</p>
              <strong data-testid="remaining-time">{formatClock(remainingMs)}</strong>
              <span>{paused ? "Resume when you are ready" : targetReached ? "Keep going or close the loop" : "Wall-clock corrected"}</span>
            </div>
          </div>

          {error ? <p className="error-banner" role="alert">{error}</p> : null}
          <div className="focus-actions">
            <button
              className="pause-button"
              data-testid="toggle-pause"
              type="button"
              onClick={() => void onTogglePause()}
            >
              {paused ? <CirclePlay size={20} /> : <CirclePause size={20} />}
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              className="mark-button"
              data-testid="open-interruption"
              type="button"
              disabled={paused}
              onClick={onInterruption}
            >
              <Sparkles size={19} />
              Mark interruption
            </button>
          </div>
          <div className="termination-actions">
            <button type="button" data-testid="discard-session" onClick={() => void onDiscard()}>
              Discard
            </button>
            <button type="button" data-testid="finish-session" onClick={onFinish}>
              Finish session
              <ChevronRight size={17} />
            </button>
          </div>
        </section>
      </main>
      <footer className="footer-line">
        <span id="runtime">{runtimeText()}</span>
        <span
          className="save-state"
          data-testid="target-reminder-status"
        >
          <i />
          {targetReminderSent
            ? "Target reminder sent - session stays open"
            : "Saved on this device"}
        </span>
      </footer>
    </div>
  );
}

function HistoryView({
  sessions,
  interruptionCounts,
  onBack,
}: {
  sessions: FocusSession[];
  interruptionCounts: Record<string, number>;
  onBack: () => void;
}) {
  return (
    <div className="app-shell history-shell">
      <header className="topbar">
        <button className="quiet-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="brand compact">
          <span className="brand-ring"><Clock3 size={16} /></span>
          <span>Local history</span>
        </div>
        <span className="desktop-label">{sessions.length} ended</span>
      </header>
      <main className="history-layout">
        <div className="history-heading">
          <div>
            <p className="eyebrow">THIS WINDOWS DEVICE</p>
            <h1>Work you chose,<br />kept as facts.</h1>
          </div>
          <p>
            Completed and discarded sessions remain in this Desktop database.
            No cloud account is connected.
          </p>
        </div>
        {sessions.length === 0 ? (
          <section className="empty-history">
            <History size={26} />
            <h2>No ended sessions yet</h2>
            <p>Complete or discard a focus session to build local history.</p>
          </section>
        ) : (
          <div className="history-list" data-testid="history-list">
            {sessions.map((item, index) => {
              const endedMs = item.endedAt
                ? Date.parse(item.endedAt)
                : Date.parse(item.updatedAt);
              return (
                <article className="history-row" key={item.id}>
                  <span className="row-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="history-intention">
                    <strong>{item.intention}</strong>
                    <span>
                      {formatDate(item.startedAt)} → {item.endedAt ? formatDate(item.endedAt) : "—"}
                    </span>
                  </div>
                  <div>
                    <span>Target</span>
                    <strong>{item.targetMinutes} min</strong>
                  </div>
                  <div>
                    <span>Focused</span>
                    <strong>{formatWorked(getElapsedMs(item, endedMs))}</strong>
                  </div>
                  <div>
                    <span>Result</span>
                    <strong>{item.status === "discarded" ? "Discarded" : item.outcome?.replaceAll("_", " ")}</strong>
                  </div>
                  <div>
                    <span>Marks</span>
                    <strong>{interruptionCounts[item.id] ?? 0}</strong>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <footer className="footer-line">
        <span id="runtime">{runtimeText()}</span>
        <span>Independent Desktop storage</span>
      </footer>
    </div>
  );
}

export function DesktopApp() {
  const focus = useDesktopFocus();
  const [view, setView] = useState<"focus" | "history">("focus");
  const [panel, setPanel] = useState<"interruption" | "finish">();

  const history = useMemo(() => focus.history, [focus.history]);

  if (!focus.ready) {
    return (
      <main className="loading-screen">
        <span className="brand-ring"><Clock3 size={18} /></span>
        <p>Restoring local focus state…</p>
      </main>
    );
  }

  if (view === "history" && !focus.session) {
    return (
      <HistoryView
        sessions={history}
        interruptionCounts={focus.historyInterruptionCounts}
        onBack={() => setView("focus")}
      />
    );
  }

  return (
    <>
      {focus.session ? (
        <ActiveView
          session={focus.session}
          elapsedMs={focus.elapsedMs}
          remainingMs={focus.remainingMs}
          interruptionCount={focus.interruptions.length}
          error={focus.error}
          targetReminderSent={focus.targetReminderSent}
          onHistory={() => setView("history")}
          onTogglePause={focus.togglePause}
          onInterruption={() => setPanel("interruption")}
          onFinish={() => setPanel("finish")}
          onDiscard={focus.discard}
        />
      ) : (
        <SetupView
          historyCount={history.length}
          error={focus.error}
          onHistory={() => setView("history")}
          onStart={(intention, targetMinutes) =>
            focus.start({ intention, targetMinutes })}
        />
      )}
      {panel === "interruption" ? (
        <InterruptionPanel
          onClose={() => setPanel(undefined)}
          onSave={focus.markInterruption}
        />
      ) : null}
      {panel === "finish" ? (
        <FinishPanel
          onClose={() => setPanel(undefined)}
          onFinish={focus.finish}
        />
      ) : null}
    </>
  );
}
