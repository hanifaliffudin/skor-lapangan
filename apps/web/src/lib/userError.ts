export function isRateLimitError(message: string | null | undefined): boolean {
  const normalized = message?.toLowerCase() ?? "";
  return (
    normalized.includes("rate_limit:") ||
    normalized.includes("rate limit") ||
    normalized.includes("security purposes")
  );
}
