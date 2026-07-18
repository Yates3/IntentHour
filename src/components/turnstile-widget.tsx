import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | undefined;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Human verification could not load."));
    document.head.append(script);
  });
  return scriptPromise;
}

export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const elementRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!sitekey || !elementRef.current) return;
    let widgetId: string | undefined;
    let cancelled = false;
    void loadTurnstile().then(() => {
      if (cancelled || !elementRef.current || !window.turnstile) return;
      widgetId = window.turnstile.render(elementRef.current, {
        sitekey,
        theme: "dark",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    }).catch(() => onToken(""));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken]);
  if (!import.meta.env.VITE_TURNSTILE_SITE_KEY) return null;
  return <div className="turnstile-slot" ref={elementRef} />;
}
