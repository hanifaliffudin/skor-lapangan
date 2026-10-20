import { describe, expect, it } from "vitest";
import {
  clubSessionMatchAction,
  clubSessionMatchStage,
} from "./clubSessionMatchHandoff";
import type { ClubSessionMatch } from "./clubSessionManagement";

const entry: ClubSessionMatch = {
  id: "queue-1",
  match_id: "match-1",
  linked_match_id: null,
  court_id: "court-1",
  team_a_player_1: "p-1",
  team_a_player_2: "p-2",
  team_b_player_1: "p-3",
  team_b_player_2: "p-4",
  queue_order: 0,
  started_at: null,
};

describe("Club Session Match handoff", () => {
  it("keeps queued, started, linked, and completed stages explicit", () => {
    expect(clubSessionMatchStage(entry, null)).toBe("queued");
    expect(
      clubSessionMatchStage(
        { ...entry, started_at: "2026-10-19T10:00:00.000Z" },
        null,
      ),
    ).toBe("started");
    expect(
      clubSessionMatchStage(
        { ...entry, linked_match_id: "match-1" },
        { id: "match-1", status: "active", winner: null },
      ),
    ).toBe("linked");
    expect(
      clubSessionMatchStage(
        { ...entry, linked_match_id: "match-1" },
        { id: "match-1", status: "complete", winner: "A" },
      ),
    ).toBe("completed");
  });

  it("resumes started entries and preserves a single Match identity", () => {
    expect(
      clubSessionMatchAction({
        sessionStatus: "active",
        entry: { ...entry, started_at: "2026-10-19T10:00:00.000Z" },
      }),
    ).toEqual({ type: "resume", matchId: "match-1" });
  });

  it("allows linked Matches to open after the Club Session is completed", () => {
    expect(
      clubSessionMatchAction({
        sessionStatus: "completed",
        entry: { ...entry, linked_match_id: "match-1" },
      }),
    ).toEqual({ type: "open", matchId: "match-1" });
  });

  it("blocks a new queue entry from a completed Club Session", () => {
    expect(
      clubSessionMatchAction({
        sessionStatus: "completed",
        entry,
      }),
    ).toEqual({ type: "blocked", reason: "session_completed" });
  });
});
