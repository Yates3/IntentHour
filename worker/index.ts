import { and, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  aiConsentSchema,
  focusSessionSchema,
  interruptionSchema,
  syncPushSchema,
  type FocusSession,
  type Interruption,
} from "../shared/contracts";
import { escapeCsv } from "../shared/csv";
import { createAuth, getAuthSession, withDevelopmentClientIp } from "./auth";
import { database } from "./db/client";
import {
  entitlements,
  user,
  userPreferences,
  weeklyReviews,
} from "./db/schema";
import { verifyPaddleWebhook } from "./paddle";
import { generateReview } from "./review";
import { securityHeaders, verifyTurnstile } from "./security";

type AppEnv = Env & { ASSETS: Fetcher };
type AppBindings = { Bindings: AppEnv; Variables: { userId: string; requestId: string } };
type AppContext = Context<AppBindings>;

const app = new Hono<AppBindings>();

app.use("*", async (context, next) => {
  const requestId = context.req.header("CF-Ray") ?? crypto.randomUUID();
  context.set("requestId", requestId);
  const startedAt = Date.now();
  try {
    await next();
  } finally {
    for (const [name, value] of Object.entries(securityHeaders())) context.header(name, value);
    context.header("X-Request-ID", requestId);
    console.log(JSON.stringify({
      requestId,
      method: context.req.method,
      path: new URL(context.req.url).pathname,
      status: context.res.status,
      durationMs: Date.now() - startedAt,
    }));
  }
});

app.get("/api/health", (context) => context.json({ ok: true, service: "intenthour", environment: context.env.APP_ENV }));

app.get("/api/config/public", (context) => context.json({
  googleSignIn: Boolean(context.env.GOOGLE_CLIENT_ID && context.env.GOOGLE_CLIENT_SECRET),
  magicLinkSignIn: Boolean(context.env.RESEND_API_KEY && context.env.RESEND_FROM),
  paddleCheckout: Boolean(context.env.PADDLE_API_KEY && context.env.PADDLE_PRICE_ID && context.env.PADDLE_WEBHOOK_SECRET),
  aiReview: Boolean(context.env.OPENAI_API_KEY),
}));

app.on(["GET", "POST"], "/api/auth/*", async (context) => {
  if (context.req.method === "POST" && context.req.path.endsWith("/sign-in/magic-link")) {
    const valid = await verifyTurnstile(context.req.raw, context.env);
    if (!valid) return context.json({ error: "Human verification failed", code: "TURNSTILE_FAILED" }, 403);
  }
  return createAuth(context.env).handler(withDevelopmentClientIp(context.req.raw, context.env));
});

app.get("/api/me/entitlement", async (context) => {
  const userId = await authenticatedUserId(context);
  if (!userId) return context.json({ authenticated: false, pro: false, status: "none" as const });
  const record = await activeEntitlement(context.env, userId);
  return context.json({ authenticated: true, pro: Boolean(record), status: record?.status ?? "none", purchasedAt: record?.purchasedAt });
});

app.get("/api/me/preferences", async (context) => {
  const userId = await requireUser(context);
  if (!userId) return unauthorized(context);
  const record = await database(context.env)
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)
    .then((rows) => rows[0]);
  return context.json({
    enabled: Boolean(record?.aiConsentAt && record.aiConsentVersion === "2026-07-18.v1"),
    timezone: record?.timezone ?? null,
    policyVersion: record?.aiConsentVersion ?? null,
    consentedAt: record?.aiConsentAt ?? null,
  });
});

