import { expect, test } from "@playwright/test";

test("public health and entitlement endpoints are safe for guests", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  await expect(health.json()).resolves.toMatchObject({ ok: true });

  const config = await request.get("/api/config/public");
  expect(config.ok()).toBeTruthy();
  const publicConfig = await config.json() as Record<string, unknown>;
  expect(typeof publicConfig.googleSignIn).toBe("boolean");
  expect(typeof publicConfig.paddleCheckout).toBe("boolean");
  expect(publicConfig).toMatchObject({
    magicLinkSignIn: false,
    aiReview: true,
  });

  const entitlement = await request.get("/api/me/entitlement");
  expect(entitlement.ok()).toBeTruthy();
  await expect(entitlement.json()).resolves.toMatchObject({ authenticated: false, pro: false });
});

test("cloud data and webhook processing remain server-authoritative", async ({ request }) => {
  const sync = await request.post("/api/sync/push", { data: { sessions: [], interruptions: [] } });
  expect(sync.status()).toBe(403);

  const webhook = await request.post("/api/webhooks/paddle", { data: { event_id: "fake" } });
  expect(webhook.status()).toBe(401);

  const checkout = await request.post("/api/billing/checkout", { data: {} });
  expect(checkout.status()).toBe(401);

  const review = await request.post("/api/reviews/2026-W28/generate", { data: {} });
  expect(review.status()).toBe(403);

  const exportCsv = await request.get("/api/export.csv");
  expect(exportCsv.status()).toBe(403);
});
