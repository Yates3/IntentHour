import { BarChart3, Clock3, Crown, Focus, LockKeyhole, Settings, TimerReset } from "lucide-react";
import { Brand } from "./brand";

export type AppView = "focus" | "sessions" | "patterns" | "settings";

export function AppShell({ view, navigate, children, pro = false }: { view: AppView; navigate: (path: string) => void; children: React.ReactNode; pro?: boolean }) {
  const items: Array<{ id: AppView; label: string; icon: React.ReactNode }> = [
    { id: "focus", label: "Focus", icon: <Focus /> },
    { id: "sessions", label: "Sessions", icon: <Clock3 /> },
    { id: "patterns", label: "Patterns", icon: <BarChart3 /> },
    { id: "settings", label: "Settings", icon: <Settings /> },
  ];
  return <div className="app-shell"><aside className="app-sidebar"><Brand />
    <nav aria-label="App navigation">{items.map((item) => <button key={item.id} aria-label={item.label} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id === "focus" ? "/app" : `/app/${item.id}`)}>{item.icon}<span>{item.label}</span></button>)}</nav>
    <div className="sidebar-status">{pro ? <><strong><Crown /> PRO LIFETIME</strong><em><TimerReset /> SYNCED JUST NOW</em></> : <button className="upgrade-link" onClick={() => navigate("/app/settings")}><Crown /> UNLOCK PRO</button>}<small><LockKeyhole /> LOCAL · PRIVATE</small></div>
  </aside><div className="app-content">{children}</div></div>;
}
