import { describe, expect, it } from "vitest";
import { sanitizeAnalyticsEvent } from "./analytics";

describe("sanitizeAnalyticsEvent", () => {
  it("removes live viewer tokens, query parameters, and fragments", () => {
    expect(
      sanitizeAnalyticsEvent({
        type: "pageview",
        url: "https://skor-lapangan.vercel.app/view/secret-token?source=share#score",
      }),
    ).toEqual({ type: "pageview", url: "/view/[token]" });
  });

  it("redacts match and community rule identifiers", () => {
    expect(
      sanitizeAnalyticsEvent({
        type: "pageview",
        url: "/match/7d4f2bc0-b4a8-47d0-8b36-a3dd1835a117",
      }),
    ).toEqual({ type: "pageview", url: "/match/[matchId]" });
    expect(
      sanitizeAnalyticsEvent({
        type: "event",
        url: "/rules/community-rule-secret/edit?draft=1",
      }),
    ).toEqual({ type: "event", url: "/rules/[ruleId]/edit" });
  });

  it("keeps static routes while stripping all query and hash data", () => {
    expect(
      sanitizeAnalyticsEvent({
        type: "pageview",
        url: "https://skor-lapangan.vercel.app/rules/new?returnTo=%2Fmatch%2Fsecret#form",
      }),
    ).toEqual({ type: "pageview", url: "/rules/new" });
    expect(
      sanitizeAnalyticsEvent({
        type: "pageview",
        url: "/history?filter=recent",
      }),
    ).toEqual({ type: "pageview", url: "/history" });
  });
});
