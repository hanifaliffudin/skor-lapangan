const millisecondsPerMinute = 60_000;

export function clubSessionRoundRemainingMs(
  startedAt: string,
  roundMinutes: number,
  now = Date.now(),
): number | null {
  const startedAtMs = Date.parse(startedAt);
  if (
    !Number.isFinite(startedAtMs) ||
    !Number.isFinite(roundMinutes) ||
    roundMinutes <= 0
  ) {
    return null;
  }

  return Math.max(0, startedAtMs + roundMinutes * millisecondsPerMinute - now);
}

export function formatClubSessionCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
