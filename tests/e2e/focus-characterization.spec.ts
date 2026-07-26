import { expect, test, type Page } from "@playwright/test";
import type { FocusSession, Interruption } from "../../shared/contracts";

async function readStore<T>(page: Page, storeName: "sessions" | "interruptions"): Promise<T[]> {
  return page.evaluate(async (name) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("intenthour");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
    });
    try {
      return await new Promise<T[]>((resolve, reject) => {
        const request = database.transaction(name, "readonly").objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error ?? new Error(`Could not read ${name}`));
      });
    } finally {
      database.close();
    }
  }, storeName);
}

async function readSession(page: Page, intention: string): Promise<FocusSession> {
  const sessions = await readStore<FocusSession>(page, "sessions");
  const stored = sessions.find((item) => item.intention === intention);
  expect(stored, `session "${intention}" should be persisted`).toBeDefined();
  return stored as FocusSession;
}

async function patchSession(
  page: Page,
  intention: string,
  patch: Partial<FocusSession>,
): Promise<void> {
  await page.evaluate(async ({ expectedIntention, values }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("intenthour");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
    });
    try {
      const sessions = await new Promise<FocusSession[]>((resolve, reject) => {
        const request = database.transaction("sessions", "readonly").objectStore("sessions").getAll();
        request.onsuccess = () => resolve(request.result as FocusSession[]);
        request.onerror = () => reject(request.error ?? new Error("Could not read sessions"));
      });
      const stored = sessions.find((item) => item.intention === expectedIntention);
      if (!stored) throw new Error(`Missing session: ${expectedIntention}`);
      await new Promise<void>((resolve, reject) => {
        const request = database
          .transaction("sessions", "readwrite")
          .objectStore("sessions")
          .put({ ...stored, ...values });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error("Could not update session"));
      });
    } finally {
      database.close();
    }
  }, { expectedIntention: intention, values: patch });
}

async function startSession(
  page: Page,
  intention: string,
  targetMinutes = "25",
): Promise<void> {
  await page.goto("/app");
  await page.getByLabel("INTENTION").fill(intention);
  await page.getByLabel("TARGET DURATION").selectOption(targetMinutes);
  await page.getByRole("button", { name: "START FOCUS SESSION" }).click();
  await expect(page.getByText(intention.trim(), { exact: true })).toBeVisible();
}

async function openCoveredFinishDialog(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "END SESSION" })
    .evaluate((button: HTMLButtonElement) => button.click());
}

