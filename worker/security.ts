interface TurnstileEnvironment {
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_EXPECTED_HOSTNAME?: string;
  TURNSTILE_EXPECTED_HOSTNAMES?: string;
  APP_ENV?: string;
}

export async function verifyTurnstile(request: Request, env: TurnstileEnvironment): Promise<boolean> {
  const isLocalDevelopment = String(env.APP_ENV) === "development";
  if (!env.TURNSTILE_SECRET_KEY) return isLocalDevelopment;
  const token = request.headers.get("x-turnstile-token");
  if (!token) return isLocalDevelopment;
  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.set("remoteip", ip);
  body.set("idempotency_key", crypto.randomUUID());
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!response.ok) return false;
  const result: { success?: boolean; hostname?: string } = await response.json();
  if (result.success !== true) return false;
  const expectedHostnames = turnstileExpectedHostnames(env);
  if (expectedHostnames.length && (!result.hostname || !expectedHostnames.includes(result.hostname))) return false;
  return true;
}

export function turnstileExpectedHostnames(env: TurnstileEnvironment): string[] {
  return [
    env.TURNSTILE_EXPECTED_HOSTNAME,
    ...(env.TURNSTILE_EXPECTED_HOSTNAMES?.split(",") ?? []),
  ]
    .map((hostname) => hostname?.trim())
    .filter((hostname): hostname is string => Boolean(hostname));
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

export function securityHeaders(isDevelopment = false): Record<string, string> {
  const scriptSources = [
    "'self'",
    "https://cdn.paddle.com",
    "https://challenges.cloudflare.com",
    "https://static.cloudflareinsights.com",
  ];
  if (isDevelopment) scriptSources.push("'unsafe-inline'");
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src ${scriptSources.join(" ")}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.paddle.com https://sandbox-api.paddle.com https://challenges.cloudflare.com https://cloudflareinsights.com",
      "frame-src https://buy.paddle.com https://sandbox-buy.paddle.com https://challenges.cloudflare.com",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}
