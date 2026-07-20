import { describe, expect, it, vi } from "vitest";
import { generateReview, parseDeepSeekReviewContent } from "../../worker/review";
import { interruption, session } from "./fixtures";

const env = {
  DEEPSEEK_API_KEY: "test-key",
  DEEPSEEK_REVIEW_MODEL: "deepseek-v4-flash",
};

describe("weekly review generation", () => {
  it("sends aggregate facts only and keeps server-rendered evidence", async () => {
    const privateText = "Confidential acquisition project";
    const requester = vi.fn(({ aggregates }: { aggregates: unknown }) => {
      expect(JSON.stringify(aggregates)).not.toContain(privateText);
      return Promise.resolve({ insights: [
        { headline: "Capture new ideas", suggestion: "Use a nearby capture note.", evidenceKey: "top_interruption" },
        { headline: "Repeat protected sessions", suggestion: "Use the same reliable window.", evidenceKey: "intention_kept" },
      ] });
    });

    const result = await generateReview(
      env,
      [session({ intention: privateText, outcomeNote: privateText })],
      [interruption({ note: privateText })],
      requester,
    );

    expect(requester).toHaveBeenCalledOnce();
    expect(result.model).toBe("deepseek-v4-flash");
    expect(result.evidence.intention_kept).toBe("1 of 1 sessions ended as completed or moved forward.");
  });

  it("falls back deterministically when model evidence keys repeat", async () => {
    const repeated = { insights: [
      { headline: "First", suggestion: "First action", evidenceKey: "intention_kept" },
      { headline: "Second", suggestion: "Second action", evidenceKey: "intention_kept" },
    ] };

    const result = await generateReview(env, [session()], [interruption()], () => Promise.resolve(repeated));

    expect(result.output.insights.map((item) => item.evidenceKey)).toEqual(["top_interruption", "intention_kept"]);
    expect(result.output.insights[0]?.headline).toContain("New idea");
  });

  it("treats empty or malformed DeepSeek JSON as unusable", () => {
    expect(parseDeepSeekReviewContent(null)).toBeNull();
    expect(parseDeepSeekReviewContent("not-json")).toBeNull();
    expect(parseDeepSeekReviewContent('{"insights":[]}')).toEqual({ insights: [] });
  });
});