async function clickCoveredDialogAction(page: Page, name: string): Promise<void> {
  await page
    .getByRole("button", { name, exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
}

test("starting a session persists the current field semantics and survives reload", async ({ page }) => {
  const beforeStart = Date.now();
  await startSession(page, "  Characterize session start  ", "40");
  const afterStart = Date.now();

  const stored = await readSession(page, "Characterize session start");
  expect(stored.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(stored.deviceId).not.toBe("");
  expect(stored).toMatchObject({
    intention: "Characterize session start",
    targetMinutes: 40,
    status: "running",
    pausedAt: null,
    endedAt: null,
    totalPausedMs: 0,
    outcome: null,
    outcomeNote: null,
  });
  expect(stored.startedAt).toBe(stored.createdAt);
  expect(stored.startedAt).toBe(stored.updatedAt);
  expect(Date.parse(stored.startedAt)).toBeGreaterThanOrEqual(beforeStart);
  expect(Date.parse(stored.startedAt)).toBeLessThanOrEqual(afterStart);

  await page.reload();
  await expect(page.getByText("Characterize session start")).toBeVisible();
  await expect(page.getByRole("button", { name: "PAUSE" })).toBeVisible();
});

test("multiple pause and resume cycles settle and persist accumulated pause time", async ({ page }) => {
  const intention = "Characterize repeated pauses";
  await startSession(page, intention);

  await page.getByRole("button", { name: "PAUSE" }).click();
  const pauseOverlay = page.getByRole("button", { name: "Resume focus session" });
  const frozenClock = await pauseOverlay.locator("time").textContent();
  const pausedBeforeWallTime = await readSession(page, intention);
  expect(pausedBeforeWallTime.status).toBe("paused");
  expect(pausedBeforeWallTime.pausedAt).not.toBeNull();
  expect(pausedBeforeWallTime.totalPausedMs).toBe(0);
  await page.waitForTimeout(250);
  await expect(pauseOverlay.locator("time")).toHaveText(frozenClock ?? "");
  const pausedAfterWallTime = await readSession(page, intention);
  expect(pausedAfterWallTime).toMatchObject(pausedBeforeWallTime);

  await page.reload();
  await expect(pauseOverlay).toBeVisible();
  await expect(pauseOverlay.locator("time")).toHaveText(frozenClock ?? "");
  const pausedAfterReload = await readSession(page, intention);
  expect(pausedAfterReload).toMatchObject(pausedBeforeWallTime);
  await pauseOverlay.click();

  const afterFirstPause = await readSession(page, intention);
  expect(afterFirstPause.status).toBe("running");
  expect(afterFirstPause.pausedAt).toBeNull();
  expect(afterFirstPause.totalPausedMs).toBeGreaterThanOrEqual(150);

  await page.getByRole("button", { name: "PAUSE" }).click();
  await page.waitForTimeout(250);
  await pauseOverlay.click();

  const afterSecondPause = await readSession(page, intention);
  expect(afterSecondPause.status).toBe("running");
  expect(afterSecondPause.pausedAt).toBeNull();
  expect(afterSecondPause.totalPausedMs).toBeGreaterThanOrEqual(
    afterFirstPause.totalPausedMs + 150,
  );

  await page.reload();
  await expect(page.getByText(intention)).toBeVisible();
  await expect(page.getByRole("button", { name: "PAUSE" })).toBeVisible();
  const resumedAfterReload = await readSession(page, intention);
  expect(resumedAfterReload.status).toBe("running");
  expect(resumedAfterReload.pausedAt).toBeNull();
  expect(resumedAfterReload.totalPausedMs).toBe(afterSecondPause.totalPausedMs);
});

test("finishing a running session persists its result and clears the active workspace", async ({ page }) => {
  const intention = "Finish a running session";
  await startSession(page, intention);

  await page.getByRole("button", { name: "END SESSION" }).click();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await page.getByPlaceholder("What helped or got in the way?").fill("  Kept the scope narrow  ");
  await page.getByRole("button", { name: "SAVE RESULT" }).click();

  const stored = await readSession(page, intention);
  expect(stored.status).toBe("completed");
  expect(stored.endedAt).not.toBeNull();
  expect(stored.pausedAt).toBeNull();
  expect(stored.totalPausedMs).toBe(0);
  expect(stored.outcome).toBe("completed");
  expect(stored.outcomeNote).toBe("Kept the scope narrow");
  expect(Date.parse(stored.endedAt ?? "")).toBeGreaterThanOrEqual(Date.parse(stored.startedAt));
  await expect(page.getByText("What will be true")).toBeVisible();

  await page.getByRole("button", { name: "Sessions" }).click();
  await expect(page.getByRole("heading", { name: intention })).toBeVisible();
});

test("finishing a paused session settles its open pause interval", async ({ page }) => {
  const intention = "Finish while paused";
  await startSession(page, intention);
  await page.getByRole("button", { name: "PAUSE" }).click();
  await page.waitForTimeout(250);

  await openCoveredFinishDialog(page);
  await clickCoveredDialogAction(page, "SAVE RESULT");

  const stored = await readSession(page, intention);
  expect(stored.status).toBe("completed");
  expect(stored.endedAt).not.toBeNull();
  expect(stored.pausedAt).toBeNull();
  expect(stored.totalPausedMs).toBeGreaterThanOrEqual(150);
  const elapsed = Date.parse(stored.endedAt ?? "") -
    Date.parse(stored.startedAt) -
    stored.totalPausedMs;
  expect(elapsed).toBeGreaterThanOrEqual(0);
  expect(elapsed).toBeLessThan(1_500);
  await expect(page.getByText("What will be true")).toBeVisible();
});

test("discarding a running session persists terminal local history without a cloud push", async ({ page }) => {
  const pushes: string[] = [];
  await page.route("**/api/me/entitlement", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ authenticated: true, pro: true, status: "active" }),
  }));
  await page.route("**/api/sync/push", async (route) => {
    pushes.push(route.request().postData() ?? "");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ acceptedSessions: 0, acceptedInterruptions: 0 }),
    });
  });
  await page.route("**/api/sync/pull**", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ sessions: [], interruptions: [], nextCursor: null }),
  }));

  const intention = "Discard a running session";
  await startSession(page, intention);
  await page.getByRole("button", { name: "END SESSION" }).click();
  await page.getByRole("button", { name: "Discard session" }).click();
  await page.waitForTimeout(300);

  const stored = await readSession(page, intention);
  expect(stored.status).toBe("discarded");
  expect(stored.endedAt).not.toBeNull();
  expect(stored.pausedAt).toBeNull();
  expect(stored.outcome).toBeNull();
  expect(stored.outcomeNote).toBeNull();
  expect(pushes.some((body) => body.includes(intention))).toBe(false);
  await expect(page.getByText("What will be true")).toBeVisible();

  await page.getByRole("button", { name: "Sessions" }).click();
  await expect(page.getByRole("heading", { name: intention })).toBeVisible();
});

