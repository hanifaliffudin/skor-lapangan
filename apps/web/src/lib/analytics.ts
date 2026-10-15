import { track } from "@vercel/analytics";
import type { BeforeSendEvent } from "@vercel/analytics/react";

const ANALYTICS_BASE_URL = "https://skor-lapangan.invalid";

export function sanitizeAnalyticsEvent(
  event: BeforeSendEvent,
): BeforeSendEvent {
  const url = new URL(event.url, ANALYTICS_BASE_URL);
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

  return { ...event, url: pathname };
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
