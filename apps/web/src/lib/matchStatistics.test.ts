import { describe, expect, it } from "vitest";
import {
  calculateMatchStatistics,
  localDateRangeToIso,
} from "./matchStatistics";
import type { MatchResultSummary } from "./matchResult";

const match = (overrides: Partial<MatchResultSummary>): MatchResultSummary => ({
  id: crypto.randomUUID(),
  sport: "badminton",
  format: "doubles",
  status: "complete",
  winner: "A",
  teamAName: "A",
  teamBName: "B",
  finalScore: { A: 21, B: 10 },
  completedAt: "2026-10-26T08:00:00.000Z",
  ...overrides,
});

describe("match statistics", () => {
  it("ignores active matches and counts per sport", () => {
    const stats = calculateMatchStatistics([
      match({ sport: "badminton" }),
      match({ sport: "tennis", winner: "B" }),
      match({ status: "active", sport: "squash", winner: null }),
    ]);
    expect(stats.completedMatches).toBe(2);
    expect(stats.teamAWins).toBe(1);
    expect(stats.teamBWins).toBe(1);
    expect(stats.bySport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sport: "badminton", completedMatches: 1 }),
        expect.objectContaining({ sport: "tennis", teamBWins: 1 }),
      ]),
    );
  });

  it("applies winner and inclusive local date filters", () => {
    const stats = calculateMatchStatistics(
      [
        match({ completedAt: "2026-10-26T00:30:00.000Z", winner: "A" }),
        match({ completedAt: "2026-10-27T00:30:00.000Z", winner: "B" }),
      ],
      {
        winner: "A",
        fromDate: "2026-10-26T00:00:00.000Z",
        toDate: "2026-10-27T00:00:00.000Z",
      },
    );
    expect(stats.completedMatches).toBe(1);
    expect(stats.teamAWinRate).toBe(1);
  });

  it("creates an exclusive next-day end boundary", () => {
    const range = localDateRangeToIso("2026-10-26", "2026-10-26");
    expect(range.to).toBeTruthy();
    expect(Date.parse(range.to!) - Date.parse(range.from!)).toBe(
      24 * 60 * 60 * 1000,
    );
  });
});
