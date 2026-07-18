import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, type AppView } from "./components/app-shell";
import { MarketingSite } from "./components/marketing-site";
import { FocusPage } from "./features/focus/focus-page";
import { PatternsPage } from "./features/patterns/patterns-page";
import { SessionsPage } from "./features/sessions/sessions-page";
import { SettingsPage } from "./features/settings/settings-page";
import { useEntitlement } from "./hooks/use-entitlement";
import { syncCompletedSessions } from "./lib/sync";
import { ContactPage, LegalPage } from "./pages/legal-page";
import { SignInPage } from "./pages/sign-in-page";

function useLocationPath() {
  const [path, setPath] = useState(() => `${location.pathname}${location.search}`);
  useEffect(() => { const onPop = () => setPath(`${location.pathname}${location.search}`); window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, []);
  const navigate = useCallback((next: string) => { history.pushState(null, "", next); setPath(next); window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  return { path, navigate };
}

export default function App() {
  const { path, navigate } = useLocationPath(); const { entitlement, refresh } = useEntitlement();
  useEffect(() => { if (entitlement.pro) void syncCompletedSessions().catch(() => undefined); }, [entitlement.pro]);
  const pathname = path.split("?")[0] ?? "/";
  const view = useMemo<AppView>(() => pathname === "/app/sessions" ? "sessions" : pathname === "/app/patterns" ? "patterns" : pathname === "/app/settings" ? "settings" : "focus", [pathname]);
  if (pathname === "/") return <MarketingSite navigate={navigate} />;
  if (pathname === "/signin") return <SignInPage navigate={navigate} />;
  if (pathname === "/privacy") return <LegalPage kind="privacy" />;
  if (pathname === "/terms") return <LegalPage kind="terms" />;
  if (pathname === "/refund") return <LegalPage kind="refund" />;
  if (pathname === "/contact") return <ContactPage />;
  if (pathname.startsWith("/app")) return <AppShell view={view} navigate={navigate} pro={entitlement.pro}>{view === "focus" ? <FocusPage /> : view === "sessions" ? <SessionsPage /> : view === "patterns" ? <PatternsPage pro={entitlement.pro} navigate={navigate} /> : <SettingsPage pro={entitlement.pro} refreshEntitlement={refresh} navigate={navigate} />}</AppShell>;
  return <main className="screen-center"><h1>Page not found</h1><button className="button button-outline" onClick={() => navigate("/")}>RETURN HOME</button></main>;
}
