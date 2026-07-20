import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { weeklyReviewOutputSchema, type FocusSession, type Interruption, type InterruptionCategory, type WeeklyReviewOutput } from "../shared/contracts";
import { buildReviewAggregates, categoryLabel } from "../shared/review-aggregates";
import { sha256 } from "./security";

type ReviewAggregates = ReturnType<typeof buildReviewAggregates>;
type ReviewRequester = (input: { apiKey: string; model: string; aggregates: ReviewAggregates }) => Promise<unknown>;
interface ReviewEnv {
  OPENAI_API_KEY: string;
  OPENAI_REVIEW_MODEL?: string;
}

export async function generateReview(env: ReviewEnv, sessions: FocusSession[], interruptions: Interruption[], requestReview: ReviewRequester = requestStructuredReview) {
  const aggregates = buildReviewAggregates(sessions, interruptions);
  const sourceHash = await sha256(JSON.stringify(aggregates));
  const model = env.OPENAI_REVIEW_MODEL || "gpt-5.6-luna";
  const candidate = weeklyReviewOutputSchema.safeParse(await requestReview({ apiKey: env.OPENAI_API_KEY, model, aggregates }));
  const parsed = candidate.success ? candidate.data : null;
  const uniqueKeys = parsed ? new Set(parsed.insights.map((insight) => insight.evidenceKey)) : new Set<string>();
  const output = parsed && uniqueKeys.size === 2 ? parsed : deterministicReview(aggregates);
  return {
    output,
    evidence: aggregates.evidence,
    sourceHash,
    model,
  };
}

async function requestStructuredReview({ apiKey, model, aggregates }: { apiKey: string; model: string; aggregates: ReviewAggregates }): Promise<WeeklyReviewOutput | null> {
  const openai = new OpenAI({ apiKey });
  const response = await openai.responses.parse({
    model,
    store: false,
    max_output_tokens: 700,
    input: [
      {
        role: "system",
        content: "You are IntentHour's restrained weekly review writer. Return exactly two concise, practical observations grounded only in the aggregate facts supplied. Never invent a metric. Pick evidenceKey values that directly support each suggestion and do not repeat a key. Do not score or grade the person.",
      },
      { role: "user", content: JSON.stringify(aggregates) },
    ],
    text: { format: zodTextFormat(weeklyReviewOutputSchema, "weekly_review") },
  });
  return response.output_parsed;
}

function deterministicReview(aggregates: ReturnType<typeof buildReviewAggregates>) {
  const top = (Object.entries(aggregates.categoryCounts) as Array<[InterruptionCategory, number]>).sort((a, b) => b[1] - a[1])[0] ?? ["other", 0] as const;
  return { insights: [
    { headline: `${categoryLabel(top[0])} was the most common interruption.`, suggestion: "Keep a capture note beside the timer, mark the thought, and return to the chosen outcome.", evidenceKey: "top_interruption" as const },
    { headline: "Use the time window that protected your intention.", suggestion: "Place the next meaningful outcome in the part of the day where completed and moved-forward sessions already cluster.", evidenceKey: "intention_kept" as const },
  ] };
}