app.put("/api/me/preferences", async (context) => {
  const userId = await requireUser(context);
  if (!userId) return unauthorized(context);
  const parsed = aiConsentSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) return context.json({ error: "Invalid preference payload", code: "INVALID_INPUT" }, 400);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: parsed.data.timezone }).format();
  } catch {
    return context.json({ error: "Invalid IANA timezone", code: "INVALID_TIMEZONE" }, 400);
  }
  const now = new Date().toISOString();
  await database(context.env)
    .insert(userPreferences)
    .values({ userId, timezone: parsed.data.timezone, aiConsentAt: parsed.data.enabled ? now : null, aiConsentVersion: parsed.data.enabled ? parsed.data.policyVersion : null, updatedAt: now })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { timezone: parsed.data.timezone, aiConsentAt: parsed.data.enabled ? now : null, aiConsentVersion: parsed.data.enabled ? parsed.data.policyVersion : null, updatedAt: now } });
  return context.json({ enabled: parsed.data.enabled, updatedAt: now });
});

app.post("/api/sync/push", async (context) => {
  const userId = await requireProUser(context);
  if (!userId) return forbidden(context);
  const parsed = syncPushSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) return context.json({ error: "Invalid sync payload", code: "INVALID_SYNC_PAYLOAD" }, 400);
  if (parsed.data.sessions.some((session) => session.status !== "completed")) return context.json({ error: "Only completed sessions can sync", code: "ACTIVE_SESSION_REJECTED" }, 400);
  const sessionIds = new Set(parsed.data.sessions.map((session) => session.id));
  if (parsed.data.interruptions.some((item) => !sessionIds.has(item.sessionId))) return context.json({ error: "Every interruption must belong to a session in this batch", code: "ORPHAN_INTERRUPTION" }, 400);
  const statements: D1PreparedStatement[] = [];
  for (const session of parsed.data.sessions) {
    statements.push(context.env.DB.prepare(`INSERT INTO focus_sessions (id,user_id,device_id,intention,target_minutes,status,started_at,ended_at,total_paused_ms,outcome,outcome_note,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET device_id=excluded.device_id,intention=excluded.intention,target_minutes=excluded.target_minutes,status=excluded.status,started_at=excluded.started_at,ended_at=excluded.ended_at,total_paused_ms=excluded.total_paused_ms,outcome=excluded.outcome,outcome_note=excluded.outcome_note,updated_at=excluded.updated_at
      WHERE focus_sessions.user_id=? AND excluded.updated_at > focus_sessions.updated_at`).bind(session.id, userId, session.deviceId, session.intention, session.targetMinutes, session.status, session.startedAt, session.endedAt ?? null, session.totalPausedMs, session.outcome ?? null, session.outcomeNote ?? null, session.createdAt, session.updatedAt, userId));
  }
  for (const item of parsed.data.interruptions) {
    statements.push(context.env.DB.prepare(`INSERT INTO interruptions (id,session_id,user_id,category,occurred_at,offset_seconds,note,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET category=excluded.category,occurred_at=excluded.occurred_at,offset_seconds=excluded.offset_seconds,note=excluded.note,updated_at=excluded.updated_at
      WHERE interruptions.user_id=? AND excluded.updated_at > interruptions.updated_at`).bind(item.id, item.sessionId, userId, item.category, item.occurredAt, item.offsetSeconds, item.note ?? null, item.createdAt, item.updatedAt, userId));
  }
  if (statements.length) await context.env.DB.batch(statements);
  return context.json({ acceptedSessions: parsed.data.sessions.length, acceptedInterruptions: parsed.data.interruptions.length });
});

