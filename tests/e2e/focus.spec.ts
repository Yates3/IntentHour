import { expect, test } from "@playwright/test";

test("a guest can restore, mark, and complete a focus session", async ({ page }) => {
  await page.goto("/app");
  await page.getByLabel("INTENTION").fill("Finish the release note");
  await page.getByRole("button", { name: "START FOCUS SESSION" }).click();
  await expect(page.getByText("Finish the release note")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Finish the release note")).toBeVisible();
  await page.keyboard.press("d");
  await expect(page.getByRole("dialog", { name: "WHAT PULLED YOU AWAY?" })).toBeVisible();
  await page.getByRole("button", { name: "New idea" }).click();
  await page.getByRole("button", { name: "MARK AND RETURN" }).click();
  await expect(page.getByText("1 MARKED")).toBeVisible();

  await page.getByRole("button", { name: "END SESSION" }).click();
  await page.getByRole("button", { name: "SAVE RESULT" }).click();
  await expect(page.getByText("What will be true")).toBeVisible();
  await page.getByRole("button", { name: "Sessions" }).click();
  await expect(page.getByRole("heading", { name: "Finish the release note" })).toBeVisible();
  await expect(page.getByText("1 DISTRACTIONS")).toBeVisible();
});

test("the distraction drawer works at a mobile viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only interaction");
  await page.goto("/app");
  await page.getByLabel("INTENTION").fill("Draft one customer email");
  await page.getByRole("button", { name: "START FOCUS SESSION" }).click();
  await page.getByRole("button", { name: "MARK DISTRACTION", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "WHAT PULLED YOU AWAY?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "MARK AND RETURN" })).toBeInViewport();
});

test("pause survives time, API activity, and a full page reload", async ({ page, request }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  await page.goto("/app");
  await page.getByLabel("INTENTION").fill("Verify the pause state");
  await page.getByLabel("TARGET DURATION").selectOption("25");
  await page.getByRole("button", { name: "START FOCUS SESSION" }).click();

  await page.getByRole("button", { name: "PAUSE" }).click();
  const pauseOverlay = page.getByRole("button", { name: "Resume focus session" });
  await expect(pauseOverlay).toBeVisible();
  await expect(pauseOverlay).toBeFocused();
  await expect(pauseOverlay.getByText("SESSION PAUSED", { exact: true })).toBeVisible();
  await expect(pauseOverlay.getByText("CLICK ANYWHERE TO RETURN", { exact: true })).toBeVisible();
  const pausedClock = await pauseOverlay.locator("time").textContent();
  await page.waitForTimeout(1_300);
  await expect(pauseOverlay.locator("time")).toHaveText(pausedClock ?? "");

  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  await page.reload();
  await expect(pauseOverlay).toBeVisible();
  await expect(pauseOverlay.locator("time")).toHaveText(pausedClock ?? "");

  await page.mouse.click(14, 14);
  await expect(pauseOverlay).toBeHidden();
  await page.waitForTimeout(1_300);
  await expect(page.locator(".live-timer time")).not.toHaveText(pausedClock ?? "");

  await page.getByRole("button", { name: "PAUSE" }).click();
  await expect(pauseOverlay).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(pauseOverlay).toBeHidden();

  await page.getByRole("button", { name: "END SESSION" }).click();
  await page.getByRole("button", { name: "Discard session" }).click();
  expect(runtimeErrors).toEqual([]);
});
