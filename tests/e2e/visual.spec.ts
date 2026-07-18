import { expect, test } from "@playwright/test";

test("capture native desktop visual QA surfaces", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop QA only");
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /PROTECT THE WORK/i })).toBeVisible();
  await page.screenshot({ path: "artifacts/visual/home-desktop.png", fullPage: true });

  await page.goto("/app");
  await page.getByLabel("INTENTION").fill("Finish launch narrative");
  await page.getByRole("button", { name: "START FOCUS SESSION" }).click();
  await page.screenshot({ path: "artifacts/visual/focus-desktop.png", fullPage: true });

  await page.getByRole("button", { name: "END SESSION" }).click();
  await page.getByRole("button", { name: "Discard session" }).click();
  await seedPreviousWeek(page);
  await page.route("**/api/me/entitlement", (route) => route.fulfill({ json: { authenticated: true, pro: true, status: "active" } }));
  await page.route("**/api/reviews/*", (route) => route.fulfill({ json: {
    insights: [
      { headline: "New ideas were your most common interruption.", suggestion: "Keep a capture note beside the timer and return to the chosen outcome.", evidenceKey: "top_interruption" },
      { headline: "You protected most chosen outcomes.", suggestion: "Place the next meaningful outcome in the same reliable time window.", evidenceKey: "intention_kept" },
    ],
    evidence: {
      top_interruption: "New idea was marked 4 times across 3 sessions.",
      intention_kept: "4 of 5 sessions ended as completed or moved forward.",
    },
    generatedAt: "2026-07-18T00:00:00.000Z",
    model: "gpt-5.6-luna",
  } }));
  await page.goto("/app/patterns");
  await expect(page.getByText("New ideas were your most common interruption.")).toBeVisible();
  await page.screenshot({ path: "artifacts/visual/weekly-desktop.png", fullPage: true });
});

async function seedPreviousWeek(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const now = new Date();
    const day = now.getUTCDay() || 7;
    const currentMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
    const previousMonday = new Date(currentMonday.getTime() - 7 * 86400000);
    const request = indexedDB.open("intenthour");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open visual seed database"));
    });
    const transaction = db.transaction(["sessions", "interruptions"], "readwrite");
    const sessions = transaction.objectStore("sessions");
    const interruptions = transaction.objectStore("interruptions");
    const outcomes = ["completed", "moved_forward", "completed", "moved_forward", "blocked"];
    for (let index = 0; index < 5; index += 1) {
      const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      const started = new Date(previousMonday.getTime() + index * 86400000 + 9 * 3600000);
      const ended = new Date(started.getTime() + (35 + index * 5) * 60000);
      sessions.put({ id, deviceId: "visual-seed", intention: `Visual session ${index + 1}`, targetMinutes: 50, status: "completed", startedAt: started.toISOString(), pausedAt: null, endedAt: ended.toISOString(), totalPausedMs: 0, outcome: outcomes[index], outcomeNote: null, createdAt: started.toISOString(), updatedAt: ended.toISOString() });
      if (index < 4) {
        const marked = new Date(started.getTime() + 10 * 60000);
        interruptions.put({ id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, sessionId: id, category: "new_idea", occurredAt: marked.toISOString(), offsetSeconds: 600, note: null, createdAt: marked.toISOString(), updatedAt: marked.toISOString() });
      }
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not write visual seed data"));
    });
    db.close();
  });
}

test("capture mobile focus visual QA surface", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile QA only");
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto("/app");
  await page.getByLabel("INTENTION").fill("Draft one customer email");
  await page.getByRole("button", { name: "START FOCUS SESSION" }).click();
  await page.getByRole("button", { name: "MARK DISTRACTION", exact: true }).click();
  await page.screenshot({ path: "artifacts/visual/focus-mobile.png", fullPage: true });
});
