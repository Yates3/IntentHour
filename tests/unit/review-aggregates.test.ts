import { describe, expect, it } from "vitest";
import { buildReviewAggregates } from "../../shared/review-aggregates";
import { interruption, session } from "./fixtures";

describe("weekly review facts", () => {
  it("computes intention kept and evidence from real aggregates", () => {
    const sessions = [
      session(),
      session({ id: "33333333-3333-4333-8333-333333333333", outcome: "blocked", startedAt: "2026-07-14T13:00:00.000Z", endedAt: "2026-07-14T14:00:00.000Z" }),
      session({ id: "44444444-4444-4444-8444-444444444444", outcome: "completed", startedAt: "2026-07-15T09:00:00.000Z", endedAt: "2026-07-15T09:30:00.000Z" }),
    ];
    const marks = [interruption(), interruption({ id: "55555555-5555-4555-8555-555555555555", category: "new_idea", sessionId: sessions[1]!.id })];
    const aggregate = buildReviewAggregates(sessions, marks);
    expect(aggregate.intentionKeptCount).toBe(2);
    expect(aggregate.sessionCount).toBe(3);
    expect(aggregate.categoryCounts.new_idea).toBe(2);
    expect(aggregate.evidence.intention_kept).toBe("2 of 3 sessions ended as completed or moved forward.");
    expect(aggregate.evidence.top_interruption).toContain("New idea was marked 2 times");
  });

  it("never includes intention or note text in the model payload", () => {
    const privateText = "Confidential acquisition project";
    const aggregate = buildReviewAggregates([session({ intention: privateText, outcomeNote: privateText })], [interruption({ note: privateText })]);
    expect(JSON.stringify(aggregate)).not.toContain(privateText);
  });
});
