import { track } from "@vercel/analytics";
import type { BeforeSendEvent } from "@vercel/analytics/react";

const ANALYTICS_BASE_URL = "https://skor-lapangan.invalid";

export function sanitizeAnalyticsEvent(
  event: BeforeSendEvent,
): BeforeSendEvent {
  const baseUrl =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : ANALYTICS_BASE_URL;
  const url = new URL(event.url, baseUrl);
  let pathname = url.pathname;

  pathname = pathname.replace(/^\/view\/[^/]+(?=\/|$)/, "/view/[token]");
  pathname = pathname.replace(/^\/match\/[^/]+(?=\/|$)/, "/match/[matchId]");

  if (pathname !== "/rules/new") {
    pathname = pathname.replace(
      /^\/rules\/[^/]+\/edit(?=\/|$)/,
      "/rules/[ruleId]/edit",
    );
    pathname = pathname.replace(/^\/rules\/[^/]+(?=\/|$)/, "/rules/[ruleId]");
  }

  return { ...event, url: `${url.origin}${pathname}` };
}

export function trackMatchSignal(
  signal:
    | "control_lost"
    | "control_takeover"
    | "sync_conflict"
    | "remote_invalid"
    | "remote_unavailable",
  result: "detected" | "resolved" | "failed",
): void {
  track(`Match ${signal}`, { result });
}
