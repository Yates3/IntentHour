import { expect, test } from "@playwright/test";

test("unconfigured authentication providers are safe and local mode remains available", async ({ page }) => {
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleProblems.push(message.text());
  });
  page.on("pageerror", (error) => consoleProblems.push(error.message));

  await page.goto("/signin?next=/app/settings");
  const google = page.getByRole("button", { name: "GOOGLE SIGN-IN — SETUP REQUIRED" });
  const email = page.getByRole("button", { name: "EMAIL SIGN-IN — SETUP REQUIRED" });
  await expect(google).toBeVisible();
  await expect(google).toBeDisabled();
  await expect(email).toBeDisabled();
  await expect(page.getByText("Google OAuth credentials have not been connected")).toBeVisible();

  await page.getByRole("button", { name: "CONTINUE WITH LOCAL FREE MODE" }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByRole("heading", { name: "SETTINGS" })).toBeVisible();
  expect(consoleProblems).toEqual([]);
});

test("marketing and required public policy pages render", async ({ page, request }) => {
  const marketingResponse = await request.get("/");
  expect(marketingResponse.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(marketingResponse.headers()["strict-transport-security"]).toContain("max-age=31536000");
  expect(marketingResponse.headers()["x-content-type-options"]).toBe("nosniff");

  await page.goto("/");
  await expect(page).toHaveTitle("IntentHour — Protect the work you chose");
  await expect(page.getByRole("heading", { name: /Protect the work you chose/i })).toBeVisible();

  for (const [path, heading] of [["/privacy", "Privacy"], ["/terms", "Terms"], ["/refund", "Refund policy"], ["/contact", "Contact"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});
