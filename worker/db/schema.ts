import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("account_user_idx").on(table.userId),
    uniqueIndex("account_provider_idx").on(table.providerId, table.accountId),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const focusSessions = sqliteTable(
  "focus_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    intention: text("intention").notNull(),
    targetMinutes: integer("target_minutes").notNull(),
    status: text("status", { enum: ["completed", "discarded"] }).notNull(),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    totalPausedMs: integer("total_paused_ms").notNull().default(0),
    outcome: text("outcome", {
      enum: ["completed", "moved_forward", "changed_direction", "blocked"],
    }),
    outcomeNote: text("outcome_note"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("focus_sessions_user_updated_idx").on(table.userId, table.updatedAt),
    index("focus_sessions_user_started_idx").on(table.userId, table.startedAt),
  ],
);

export const interruptions = sqliteTable(
  "interruptions",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => focusSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: ["message", "new_idea", "noise", "task_switch", "other"],
    }).notNull(),
    occurredAt: text("occurred_at").notNull(),
    offsetSeconds: integer("offset_seconds").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("interruptions_session_idx").on(table.sessionId),
    index("interruptions_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const entitlements = sqliteTable(
  "entitlements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    plan: text("plan", { enum: ["pro_lifetime"] }).notNull(),
    status: text("status", { enum: ["active", "revoked"] }).notNull(),
    provider: text("provider", { enum: ["paddle"] }).notNull(),
    paddleCustomerId: text("paddle_customer_id"),
    paddleTransactionId: text("paddle_transaction_id").notNull().unique(),
    paddlePriceId: text("paddle_price_id"),
    purchasedAt: text("purchased_at").notNull(),
    revokedAt: text("revoked_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("entitlements_user_status_idx").on(table.userId, table.status)],
);

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("UTC"),
  aiConsentAt: text("ai_consent_at"),
  aiConsentVersion: text("ai_consent_version"),
  updatedAt: text("updated_at").notNull(),
});

export const weeklyReviews = sqliteTable(
  "weekly_reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    isoWeek: text("iso_week").notNull(),
    sourceHash: text("source_hash").notNull(),
    sourceSessionIds: text("source_session_ids", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    model: text("model").notNull(),
    schemaVersion: text("schema_version").notNull(),
    insights: text("insights", { mode: "json" }).notNull(),
    evidence: text("evidence", { mode: "json" }).notNull(),
    generatedAt: text("generated_at").notNull(),
  },
  (table) => [
    uniqueIndex("weekly_reviews_user_week_idx").on(table.userId, table.isoWeek),
  ],
);

export const webhookEvents = sqliteTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  status: text("status", { enum: ["processed", "ignored", "failed"] }).notNull(),
  processedAt: text("processed_at").notNull(),
  errorCode: text("error_code"),
});

export const billingAdjustments = sqliteTable("billing_adjustments", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull(),
  action: text("action").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  reviewRequired: integer("review_required", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: text("updated_at").notNull(),
});

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  focusSessions: many(focusSessions),
  preferences: one(userPreferences),
}));

export const focusSessionRelations = relations(focusSessions, ({ many, one }) => ({
  user: one(user, { fields: [focusSessions.userId], references: [user.id] }),
  interruptions: many(interruptions),
}));

export const schema = {
  user,
  session,
  account,
  verification,
  focusSessions,
  interruptions,
  entitlements,
  userPreferences,
  weeklyReviews,
  webhookEvents,
  billingAdjustments,
};
