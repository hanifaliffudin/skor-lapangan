import type {
  ClubSessionMatch,
  ClubSessionMatchResult,
  ClubSessionStatus,
} from "./clubSessionManagement";

export type ClubSessionMatchStage =
  "queued" | "started" | "linked" | "completed";

export type ClubSessionMatchAction =
  | { type: "start"; matchId: string }
  | { type: "resume"; matchId: string }
  | { type: "open"; matchId: string }
  | { type: "blocked"; reason: "session_completed" };

export function clubSessionMatchStage(
  entry: ClubSessionMatch,
  result: ClubSessionMatchResult | null,
): ClubSessionMatchStage {
  if (entry.linked_match_id && result?.status === "complete") {
    return "completed";
  }
  if (entry.linked_match_id) return "linked";
  if (entry.started_at) return "started";
  return "queued";
}

export function clubSessionMatchAction(input: {
  sessionStatus: ClubSessionStatus;
  entry: ClubSessionMatch;
}): ClubSessionMatchAction {
  if (input.entry.linked_match_id) {
    return { type: "open", matchId: input.entry.linked_match_id };
  }
  if (input.entry.started_at) {
    return { type: "resume", matchId: input.entry.match_id };
  }
  if (input.sessionStatus !== "active") {
    return { type: "blocked", reason: "session_completed" };
  }
  return { type: "start", matchId: input.entry.match_id };
}
