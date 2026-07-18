import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyPaddleWebhook } from "../../worker/paddle";

async function signature(rawBody: string, secret: string, timestamp: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}:${rawBody}`));
  const digest = [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `ts=${timestamp};h1=${digest}`;
}

describe("Paddle webhook verification", () => {
  afterEach(() => vi.useRealTimers());

  it("accepts the raw signed body and rejects tampering", async () => {
    vi.setSystemTime(new Date("2026-07-18T10:00:00.000Z"));
    const timestamp = Math.floor(Date.now() / 1000);
    const header = await signature('{"event_id":"evt_1"}', "webhook-secret", timestamp);
    await expect(verifyPaddleWebhook('{"event_id":"evt_1"}', header, "webhook-secret")).resolves.toBe(true);
    await expect(verifyPaddleWebhook('{"event_id":"evt_2"}', header, "webhook-secret")).resolves.toBe(false);
  });

  it("rejects replayed events outside the five-minute window", async () => {
    vi.setSystemTime(new Date("2026-07-18T10:10:01.000Z"));
    const timestamp = Math.floor(Date.parse("2026-07-18T10:00:00.000Z") / 1000);
    const header = await signature("{}", "webhook-secret", timestamp);
    await expect(verifyPaddleWebhook("{}", header, "webhook-secret")).resolves.toBe(false);
  });
});
