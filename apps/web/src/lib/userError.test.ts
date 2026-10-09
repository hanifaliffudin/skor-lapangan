import { describe, expect, it } from "vitest";
import { isRateLimitError } from "./userError";

describe("isRateLimitError", () => {
  it("recognizes app and Supabase authentication rate limits", () => {
    expect(isRateLimitError("RATE_LIMIT: community_rule_report")).toBe(true);
    expect(isRateLimitError("Email rate limit exceeded")).toBe(true);
    expect(
      isRateLimitError("For security purposes, wait before retrying"),
    ).toBe(true);
  });

  it("does not mask unrelated errors", () => {
    expect(isRateLimitError("Network request failed")).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});
