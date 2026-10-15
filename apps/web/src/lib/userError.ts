export function isRateLimitError(message: string | null | undefined): boolean {
  const normalized = message?.toLowerCase() ?? "";
  return (
    normalized.includes("rate_limit:") ||
    normalized.includes("rate limit") ||
    normalized.includes("security purposes")
  );
}

export function isUnsupportedMatchSportError(
  message: string | null | undefined,
): boolean {
  const normalized = message?.toLowerCase() ?? "";
  return (
    normalized.includes("matches_sport_check") ||
    normalized.includes("match_events_event_type_check")
  );
}

export function isSyncConflictError(
  message: string | null | undefined,
): boolean {
  return message === "SYNC_CONFLICT";
}

export function isMatchControlHeldError(
  message: string | null | undefined,
): boolean {
  return message === "CONTROL_HELD";
}

export function isMatchControlLostError(
  message: string | null | undefined,
): boolean {
  return message === "CONTROL_LOST";
}
