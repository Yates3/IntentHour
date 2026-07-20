import { afterEach, describe, expect, it, vi } from "vitest";
import { securityHeaders, verifyTurnstile } from "../../worker/security";

describe("Turnstile verification", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a successful token only for the configured hostname", async () => {
    const siteverify = vi.fn(() => Promise.resolve(Response.json({
      success: true,
      hostname: "intenthour-staging.ylin99207.workers.dev",
    })));
    vi.stubGlobal("fetch", siteverify);

    const request = new Request("https://intenthour-staging.ylin99207.workers.dev/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "x-turnstile-token": "valid-token" },
    });

    await expect(verifyTurnstile(request, {
      APP_ENV: "staging",
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_EXPECTED_HOSTNAME: "intenthour-staging.ylin99207.workers.dev",
    })).resolves.toBe(true);
  });

  it("rejects a token issued for another hostname", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({
        success: true,
        hostname: "untrusted.example.com",
      }))),
    );

    const request = new Request("https://intenthour-staging.ylin99207.workers.dev/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "x-turnstile-token": "wrong-host-token" },
    });

    await expect(verifyTurnstile(request, {
      APP_ENV: "staging",
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_EXPECTED_HOSTNAME: "intenthour-staging.ylin99207.workers.dev",
    })).resolves.toBe(false);
  });

  it("does not allow staging requests to bypass a configured widget", async () => {
    const request = new Request("https://intenthour-staging.ylin99207.workers.dev/api/auth/sign-in/magic-link", {
      method: "POST",
    });

    await expect(verifyTurnstile(request, {
      APP_ENV: "staging",
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_EXPECTED_HOSTNAME: "intenthour-staging.ylin99207.workers.dev",
    })).resolves.toBe(false);
  });
});

describe("security headers", () => {
  it("allows Vite's inline React refresh preamble only in development", () => {
    expect(securityHeaders(true)["Content-Security-Policy"]).toContain("script-src 'self' https://cdn.paddle.com https://challenges.cloudflare.com 'unsafe-inline'");
    expect(securityHeaders(false)["Content-Security-Policy"]).not.toContain("script-src 'self' https://cdn.paddle.com https://challenges.cloudflare.com 'unsafe-inline'");
  });
});
