import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react";
import { authClient } from "../lib/auth-client";
import { Brand } from "../components/brand";
import { TurnstileWidget } from "../components/turnstile-widget";
import { getPublicConfig, type PublicConfig } from "../lib/public-config";

export function SignInPage({ navigate }: { navigate: (path: string) => void }) {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState<string>(); const [busy, setBusy] = useState(false); const [turnstileToken, setTurnstileToken] = useState(""); const [config, setConfig] = useState<PublicConfig>(); const next = new URLSearchParams(location.search).get("next") || "/app";
  const onTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);
  const requiresTurnstile = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
  useEffect(() => { void getPublicConfig().then(setConfig).catch(() => setMessage("Could not check sign-in availability.")); }, []);
  const signInWithGoogle = async () => {
    if (!config?.googleSignIn) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: next });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in could not start.");
    } catch (error) {
      setMessage((error as Error).message || "Google sign-in could not start.");
      setBusy(false);
    }
  };
  const sendLink = async () => { setBusy(true); setMessage(undefined); try { const response = await fetch("/api/auth/sign-in/magic-link", { method: "POST", credentials: "include", headers: { "content-type": "application/json", ...(turnstileToken ? { "x-turnstile-token": turnstileToken } : {}) }, body: JSON.stringify({ email, callbackURL: next, newUserCallbackURL: next, errorCallbackURL: "/signin" }) }); if (!response.ok) throw new Error("Could not send the secure sign-in link."); setMessage("Check your inbox. The secure link expires in five minutes."); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } };
  return <div className="auth-page"><header><Brand /><button className="text-button" onClick={() => navigate("/")}><ArrowLeft /> Back home</button></header><main><div className="auth-lock"><LockKeyhole /></div><h1>Keep your patterns<br />with you.</h1><p>Sign in to sync completed sessions, unlock lifetime history, and generate grounded weekly reviews.</p><button className="button google-button" disabled={busy || !config?.googleSignIn} onClick={() => void signInWithGoogle()}><span>G</span> {config?.googleSignIn ? "CONTINUE WITH GOOGLE" : "GOOGLE SIGN-IN — SETUP REQUIRED"}</button>{config && !config.googleSignIn ? <p className="provider-status">Google OAuth credentials have not been connected to this environment.</p> : null}<div className="auth-divider"><span>OR</span></div><form onSubmit={(event) => { event.preventDefault(); void sendLink(); }}><label>EMAIL ADDRESS<div><Mail /><input required disabled={!config?.magicLinkSignIn} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></label>{config?.magicLinkSignIn ? <TurnstileWidget onToken={onTurnstileToken} /> : null}<button className="button button-outline" disabled={busy || !config?.magicLinkSignIn || !email || (requiresTurnstile && !turnstileToken)} type="submit">{config?.magicLinkSignIn ? "EMAIL ME A SECURE LINK" : "EMAIL SIGN-IN — SETUP REQUIRED"}</button></form>{config && !config.magicLinkSignIn ? <p className="provider-status">The email delivery provider has not been connected yet.</p> : null}{message ? <div className="auth-message">{message}</div> : null}<button className="text-button continue-local" onClick={() => navigate(next)}>CONTINUE WITH LOCAL FREE MODE</button><small><LockKeyhole /> No password to remember. Links are single-use and expire in five minutes.</small></main></div>;
}