app.get("/api/sync/pull", async (context) => {
  const userId = await requireProUser(context);
  if (!userId) return forbidden(context);
  const cursor = decodeCursor(context.req.query("cursor"));
  const sessionRows = await context.env.DB.prepare(`SELECT id,device_id,intention,target_minutes,status,started_at,ended_at,total_paused_ms,outcome,outcome_note,created_at,updated_at FROM focus_sessions WHERE user_id=? AND (updated_at>? OR (updated_at=? AND id>?)) ORDER BY updated_at,id LIMIT 201`).bind(userId, cursor.sessions.ts, cursor.sessions.ts, cursor.sessions.id).all<CloudSessionRow>();
  const markRows = await context.env.DB.prepare(`SELECT id,session_id,category,occurred_at,offset_seconds,note,created_at,updated_at FROM interruptions WHERE user_id=? AND (updated_at>? OR (updated_at=? AND id>?)) ORDER BY updated_at,id LIMIT 201`).bind(userId, cursor.interruptions.ts, cursor.interruptions.ts, cursor.interruptions.id).all<CloudInterruptionRow>();
  const hasMore = sessionRows.results.length > 200 || markRows.results.length > 200;
  const sessions = sessionRows.results.slice(0, 200).map(cloudSession);
  const interruptions = markRows.results.slice(0, 200).map(cloudInterruption);
  const next = {
    sessions: advanceCursor(cursor.sessions, sessions),
    interruptions: advanceCursor(cursor.interruptions, interruptions),
  };
  return context.json({ sessions, interruptions, nextCursor: hasMore ? encodeCursor(next) : null });
});

app.post("/api/billing/checkout", async (context) => {
  const userId = await requireUser(context);
  if (!userId) return unauthorized(context);
  if (!context.env.PADDLE_API_KEY || !context.env.PADDLE_PRICE_ID) return context.json({ error: "Paddle sandbox is not configured yet", code: "PADDLE_NOT_CONFIGURED" }, 503);
  const response = await fetch(`${context.env.PADDLE_API_BASE}/transactions`, {
    method: "POST",
    headers: { authorization: `Bearer ${context.env.PADDLE_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ items: [{ price_id: context.env.PADDLE_PRICE_ID, quantity: 1 }], custom_data: { user_id: userId, product: "intenthour_pro_lifetime" }, checkout: { url: `${context.env.APP_URL}/app/settings` } }),
  });
  const body: { data?: { id?: string }; error?: { detail?: string } } = await response.json();
  if (!response.ok || !body.data?.id) {
    console.error(JSON.stringify({ requestId: context.get("requestId"), code: "PADDLE_TRANSACTION_FAILED", status: response.status }));
    return context.json({ error: "Could not create Paddle checkout", code: "PADDLE_TRANSACTION_FAILED" }, 502);
  }
  return context.json({ transactionId: body.data.id });
});

app.post("/api/webhooks/paddle", async (context) => {
  const rawBody = await context.req.text();
  const verified = await verifyPaddleWebhook(rawBody, context.req.header("Paddle-Signature") ?? null, context.env.PADDLE_WEBHOOK_SECRET);
  if (!verified) return context.json({ error: "Invalid webhook signature", code: "INVALID_SIGNATURE" }, 401);
  const parsed = paddleEventSchema.safeParse(JSON.parse(rawBody) as unknown);
  if (!parsed.success) return context.json({ error: "Invalid Paddle event", code: "INVALID_EVENT" }, 400);
  const existing = await context.env.DB.prepare("SELECT event_id FROM webhook_events WHERE event_id=?").bind(parsed.data.event_id).first();
  if (existing) return context.json({ ok: true, duplicate: true });
  const result = await processPaddleEvent(context.env, parsed.data);
  await context.env.DB.prepare("INSERT INTO webhook_events (event_id,event_type,status,processed_at,error_code) VALUES (?,?,?,?,NULL)").bind(parsed.data.event_id, parsed.data.event_type, result, new Date().toISOString()).run();
  return context.json({ ok: true, status: result });
});

app.get("/api/reviews/:isoWeek", async (context) => {
  const userId = await requireProUser(context);
  if (!userId) return forbidden(context);
  const record = await database(context.env).select().from(weeklyReviews).where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.isoWeek, context.req.param("isoWeek")))).limit(1).then((rows) => rows[0]);
  if (!record) return context.json({ error: "Review not generated", code: "REVIEW_NOT_FOUND" }, 404);
  return context.json({ insights: record.insights, evidence: record.evidence, generatedAt: record.generatedAt, model: record.model });
});

app.post("/api/reviews/:isoWeek/generate", async (context) => {
  const userId = await requireProUser(context);
  if (!userId) return forbidden(context);
  const isoWeek = context.req.param("isoWeek");
  const bounds = isoWeekBounds(isoWeek);
  if (!bounds || bounds.end.getTime() > Date.now()) return context.json({ error: "Only completed ISO weeks can be reviewed", code: "WEEK_NOT_COMPLETE" }, 400);
  const db = database(context.env);
  const cached = await db.select().from(weeklyReviews).where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.isoWeek, isoWeek))).limit(1).then((rows) => rows[0]);
  if (cached) return context.json({ insights: cached.insights, evidence: cached.evidence, generatedAt: cached.generatedAt, model: cached.model });
  const preference = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1).then((rows) => rows[0]);
  if (!preference?.aiConsentAt || preference.aiConsentVersion !== "2026-07-18.v1") return context.json({ error: "Explicit AI review consent is required", code: "AI_CONSENT_REQUIRED" }, 403);
  const sessionRows = await context.env.DB.prepare("SELECT id,device_id,intention,target_minutes,status,started_at,ended_at,total_paused_ms,outcome,outcome_note,created_at,updated_at FROM focus_sessions WHERE user_id=? AND status='completed' AND started_at>=? AND started_at<? ORDER BY started_at").bind(userId, bounds.start.toISOString(), bounds.end.toISOString()).all<CloudSessionRow>();
  const sessions = sessionRows.results.map(cloudSession);
  if (sessions.length < 3) return context.json({ error: "At least three completed sessions are required", code: "INSUFFICIENT_DATA" }, 422);
  const placeholders = sessions.map(() => "?").join(",");
  const markRows = await context.env.DB.prepare(`SELECT id,session_id,category,occurred_at,offset_seconds,note,created_at,updated_at FROM interruptions WHERE user_id=? AND session_id IN (${placeholders}) ORDER BY occurred_at`).bind(userId, ...sessions.map((session) => session.id)).all<CloudInterruptionRow>();
  const interruptions = markRows.results.map(cloudInterruption);
  const result = await generateReview(context.env, sessions, interruptions);
  const generatedAt = new Date().toISOString();
  await db.insert(weeklyReviews).values({ id: crypto.randomUUID(), userId, isoWeek, sourceHash: result.sourceHash, sourceSessionIds: sessions.map((session) => session.id), model: result.model, schemaVersion: "weekly-review.v1", insights: result.output.insights, evidence: result.evidence, generatedAt });
  return context.json({ insights: result.output.insights, evidence: result.evidence, generatedAt, model: result.model });
});

app.get("/api/export.csv", async (context) => {
  const userId = await requireProUser(context);
  if (!userId) return forbidden(context);
  return new Response(csvStream(context.env, userId), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="intenthour-${new Date().toISOString().slice(0, 10)}.csv"` } });
});

