import {
  deriveJournal,
  type MatchJournal,
  type MatchFormat,
  type Sport,
  type TeamId,
} from "@skor-lapangan/scoring-core";
import type { Json } from "./database.types";

export type MatchResultSummary = {
  id: string;
  sport: Sport;
  format: MatchFormat;
  status: "active" | "complete";
  winner: TeamId | null;
  teamAName: string;
  teamBName: string;
  finalScore: { A: number; B: number };
  completedAt: string;
};

export type MatchResultShare = { title: string; text: string };

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export interface ShareAdapter {
  share?:
    ((data: { title: string; text: string }) => Promise<void>) | undefined;
  writeText?: ((text: string) => Promise<void>) | undefined;
}

const sports = new Set<Sport>([
  "badminton",
  "pickleball",
  "tennis",
  "padel",
  "table_tennis",
  "squash",
]);

function scoreRecord(value: unknown): { A: number; B: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return typeof record.A === "number" && typeof record.B === "number"
    ? { A: record.A, B: record.B }
    : null;
}

function sportOf(value: unknown): Sport {
  return sports.has(value as Sport) ? (value as Sport) : "badminton";
}

function formatOf(value: unknown): MatchFormat {
  return value === "singles" || value === "mixed_doubles" ? value : "doubles";
}

function finalScore(state: unknown): { A: number; B: number } {
  if (!state || typeof state !== "object" || Array.isArray(state))
    return { A: 0, B: 0 };
  const record = state as Record<string, unknown>;
  const tennis = record.tennis;
  if (tennis && typeof tennis === "object" && !Array.isArray(tennis)) {
    const sets = scoreRecord((tennis as Record<string, unknown>).setsWon);
    if (sets) return sets;
  }
  const padel = record.padel;
  if (padel && typeof padel === "object" && !Array.isArray(padel)) {
    const sets = scoreRecord((padel as Record<string, unknown>).setsWon);
    if (sets) return sets;
  }
  return (
    scoreRecord(record.gamesWon) ?? scoreRecord(record.points) ?? { A: 0, B: 0 }
  );
}

function lastCreatedAt(journal: MatchJournal): string {
  return journal.events.at(-1)?.createdAt ?? journal.definition.createdAt;
}

export function resultSummaryFromJournal(
  journal: MatchJournal,
): MatchResultSummary {
  const derived = deriveJournal(journal);
  const definition = journal.definition;
  return {
    id: definition.id,
    sport: definition.sport,
    format: definition.format ?? "doubles",
    status: derived.state.status,
    winner: derived.state.winner,
    teamAName: definition.teams.A.name || "Team A",
    teamBName: definition.teams.B.name || "Team B",
    finalScore: finalScore(derived.state),
    completedAt: lastCreatedAt(journal),
  };
}

export interface RemoteMatchSummaryRow {
  id: string;
  sport: string;
  status: string;
  winner: string | null;
  team_a_name?: string | null;
  team_b_name?: string | null;
  current_state: Json;
  created_at: string;
  updated_at: string;
}

export function resultSummaryFromRemote(
  row: RemoteMatchSummaryRow,
): MatchResultSummary {
  const state = row.current_state as Record<string, unknown>;
  return {
    id: row.id,
    sport: sportOf(row.sport),
    format: formatOf(state?.format),
    status: row.status === "complete" ? "complete" : "active",
    winner: row.winner === "A" || row.winner === "B" ? row.winner : null,
    teamAName: row.team_a_name?.trim() || "Team A",
    teamBName: row.team_b_name?.trim() || "Team B",
    finalScore: finalScore(row.current_state),
    completedAt: row.updated_at || row.created_at,
  };
}

export function formatMatchResultShare(
  summary: MatchResultSummary,
  labels: { appName: string; sport: string; format: string; playedAt: string },
): MatchResultShare {
  const title = `${labels.appName} · ${labels.sport}`;
  const teamAName = summary.teamAName.trim() || "Team A";
  const teamBName = summary.teamBName.trim() || "Team B";
  const text = [
    labels.appName,
    `${labels.sport} · ${labels.format}`,
    `${teamAName} ${summary.finalScore.A}–${summary.finalScore.B} ${teamBName}`,
    `${labels.playedAt}: ${summary.completedAt}`,
  ].join("\n");
  return { title, text };
}

export async function shareMatchResult(
  payload: MatchResultShare,
  adapter: ShareAdapter,
): Promise<ShareResult> {
  if (adapter.share) {
    try {
      await adapter.share(payload);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        return "cancelled";
      if ((error as { name?: string } | null)?.name === "AbortError")
        return "cancelled";
      return "failed";
    }
  }
  if (!adapter.writeText) return "failed";
  try {
    await adapter.writeText(payload.text);
    return "copied";
  } catch {
    return "failed";
  }
}
