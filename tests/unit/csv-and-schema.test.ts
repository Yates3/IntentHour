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

  it("neutralizes spreadsheet formulas in exported user text", () => {
    expect(escapeCsv("=HYPERLINK(\"https://example.com\")")).toBe("\"'=HYPERLINK(\"\"https://example.com\"\")\"");
    expect(escapeCsv(" +SUM(1,2)")).toBe("\"' +SUM(1,2)\"");
    expect(escapeCsv("@danger")).toBe("'@danger");
    expect(escapeCsv("safe - text")).toBe("safe - text");
  });

  it("requires exactly two valid evidence-backed AI insights", () => {
    const validInsight = { headline: "Protect the morning", suggestion: "Use the same start window next week.", evidenceKey: "morning_completion" };
    expect(weeklyReviewOutputSchema.safeParse({ insights: [validInsight, { ...validInsight, evidenceKey: "intention_kept" }] }).success).toBe(true);
    expect(weeklyReviewOutputSchema.safeParse({ insights: [validInsight] }).success).toBe(false);
    expect(weeklyReviewOutputSchema.safeParse({ insights: [validInsight, { ...validInsight, evidenceKey: "invented_metric" }] }).success).toBe(false);
  });
});
