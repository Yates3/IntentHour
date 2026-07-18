import { describe, expect, it } from "vitest";
import { escapeCsv } from "../../shared/csv";
import { weeklyReviewOutputSchema } from "../../shared/contracts";

describe("export and structured review contracts", () => {
  it("escapes commas, quotes, and newlines according to RFC 4180", () => {
    expect(escapeCsv("plain")).toBe("plain");
    expect(escapeCsv("one,two")).toBe('"one,two"');
    expect(escapeCsv('say "now"')).toBe('"say ""now"""');
    expect(escapeCsv("line one\nline two")).toBe('"line one\nline two"');
  });

  it("requires exactly two valid evidence-backed AI insights", () => {
    const validInsight = { headline: "Protect the morning", suggestion: "Use the same start window next week.", evidenceKey: "morning_completion" };
    expect(weeklyReviewOutputSchema.safeParse({ insights: [validInsight, { ...validInsight, evidenceKey: "intention_kept" }] }).success).toBe(true);
    expect(weeklyReviewOutputSchema.safeParse({ insights: [validInsight] }).success).toBe(false);
    expect(weeklyReviewOutputSchema.safeParse({ insights: [validInsight, { ...validInsight, evidenceKey: "invented_metric" }] }).success).toBe(false);
  });
});