test("discarding a paused session intentionally settles the open pause interval before termination", async ({ page }) => {
  const intention = "Discard while paused";
  await startSession(page, intention);
  await page.getByRole("button", { name: "PAUSE" }).click();
  const paused = await readSession(page, intention);
  expect(paused.pausedAt).not.toBeNull();
  expect(paused.totalPausedMs).toBe(0);
  await page.waitForTimeout(250);

  await openCoveredFinishDialog(page);
  await clickCoveredDialogAction(page, "Discard session");

  const discarded = await readSession(page, intention);
  expect(discarded.status).toBe("discarded");
  expect(discarded.endedAt).not.toBeNull();
  expect(discarded.pausedAt).toBeNull();
  expect(discarded.totalPausedMs).toBeGreaterThanOrEqual(150);
  await expect(page.getByText("What will be true")).toBeVisible();

  await page.reload();
  await expect(page.getByText("What will be true")).toBeVisible();
  await page.getByRole("button", { name: "Sessions" }).click();
  await expect(page.getByRole("heading", { name: intention })).toBeVisible();
});

test("repeated completion actions keep one terminal local record", async ({ page }) => {
  const intention = "Finish only once";
  await startSession(page, intention);
  await page.getByRole("button", { name: "END SESSION" }).click();
  await page.getByRole("button", { name: "SAVE RESULT" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });

  await expect(page.getByText("What will be true")).toBeVisible();
  await expect.poll(async () => {
    const sessions = await readStore<FocusSession>(page, "sessions");
    return sessions.filter((item) => item.intention === intention).length;
  }).toBe(1);
});

test("the paused UI prevents the distraction shortcut from opening the drawer", async ({ page }) => {
  await startSession(page, "Pause blocks distraction capture");
  await page.getByRole("button", { name: "PAUSE" }).click();
  await expect(page.getByRole("button", { name: "Resume focus session" })).toBeVisible();

  await page.keyboard.press("d");

  await expect(page.getByRole("dialog", { name: "WHAT PULLED YOU AWAY?" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resume focus session" })).toBeVisible();
});

test("focus logic rejects an interruption while paused when the UI guard is bypassed", async ({ page }) => {
  const intention = "Characterize paused interruption guard";
  await startSession(page, intention);
  await page.getByRole("button", { name: "PAUSE" }).click();
  const paused = await readSession(page, intention);
  expect(paused.status).toBe("paused");

  await page
    .getByRole("button", { name: "MARK DISTRACTION", exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await page
    .getByRole("button", { name: "Message", exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await page
    .getByRole("button", { name: "MARK AND RETURN" })
    .evaluate((button: HTMLButtonElement) => button.click());

  await expect.poll(async () => {
    const marks = await readStore<Interruption>(page, "interruptions");
    return marks.filter((mark) => mark.sessionId === paused.id).length;
  }).toBe(0);
  await expect(readSession(page, intention)).resolves.toMatchObject({
    status: "paused",
    pausedAt: paused.pausedAt,
  });
});

test("CURRENT BEHAVIOR: interruption offset includes paused wall-clock time", async ({ page }) => {
  const intention = "Characterize interruption offsets";
  await startSession(page, intention);
  const now = Date.now();
  await patchSession(page, intention, {
    status: "paused",
    startedAt: new Date(now - 120_000).toISOString(),
    pausedAt: new Date(now - 60_000).toISOString(),
    totalPausedMs: 0,
    updatedAt: new Date(now).toISOString(),
  });

  await page.reload();
  await page.getByRole("button", { name: "Resume focus session" }).click();
  const resumed = await readSession(page, intention);
  expect(resumed.totalPausedMs).toBeGreaterThanOrEqual(59_000);

  await page.keyboard.press("d");
  await page.getByRole("button", { name: "Message", exact: true }).click();
  await page.getByPlaceholder("Keep it brief. Return to the work.").fill("  First mark  ");
  await page.getByRole("button", { name: "MARK AND RETURN" }).click();
  await page.waitForTimeout(50);
  await page.keyboard.press("d");
  await page.getByRole("button", { name: "New idea", exact: true }).click();
  await page.getByRole("button", { name: "MARK AND RETURN" }).click();

  const marks = (await readStore<Interruption>(page, "interruptions"))
    .filter((mark) => mark.sessionId === resumed.id)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  expect(marks).toHaveLength(2);
  const firstMark = marks[0];
  if (!firstMark) throw new Error("Expected the first persisted interruption");
  expect(marks.map((mark) => mark.category)).toEqual(["message", "new_idea"]);
  expect(firstMark).toMatchObject({
    sessionId: resumed.id,
    note: "First mark",
  });
  expect(firstMark.id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(firstMark.createdAt).toBe(firstMark.occurredAt);
  expect(firstMark.updatedAt).toBe(firstMark.occurredAt);
  expect(firstMark.offsetSeconds).toBeGreaterThanOrEqual(119);
  expect(firstMark.offsetSeconds * 1_000).toBeGreaterThan(resumed.totalPausedMs + 50_000);
  await expect(page.getByText("2 MARKED")).toBeVisible();

  await page.reload();
  await expect(page.getByText("2 MARKED")).toBeVisible();
  const restoredMarks = (await readStore<Interruption>(page, "interruptions"))
    .filter((mark) => mark.sessionId === resumed.id)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  expect(restoredMarks.map((mark) => mark.id)).toEqual(marks.map((mark) => mark.id));
});
