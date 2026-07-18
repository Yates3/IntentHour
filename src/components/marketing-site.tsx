import {
  ArrowRight,
  BarChart3,
  Check,
  Cloud,
  Lightbulb,
  LockKeyhole,
  MessageSquare,
  Monitor,
  Pause,
  Play,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "./brand";

interface MarketingSiteProps {
  navigate: (path: string) => void;
}

export function MarketingSite({ navigate }: MarketingSiteProps) {
  return (
    <div className="marketing-page">
      <header className="marketing-header page-shell">
        <Brand />
        <nav aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#patterns">Patterns</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="header-actions">
          <button className="text-button" onClick={() => navigate("/signin")}>Sign in</button>
          <button className="button button-outline" onClick={() => navigate("/app")}>Open app</button>
        </div>
      </header>

      <main>
        <section className="hero page-shell">
          <div className="hero-copy">
            <h1>Protect the<br />work you chose.</h1>
            <p>Set one outcome. Catch the drift.<br />Finish with a record you can learn from.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => navigate("/app")}>Start a free session <ArrowRight size={21} /></button>
              <a className="button button-secondary" href="#how-it-works"><Play size={18} /> Watch the flow</a>
            </div>
            <div className="privacy-note">
              <LockKeyhole size={19} />
              <span><strong>LOCAL · PRIVATE</strong><small>Your data stays on your device.</small></span>
            </div>
          </div>

          <div className="hero-instrument" aria-label="IntentHour focus session preview">
            <div className="instrument-heading"><span><i /> ACTIVE SESSION</span><BarChart3 size={20} /></div>
            <div className="instrument-body">
              <div className="timer-preview">
                <div className="timer-dial" style={{ "--progress": "74%" } as React.CSSProperties}>
                  <div><small>INTENTION</small><strong>Finish launch narrative</strong><time>34:18</time><small>50 MIN TARGET</small><button aria-label="Pause preview"><Pause size={27} fill="currentColor" /></button></div>
                </div>
                <p>Stay with your outcome. Mark distractions. Close the loop.</p>
              </div>
              <aside className="preview-interruptions">
                <h2>INTERRUPTIONS</h2>
                <div><time>09:14</time><span>Message</span><MessageSquare size={18} /></div>
                <div><time>09:27</time><span>New idea</span><Lightbulb size={18} /></div>
                <button className="button button-outline" onClick={() => navigate("/app")}>MARK DISTRACTION</button>
              </aside>
            </div>
          </div>
        </section>

        <section className="workflow-section page-shell" id="how-it-works">
          <div className="section-intro">
            <h2>A focus system that<br />never watches your screen.</h2>
            <p>IntentHour compares what you planned with what actually happened—<br />without tracking apps, reading your screen, or grading your day.</p>
          </div>
          <div className="workflow-frame">
            <WorkflowStep number="01" verb="SET" title="Choose one outcome" body="Write the result you want before the clock starts.">
              <div className="demo-field"><small>INTENTION</small><span>Finish launch narrative</span></div>
            </WorkflowStep>
            <WorkflowStep number="02" verb="CATCH" title="Mark the drift" body="Log an interruption in one tap, then return to the work.">
              <div className="choice-row">
                <span><MessageSquare />Message</span><span className="selected"><Lightbulb />New idea</span><span>•••<small>Other</small></span>
              </div>
            </WorkflowStep>
            <WorkflowStep number="03" verb="CLOSE" title="Record the result" body="Note what moved forward and what got in the way.">
              <div className="outcome-row"><span className="selected"><Check />Moved forward</span><span>Got in the way</span></div>
            </WorkflowStep>
          </div>
          <div className="local-first-band">
            <div className="lock-orbit"><LockKeyhole /></div>
            <div><h3>Local first. Cloud when you choose.</h3><p>Free sessions stay on this device for seven days.<br />Pro adds account-based sync, unlimited history, and grounded weekly reviews.</p></div>
            <strong><ShieldCheck /> NO SCREEN<br />MONITORING</strong>
            <div className="device-cloud"><span><Monitor />This device</span><i /><span><Cloud />Encrypted cloud</span></div>
          </div>
        </section>

        <section className="pricing-section page-shell" id="pricing">
          <div className="section-intro centered"><h2>Start free. Upgrade when your history matters.</h2><p>No account is required to run a session. Pay once when you want your patterns to follow you.</p></div>
          <div className="pricing-frame">
            <PriceColumn title="FREE" price="$0" caption="NO ACCOUNT" features={["Unlimited focus sessions", "Local 7-day history", "Distraction notes", "Session close-out"]} cta="START FREE" onClick={() => navigate("/app")} />
            <div className="price-divider"><span>+</span></div>
            <PriceColumn pro title="PRO LIFETIME" price="$39" caption="ONE PAYMENT" features={["Everything in Free", "Cloud sync across devices", "Unlimited history and trends", "AI-assisted weekly review", "CSV data export"]} cta="GET PRO LIFETIME" onClick={() => navigate("/signin?next=/app/settings")} />
            <p className="secure-checkout"><LockKeyhole size={14} /> Secure checkout by Paddle. Taxes calculated at checkout.</p>
          </div>
          <div className="closing-band"><div className="lock-orbit small"><LockKeyhole /></div><div><h3>Your time already leaves a pattern.</h3><p>IntentHour helps you see it without watching everything you do.</p></div><button className="button button-outline" onClick={() => navigate("/app")}>START YOUR FIRST SESSION</button></div>
        </section>
      </main>

      <footer className="site-footer page-shell"><Brand compact /><nav><a href="/app">Product</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/contact">Contact</a></nav><span>© 2026 IntentHour</span></footer>
    </div>
  );
}

function WorkflowStep({ number, verb, title, body, children }: { number: string; verb: string; title: string; body: string; children: React.ReactNode }) {
  return <article className="workflow-step"><div className="step-label"><b>{number}</b><strong>{verb}</strong><i /></div><h3>{title}</h3><p>{body}</p>{children}</article>;
}

function PriceColumn({ title, price, caption, features, cta, pro, onClick }: { title: string; price: string; caption: string; features: string[]; cta: string; pro?: boolean; onClick: () => void }) {
  return <article className={`price-column ${pro ? "pro" : ""}`}><h3>{title}</h3><strong className="price">{price}</strong><small>{caption}</small><ul>{features.map((feature) => <li key={feature}><Check size={16} />{feature}</li>)}</ul><button className="button button-outline" onClick={onClick}>{cta}</button></article>;
}
