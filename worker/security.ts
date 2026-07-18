interface TurnstileEnvironment {
  TURNSTILE_SECRET_KEY?: string;
  APP_ENV?: string;
}

export async function verifyTurnstile(request: Request, env: TurnstileEnvironment): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return String(env.APP_ENV) !== "production";
  const token = request.headers.get("x-turnstile-token");
  if (!token) return String(env.APP_ENV) !== "production";
  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.set("remoteip", ip);
  body.set("idempotency_key", crypto.randomUUID());
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!response.ok) return false;
  const result: { success?: boolean; hostname?: string } = await response.json();
  return result.success === true;
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

export function securityHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' https://cdn.paddle.com https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.paddle.com https://sandbox-api.paddle.com https://challenges.cloudflare.com",
      "frame-src https://buy.paddle.com https://sandbox-buy.paddle.com https://challenges.cloudflare.com",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}
