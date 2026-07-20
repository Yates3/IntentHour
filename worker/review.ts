import OpenAI from "openai";
import { weeklyReviewOutputSchema, type FocusSession, type Interruption, type InterruptionCategory } from "../shared/contracts";
import { buildReviewAggregates, categoryLabel } from "../shared/review-aggregates";
import { sha256 } from "./security";

type ReviewAggregates = ReturnType<typeof buildReviewAggregates>;
type ReviewRequester = (input: { apiKey: string; model: string; aggregates: ReviewAggregates }) => Promise<unknown>;
interface ReviewEnv {
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_REVIEW_MODEL?: string;
}

export async function generateReview(env: ReviewEnv, sessions: FocusSession[], interruptions: Interruption[], requestReview: ReviewRequester = requestStructuredReview) {
  const aggregates = buildReviewAggregates(sessions, interruptions);
  const sourceHash = await sha256(JSON.stringify(aggregates));
  const model = env.DEEPSEEK_REVIEW_MODEL || "deepseek-v4-flash";
  const candidate = weeklyReviewOutputSchema.safeParse(await requestReview({ apiKey: env.DEEPSEEK_API_KEY, model, aggregates }));
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

async function requestStructuredReview({ apiKey, model, aggregates }: { apiKey: string; model: string; aggregates: ReviewAggregates }): Promise<unknown> {
  const deepseek = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  const response = await deepseek.chat.completions.create({
    model,
    max_tokens: 700,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are IntentHour's restrained weekly review writer. Return JSON only, with exactly this shape: {\"insights\":[{\"headline\":\"...\",\"suggestion\":\"...\",\"evidenceKey\":\"top_interruption|morning_completion|long_session_drift|intention_kept\"},{\"headline\":\"...\",\"suggestion\":\"...\",\"evidenceKey\":\"...\"}]}. Keep both observations concise and practical. Use only the aggregate facts supplied, never invent a metric, and use two different evidenceKey values that directly support the suggestions. Do not score or grade the person.",
      },
      { role: "user", content: JSON.stringify(aggregates) },
    ],
  });
  return parseDeepSeekReviewContent(response.choices[0]?.message.content);
}

export function parseDeepSeekReviewContent(content: string | null | undefined): unknown {
  if (!content) return null;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

function deterministicReview(aggregates: ReturnType<typeof buildReviewAggregates>) {
  const top = (Object.entries(aggregates.categoryCounts) as Array<[InterruptionCategory, number]>).sort((a, b) => b[1] - a[1])[0] ?? ["other", 0] as const;
  return { insights: [
    { headline: `${categoryLabel(top[0])} was the most common interruption.`, suggestion: "Keep a capture note beside the timer, mark the thought, and return to the chosen outcome.", evidenceKey: "top_interruption" as const },
    { headline: "Use the time window that protected your intention.", suggestion: "Place the next meaningful outcome in the part of the day where completed and moved-forward sessions already cluster.", evidenceKey: "intention_kept" as const },
  ] };
}
