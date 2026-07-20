import { useEffect, useState } from "react";
import { Check, Cloud, Crown, Download, LockKeyhole, ShieldCheck, Trash2 } from "lucide-react";
import { authClient } from "../../lib/auth-client";
import { apiFetch } from "../../lib/api";
import type { EntitlementState } from "../../hooks/use-entitlement";
import { waitForProEntitlement } from "../../lib/entitlement-polling";
import { openProCheckout } from "../../lib/paddle";

export function SettingsPage({ pro, refreshEntitlement, navigate }: { pro: boolean; refreshEntitlement: () => Promise<EntitlementState>; navigate: (path: string) => void }) {
  const { data: session, isPending } = authClient.useSession(); const [message, setMessage] = useState<string>(); const [aiEnabled, setAiEnabled] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session?.user || !pro) {
      setAiEnabled(false);
      return;
    }
    void apiFetch<{ enabled: boolean }>("/api/me/preferences")
      .then((preference) => setAiEnabled(preference.enabled))
      .catch(() => undefined);
  }, [pro, session?.user]);
  const saveConsent = async (enabled: boolean) => { setBusy(true); setMessage(undefined); try { await apiFetch("/api/me/preferences", { method: "PUT", body: JSON.stringify({ enabled, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, policyVersion: "2026-07-18.v1" }) }); setAiEnabled(enabled); setMessage(enabled ? "AI review consent saved." : "AI review disabled."); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } };
  return <div className="settings-page"><header className="page-title"><div><h1>SETTINGS</h1><p>Account, cloud history, privacy, and lifetime access.</p></div><strong><LockKeyhole /> LOCAL · PRIVATE</strong></header>
    <section className="settings-section"><div><h2>ACCOUNT</h2><p>{isPending ? "Checking account…" : session?.user ? `Signed in as ${session.user.email}` : "Free sessions work without an account."}</p></div>{session?.user ? <button className="button button-secondary" onClick={() => void authClient.signOut().then(() => navigate("/"))}>SIGN OUT</button> : <button className="button button-outline" onClick={() => navigate("/signin?next=/app/settings")}>SIGN IN</button>}</section>
    <section className="pro-settings"><div className="pro-copy"><Crown /><h2>{pro ? "PRO LIFETIME ACTIVE" : "KEEP YOUR PATTERNS WITH YOU"}</h2><p>{pro ? "Cloud sync, unlimited history, weekly reviews, and CSV export are unlocked for IntentHour v1.x." : "One payment. Cloud sync, unlimited history, grounded weekly reviews, and CSV export."}</p><strong>{pro ? "PURCHASE VERIFIED BY PADDLE" : "$39 · ONE PAYMENT"}</strong></div><ul><li><Check /> Everything in Free</li><li><Cloud /> Sync completed sessions</li><li><ShieldCheck /> Aggregate-only AI review</li><li><Download /> CSV data export</li></ul>{pro ? <a className="button button-outline" href="/api/export.csv">EXPORT CSV</a> : <button className="button button-primary" disabled={!session?.user || busy} onClick={() => { if (!session?.user) { navigate("/signin?next=/app/settings"); return; } setBusy(true); setMessage(undefined); void openProCheckout(async () => { setBusy(true); setMessage("Payment received. Waiting for secure activation…"); const active = await waitForProEntitlement(refreshEntitlement); setMessage(active ? "Pro Lifetime activated. Cloud sync is now available." : "Payment is still processing. Your access will unlock automatically after Paddle confirms it."); setBusy(false); }).catch((error: Error) => setMessage(error.message)).finally(() => setBusy(false)); }}>{session?.user ? "GET PRO LIFETIME" : "SIGN IN TO UPGRADE"}</button>}</section>
    <section className="settings-section"><div><h2>AI WEEKLY REVIEW</h2><p>Only aggregate durations, outcomes, hour buckets, and interruption categories are sent. Intentions, notes, and email stay out.</p></div><button className={`toggle ${aiEnabled ? "on" : ""}`} disabled={!pro || busy} aria-pressed={aiEnabled} onClick={() => void saveConsent(!aiEnabled)}><span /></button></section>
    <section className="settings-section danger-zone"><div><h2>DELETE ACCOUNT DATA</h2><p>Permanently remove your IntentHour account, sessions, interruptions, reviews, and app entitlement record.</p></div><button className="button button-secondary danger" disabled={!session?.user || busy} onClick={() => { if (!confirm("Delete all IntentHour account data? This cannot be undone.")) return; setBusy(true); void apiFetch("/api/me", { method: "DELETE", body: "{}" }).then(() => navigate("/")).catch((error: Error) => setMessage(error.message)).finally(() => setBusy(false)); }}><Trash2 /> DELETE DATA</button></section>
    {message ? <div className="settings-message">{message}</div> : null}
  </div>;
}