app.delete("/api/me", async (context) => {
  const userId = await requireUser(context);
  if (!userId) return unauthorized(context);
  await database(context.env).delete(user).where(eq(user.id, userId));
  return context.body(null, 204);
});

app.notFound((context) => {
  if (context.req.path.startsWith("/api/")) {
    return context.json({ error: "Not found", code: "NOT_FOUND" }, 404);
  }
  return context.env.ASSETS.fetch(context.req.raw);
});
app.onError((error, context) => {
  console.error(JSON.stringify({ requestId: context.get("requestId"), code: "UNHANDLED_ERROR", name: error.name }));
  return context.json({ error: "Something went wrong", code: "INTERNAL_ERROR" }, 500);
});

export default app;

async function authenticatedUserId(context: AppContext): Promise<string | null> {
  const authSession = await getAuthSession(context.req.raw, context.env);
  return authSession?.user.id ?? null;
}
async function requireUser(context: AppContext) { const userId = await authenticatedUserId(context); if (userId) context.set("userId", userId); return userId; }
async function requireProUser(context: AppContext) { const userId = await requireUser(context); if (!userId) return null; return (await activeEntitlement(context.env, userId)) ? userId : null; }
async function activeEntitlement(env: Env, userId: string) { return database(env).select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.status, "active"))).limit(1).then((rows) => rows[0]); }
function unauthorized(context: AppContext) { return context.json({ error: "Sign in required", code: "UNAUTHORIZED" }, 401); }
function forbidden(context: AppContext) { return context.json({ error: "Pro Lifetime is required", code: "PRO_REQUIRED" }, 403); }

