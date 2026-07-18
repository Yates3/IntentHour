import { z } from "zod";

export const sessionStatusSchema = z.enum([
  "running",
  "paused",
  "completed",
  "discarded",
]);

export const outcomeSchema = z.enum([
  "completed",
  "moved_forward",
  "changed_direction",
  "blocked",
]);

export const interruptionCategorySchema = z.enum([
  "message",
  "new_idea",
  "noise",
  "task_switch",
  "other",
]);

export const focusSessionSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().min(1).max(100),
  intention: z.string().trim().min(1).max(240),
  targetMinutes: z.number().int().min(5).max(240),
  status: sessionStatusSchema,
  startedAt: z.string().datetime(),
  pausedAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
  totalPausedMs: z.number().int().min(0),
  outcome: outcomeSchema.nullable().optional(),
  outcomeNote: z.string().trim().max(500).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const interruptionSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  category: interruptionCategorySchema,
  occurredAt: z.string().datetime(),
  offsetSeconds: z.number().int().min(0),
  note: z.string().trim().max(300).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const syncPushSchema = z.object({
  sessions: z.array(focusSessionSchema).max(250),
  interruptions: z.array(interruptionSchema).max(1000),
});

export const aiConsentSchema = z.object({
  enabled: z.boolean(),
  timezone: z.string().min(1).max(100),
  policyVersion: z.literal("2026-07-18.v1"),
});

export const evidenceKeySchema = z.enum([
  "top_interruption",
  "morning_completion",
  "long_session_drift",
  "intention_kept",
]);

export const reviewInsightSchema = z.object({
  headline: z.string().min(1).max(90),
  suggestion: z.string().min(1).max(320),
  evidenceKey: evidenceKeySchema,
});

export const weeklyReviewOutputSchema = z.object({
  insights: z.array(reviewInsightSchema).length(2),
});

export type FocusSession = z.infer<typeof focusSessionSchema>;
export type Interruption = z.infer<typeof interruptionSchema>;
export type SessionOutcome = z.infer<typeof outcomeSchema>;
export type InterruptionCategory = z.infer<typeof interruptionCategorySchema>;
export type WeeklyReviewOutput = z.infer<typeof weeklyReviewOutputSchema>;
