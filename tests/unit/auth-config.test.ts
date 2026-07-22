import { describe, expect, it } from "vitest";
import { authOrigins } from "../../worker/auth-origins";

describe("auth deployment origins", () => {
  it("keeps the primary auth URL first and deduplicates allowed origins", () => {
    expect(authOrigins({
      BETTER_AUTH_URL: "https://intenthour.yates-33.top",
      APP_URL: "https://intenthour.yates-33.top/app",
      APP_ALLOWED_ORIGINS: "https://intenthour-staging.ylin99207.workers.dev, https://intenthour.yates-33.top",
    })).toEqual([
      "https://intenthour.yates-33.top",
      "https://intenthour-staging.ylin99207.workers.dev",
    ]);
  });

  it("ignores malformed origin entries", () => {
    expect(authOrigins({
      APP_URL: "https://intenthour.yates-33.top",
      APP_ALLOWED_ORIGINS: "not a url",
    })).toEqual([
      "https://intenthour.yates-33.top",
    ]);
  });
});