const paddleEventSchema = z.object({ event_id: z.string(), event_type: z.string(), occurred_at: z.string().optional(), data: z.record(z.string(), z.unknown()) });
type PaddleEvent = z.infer<typeof paddleEventSchema>;
async function processPaddleEvent(env: Env, event: PaddleEvent): Promise<"processed" | "ignored"> {
  const data = event.data;
  if (event.event_type === "transaction.completed") {
    const custom = isRecord(data.custom_data) ? data.custom_data : {};
    const userId = typeof custom.user_id === "string" ? custom.user_id : null;
    const transactionId = typeof data.id === "string" ? data.id : null;
    const items = Array.isArray(data.items) ? data.items : [];
    const correctPrice = items.some((item) => isRecord(item) && isRecord(item.price) && item.price.id === env.PADDLE_PRICE_ID);
    if (!userId || !transactionId || !correctPrice) return "ignored";
    const userExists = await env.DB.prepare("SELECT id FROM user WHERE id=?").bind(userId).first();
    if (!userExists) return "ignored";
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO entitlements (id,user_id,plan,status,provider,paddle_customer_id,paddle_transaction_id,paddle_price_id,purchased_at,revoked_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,NULL,?)
      ON CONFLICT(user_id) DO UPDATE SET status='active',paddle_customer_id=excluded.paddle_customer_id,paddle_transaction_id=excluded.paddle_transaction_id,paddle_price_id=excluded.paddle_price_id,purchased_at=excluded.purchased_at,revoked_at=NULL,updated_at=excluded.updated_at`).bind(crypto.randomUUID(), userId, "pro_lifetime", "active", "paddle", typeof data.customer_id === "string" ? data.customer_id : null, transactionId, env.PADDLE_PRICE_ID, typeof data.completed_at === "string" ? data.completed_at : now, now).run();
    return "processed";
  }
  if (event.event_type === "adjustment.created" || event.event_type === "adjustment.updated") {
    const id = typeof data.id === "string" ? data.id : null; const transactionId = typeof data.transaction_id === "string" ? data.transaction_id : null; const action = typeof data.action === "string" ? data.action : "unknown"; const type = typeof data.type === "string" ? data.type : "unknown"; const status = typeof data.status === "string" ? data.status : "unknown";
    if (!id || !transactionId) return "ignored";
    const fullRevoke = status === "approved" && type === "full" && (action === "refund" || action.startsWith("chargeback"));
    await env.DB.prepare("INSERT INTO billing_adjustments (id,transaction_id,action,type,status,review_required,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,review_required=excluded.review_required,updated_at=excluded.updated_at").bind(id, transactionId, action, type, status, type === "partial" ? 1 : 0, new Date().toISOString()).run();
    if (fullRevoke) await env.DB.prepare("UPDATE entitlements SET status='revoked',revoked_at=?,updated_at=? WHERE paddle_transaction_id=?").bind(new Date().toISOString(), new Date().toISOString(), transactionId).run();
    return "processed";
  }
  return "ignored";
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

interface SyncCursor { sessions: { ts: string; id: string }; interruptions: { ts: string; id: string } }
const emptyCursor: SyncCursor = { sessions: { ts: "", id: "" }, interruptions: { ts: "", id: "" } };
function decodeCursor(value?: string): SyncCursor { if (!value) return emptyCursor; try { const parsed = JSON.parse(atob(value)) as SyncCursor; return parsed.sessions && parsed.interruptions ? parsed : emptyCursor; } catch { return emptyCursor; } }
function encodeCursor(cursor: SyncCursor) { return btoa(JSON.stringify(cursor)); }
function advanceCursor<T extends { id: string; updatedAt: string }>(previous: { ts: string; id: string }, rows: T[]) { const last = rows.at(-1); return last ? { ts: last.updatedAt, id: last.id } : previous; }

interface CloudSessionRow { id: string; device_id: string; intention: string; target_minutes: number; status: "completed" | "discarded"; started_at: string; ended_at: string | null; total_paused_ms: number; outcome: FocusSession["outcome"]; outcome_note: string | null; created_at: string; updated_at: string }
interface CloudInterruptionRow { id: string; session_id: string; category: Interruption["category"]; occurred_at: string; offset_seconds: number; note: string | null; created_at: string; updated_at: string }
function cloudSession(row: CloudSessionRow): FocusSession { return focusSessionSchema.parse({ id: row.id, deviceId: row.device_id, intention: row.intention, targetMinutes: row.target_minutes, status: row.status, startedAt: row.started_at, pausedAt: null, endedAt: row.ended_at, totalPausedMs: row.total_paused_ms, outcome: row.outcome, outcomeNote: row.outcome_note, createdAt: row.created_at, updatedAt: row.updated_at }); }
function cloudInterruption(row: CloudInterruptionRow): Interruption { return interruptionSchema.parse({ id: row.id, sessionId: row.session_id, category: row.category, occurredAt: row.occurred_at, offsetSeconds: row.offset_seconds, note: row.note, createdAt: row.created_at, updatedAt: row.updated_at }); }

function isoWeekBounds(value: string): { start: Date; end: Date } | null { const match = /^(\d{4})-W(\d{2})$/.exec(value); if (!match) return null; const year = Number(match[1]); const week = Number(match[2]); if (week < 1 || week > 53) return null; const jan4 = new Date(Date.UTC(year, 0, 4)); const monday = new Date(jan4); monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7); const end = new Date(monday); end.setUTCDate(end.getUTCDate() + 7); return { start: monday, end }; }

function csvStream(env: Env, userId: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode("session_id,intention,target_minutes,started_at,ended_at,outcome,outcome_note,distraction_category,distraction_at,distraction_note\r\n"));
      let cursorStarted = ""; let cursorId = "";
      while (true) {
        const page = await env.DB.prepare("SELECT id,device_id,intention,target_minutes,status,started_at,ended_at,total_paused_ms,outcome,outcome_note,created_at,updated_at FROM focus_sessions WHERE user_id=? AND status='completed' AND (started_at>? OR (started_at=? AND id>?)) ORDER BY started_at,id LIMIT 250").bind(userId, cursorStarted, cursorStarted, cursorId).all<CloudSessionRow>();
        if (!page.results.length) break;
        const ids = page.results.map((row) => row.id); const placeholders = ids.map(() => "?").join(",");
        const marks = await env.DB.prepare(`SELECT id,session_id,category,occurred_at,offset_seconds,note,created_at,updated_at FROM interruptions WHERE user_id=? AND session_id IN (${placeholders}) ORDER BY occurred_at`).bind(userId, ...ids).all<CloudInterruptionRow>();
        const bySession = new Map<string, CloudInterruptionRow[]>(); marks.results.forEach((mark) => bySession.set(mark.session_id, [...(bySession.get(mark.session_id) ?? []), mark]));
        for (const session of page.results) { const sessionMarks = bySession.get(session.id) ?? [null]; for (const mark of sessionMarks) controller.enqueue(encoder.encode([session.id, session.intention, session.target_minutes, session.started_at, session.ended_at ?? "", session.outcome ?? "", session.outcome_note ?? "", mark?.category ?? "", mark?.occurred_at ?? "", mark?.note ?? ""].map(escapeCsv).join(",") + "\r\n")); }
        const last = page.results.at(-1)!; cursorStarted = last.started_at; cursorId = last.id; if (page.results.length < 250) break;
      }
      controller.close();
    },
  });
}
