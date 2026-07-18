import { apiFetch } from "./api";

declare global {
  interface Window {
    Paddle?: {
      Environment: { set(value: "sandbox" | "production"): void };
      Initialize(input: { token: string; eventCallback?: (event: { name: string }) => void }): void;
      Checkout: { open(input: { transactionId: string }): void };
    };
  }
}

let paddleReady: Promise<void> | undefined;
function loadPaddle(): Promise<void> {
  if (paddleReady) return paddleReady;
  paddleReady = new Promise((resolve, reject) => {
    if (window.Paddle) { resolve(); return; }
    const script = document.createElement("script"); script.src = "https://cdn.paddle.com/paddle/v2/paddle.js"; script.async = true; script.onload = () => resolve(); script.onerror = () => reject(new Error("Could not load Paddle checkout")); document.head.append(script);
  });
  return paddleReady;
}

export async function openProCheckout(onCompleted: () => void): Promise<void> {
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (!token) throw new Error("Paddle sandbox client token is not configured yet.");
  await loadPaddle();
  window.Paddle?.Environment.set(import.meta.env.VITE_PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox");
  window.Paddle?.Initialize({ token, eventCallback: (event) => { if (event.name === "checkout.completed") onCompleted(); } });
  const result = await apiFetch<{ transactionId: string }>("/api/billing/checkout", { method: "POST", body: "{}" });
  window.Paddle?.Checkout.open({ transactionId: result.transactionId });
}
