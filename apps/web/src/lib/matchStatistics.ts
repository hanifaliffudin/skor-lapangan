import type { MatchResultSummary } from "./matchResult";
import type { Sport, TeamId } from "@skor-lapangan/scoring-core";

export type MatchStatistics = {
  completedMatches: number;
  teamAWins: number;
  teamBWins: number;
  teamAWinRate: number | null;
  teamBWinRate: number | null;
  bySport: Array<{
    sport: Sport;
    completedMatches: number;
    teamAWins: number;
    teamBWins: number;
  }>;
};

export type StatisticsFilters = {
  search?: string;
  sport?: Sport | "all";
  winner?: "all" | TeamId;
  fromDate?: string | undefined;
  toDate?: string | undefined;
};

const sportOrder: Sport[] = [
  "badminton",
  "pickleball",
  "tennis",
  "padel",
  "table_tennis",
  "squash",
];

function matchesDate(
  summary: MatchResultSummary,
  filters: StatisticsFilters,
): boolean {
  const time = Date.parse(summary.completedAt);
  if (filters.fromDate) {
    const from = Date.parse(filters.fromDate);
    if (!Number.isNaN(from) && (Number.isNaN(time) || time < from))
      return false;
  }
  if (filters.toDate) {
    const to = Date.parse(filters.toDate);
    if (!Number.isNaN(to) && (Number.isNaN(time) || time >= to)) return false;
  }
  return true;
}

export function matchesStatisticsFilters(
  summary: MatchResultSummary,
  filters: StatisticsFilters = {},
): boolean {
  if (summary.status !== "complete") return false;
  if (
    filters.sport &&
    filters.sport !== "all" &&
    summary.sport !== filters.sport
  )
    return false;
  if (
    filters.winner &&
    filters.winner !== "all" &&
    summary.winner !== filters.winner
  )
    return false;
  const search = filters.search?.trim().toLowerCase();
  if (
    search &&
    !`${summary.sport} ${summary.teamAName} ${summary.teamBName} ${summary.id}`
      .toLowerCase()
      .includes(search)
  )
    return false;
  return matchesDate(summary, filters);
}

export function calculateMatchStatistics(
  summaries: MatchResultSummary[],
  filters: StatisticsFilters = {},
): MatchStatistics {
  const completed = summaries.filter((summary) =>
    matchesStatisticsFilters(summary, filters),
  );
  const bySport = sportOrder
    .map((sport) => {
      const matches = completed.filter((summary) => summary.sport === sport);
      return {
        sport,
        completedMatches: matches.length,
        teamAWins: matches.filter((summary) => summary.winner === "A").length,
        teamBWins: matches.filter((summary) => summary.winner === "B").length,
      };
    })
    .filter((item) => item.completedMatches > 0);
  const teamAWins = completed.filter(
    (summary) => summary.winner === "A",
  ).length;
  const teamBWins = completed.filter(
    (summary) => summary.winner === "B",
  ).length;
  return {
    completedMatches: completed.length,
    teamAWins,
    teamBWins,
    teamAWinRate: completed.length ? teamAWins / completed.length : null,
    teamBWinRate: completed.length ? teamBWins / completed.length : null,
    bySport,
  };
}

export function localDateRangeToIso(
  fromDate: string,
  toDate: string,
): { from: string | null; to: string | null } {
  const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
  const to = toDate ? new Date(`${toDate}T00:00:00`) : null;
  if (to) to.setDate(to.getDate() + 1);
  return {
    from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : null,
    to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : null,
  };
}
