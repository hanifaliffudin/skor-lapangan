import { describe, expect, it, vi } from "vitest";
import {
  assertQueueAssignment,
  createClubSessionManagement,
  derivePlayerRecords,
  type ClubSessionAdapter,
  type ClubSessionCourt,
  type ClubSessionMatch,
  type ClubSessionPlayer,
  type ClubSessionSummary,
} from "./clubSessionManagement";

const session: ClubSessionSummary = {
  id: "session-1",
  name: "Saturday doubles",
  session_date: "2026-10-19",
  status: "active",
  created_at: "2026-10-19T00:00:00.000Z",
};

const players: ClubSessionPlayer[] = [
  { id: "p-1", display_name: "One", sort_order: 0, is_active: true },
  { id: "p-2", display_name: "Two", sort_order: 1, is_active: true },
  { id: "p-3", display_name: "Three", sort_order: 2, is_active: true },
  { id: "p-4", display_name: "Four", sort_order: 3, is_active: true },
];

const courts: ClubSessionCourt[] = [
  { id: "court-1", name: "Court 1", sort_order: 0, is_active: true },
];

const queue: ClubSessionMatch[] = [
  {
    id: "queue-1",
    match_id: "match-1",
    linked_match_id: null,
    court_id: "court-1",
    team_a_player_1: "p-1",
    team_a_player_2: "p-2",
    team_b_player_1: "p-3",
    team_b_player_2: "p-4",
    queue_order: 4,
    started_at: null,
  },
];

function adapter(
  overrides: Partial<ClubSessionAdapter> = {},
): ClubSessionAdapter {
  return {
    listSessions: vi.fn().mockResolvedValue([]),
    loadSession: vi.fn(),
    createSession: vi.fn(),
    addPlayer: vi.fn(),
    addCourt: vi.fn(),
    setPlayerActive: vi.fn(),
    setCourtActive: vi.fn(),
    addQueuedMatch: vi.fn(),
    markMatchStarted: vi.fn(),
    removeQueuedMatch: vi.fn(),
    setStatus: vi.fn(),
    deleteSession: vi.fn(),
    ...overrides,
  };
}

describe("Club Session management", () => {
  it("rejects duplicate or inactive queue assignments", () => {
    expect(() =>
      assertQueueAssignment({
        session,
        players,
        courts,
        courtId: "court-1",
        playerIds: ["p-1", "p-1", "p-3", "p-4"],
      }),
    ).toThrow("CLUB_SESSION_ASSIGNMENT_INVALID");

    expect(() =>
      assertQueueAssignment({
        session,
        players: players.map((player) =>
          player.id === "p-4" ? { ...player, is_active: false } : player,
        ),
        courts,
        courtId: "court-1",
        playerIds: ["p-1", "p-2", "p-3", "p-4"],
      }),
    ).toThrow("CLUB_SESSION_ASSIGNMENT_INVALID");
  });

  it("keeps completed results local to the player record calculation", () => {
    const completedQueue: ClubSessionMatch[] = [
      { ...queue[0]!, linked_match_id: "match-1" },
    ];
    const records = derivePlayerRecords(players, completedQueue, {
      "match-1": { id: "match-1", status: "complete", winner: "B" },
    });

    expect(records.get("p-1")).toEqual({ played: 1, won: 0, lost: 1 });
    expect(records.get("p-3")).toEqual({ played: 1, won: 1, lost: 0 });
  });

  it("assigns the next queue order behind the management seam", async () => {
    const addQueuedMatch = vi.fn().mockResolvedValue(undefined);
    const management = createClubSessionManagement(adapter({ addQueuedMatch }));
    const randomUUID = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("00000000-0000-4000-8000-000000000002");

    await management.addQueuedMatch({
      session,
      players,
      courts,
      queue,
      courtId: "court-1",
      playerIds: ["p-1", "p-2", "p-3", "p-4"],
    });

    expect(addQueuedMatch).toHaveBeenCalledWith({
      sessionId: "session-1",
      matchId: "00000000-0000-4000-8000-000000000002",
      courtId: "court-1",
      playerIds: ["p-1", "p-2", "p-3", "p-4"],
      queueOrder: 5,
    });
    randomUUID.mockRestore();
  });
});
