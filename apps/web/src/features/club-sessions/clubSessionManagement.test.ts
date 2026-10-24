import { describe, expect, it, vi } from "vitest";
import {
  assertQueueAssignment,
  createClubSessionManagement,
  derivePlayerRecords,
  deriveStandings,
  generateDoublesSchedule,
  planSmartRotation,
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
    updatePlayerProfile: vi.fn(),
    addQueuedMatch: vi.fn(),
    addQueuedMatches: vi.fn(),
    markMatchStarted: vi.fn(),
    removeQueuedMatch: vi.fn(),
    setStatus: vi.fn(),
    deleteSession: vi.fn(),
    ...overrides,
  };
}

describe("Club Session management", () => {
  it("plans the lowest-count eligible players for each free court", () => {
    const plan = planSmartRotation({
      session,
      players: [
        ...players,
        { id: "p-5", display_name: "Five", sort_order: 4, is_active: true },
        { id: "p-6", display_name: "Six", sort_order: 5, is_active: true },
        { id: "p-7", display_name: "Seven", sort_order: 6, is_active: true },
        { id: "p-8", display_name: "Eight", sort_order: 7, is_active: true },
      ],
      courts: [
        ...courts,
        { id: "court-2", name: "Court 2", sort_order: 1, is_active: true },
      ],
      queue: [
        {
          ...queue[0]!,
          id: "finished-1",
          match_id: "finished-1",
          linked_match_id: "finished-1",
          started_at: "2026-10-19T10:00:00.000Z",
        },
      ],
      results: {
        "finished-1": {
          id: "finished-1",
          status: "complete",
          winner: "A",
        },
      },
    });

    expect(plan.matches).toHaveLength(2);
    expect(plan.matches[0]?.playerIds).toEqual(["p-5", "p-6", "p-7", "p-8"]);
    expect(plan.matches[0]?.explanation).toMatchObject({
      playerCounts: [0, 0, 0, 0],
      fairnessGap: 0,
    });
    expect(new Set(plan.matches[1]?.playerIds)).toEqual(
      new Set(["p-1", "p-2", "p-3", "p-4"]),
    );
  });

  it("fills only the free court when another court is still occupied", () => {
    const plan = planSmartRotation({
      session,
      players: [
        ...players,
        { id: "p-5", display_name: "Five", sort_order: 4, is_active: true },
        { id: "p-6", display_name: "Six", sort_order: 5, is_active: true },
        { id: "p-7", display_name: "Seven", sort_order: 6, is_active: true },
        { id: "p-8", display_name: "Eight", sort_order: 7, is_active: true },
      ],
      courts: [
        ...courts,
        { id: "court-2", name: "Court 2", sort_order: 1, is_active: true },
      ],
      queue: [
        {
          ...queue[0]!,
          id: "active-1",
          match_id: "active-1",
          started_at: "2026-10-19T10:00:00.000Z",
        },
      ],
      results: {},
    });

    expect(plan.matches).toHaveLength(1);
    expect(plan.matches[0]).toMatchObject({
      courtId: "court-2",
      playerIds: ["p-5", "p-6", "p-7", "p-8"],
    });
  });

  it("does not reuse players or courts occupied by unfinished queue entries", () => {
    const plan = planSmartRotation({
      session,
      players: [
        ...players,
        { id: "p-5", display_name: "Five", sort_order: 4, is_active: true },
        { id: "p-6", display_name: "Six", sort_order: 5, is_active: true },
        { id: "p-7", display_name: "Seven", sort_order: 6, is_active: true },
        { id: "p-8", display_name: "Eight", sort_order: 7, is_active: true },
      ],
      courts: [
        ...courts,
        { id: "court-2", name: "Court 2", sort_order: 1, is_active: true },
      ],
      queue: [
        {
          ...queue[0]!,
          id: "active-1",
          match_id: "active-1",
          court_id: "court-1",
          started_at: "2026-10-19T10:00:00.000Z",
        },
        {
          ...queue[0]!,
          id: "queued-1",
          match_id: "queued-1",
          court_id: "court-2",
          team_a_player_1: "p-5",
          team_a_player_2: "p-6",
          team_b_player_1: "p-7",
          team_b_player_2: "p-8",
          started_at: null,
        },
      ],
      results: {},
    });

    expect(plan.matches).toEqual([]);
    expect(plan.reason).toBe("NO_FREE_COURT");
  });

  it("requires an explicit fallback when Mixed doubles has no valid composition", () => {
    const plan = planSmartRotation({
      session: { ...session, pairing_mode: "mixed" },
      players: players.map((player) => ({ ...player, gender: "unspecified" })),
      courts,
      queue: [],
      results: {},
    });

    expect(plan.matches).toEqual([]);
    expect(plan.reason).toBe("MIXED_FALLBACK_REQUIRED");
    expect(plan.canUseOpenFallback).toBe(true);

    const fallbackPlan = planSmartRotation({
      session: { ...session, pairing_mode: "mixed" },
      players: players.map((player) => ({ ...player, gender: "unspecified" })),
      courts,
      queue: [],
      results: {},
      allowOpenFallback: true,
    });
    expect(fallbackPlan.matches[0]?.isOpenFallback).toBe(true);
    expect(fallbackPlan.usedOpenFallback).toBe(true);
  });

  it("keeps Mixed doubles teams balanced by gender", () => {
    const plan = planSmartRotation({
      session: { ...session, pairing_mode: "mixed" },
      players: [
        { ...players[0]!, gender: "man" },
        { ...players[1]!, gender: "man" },
        { ...players[2]!, gender: "woman" },
        { ...players[3]!, gender: "woman" },
      ],
      courts,
      queue: [],
      results: {},
    });

    expect(plan.matches[0]?.playerIds).toEqual(["p-1", "p-3", "p-2", "p-4"]);
  });

  it("excludes late, resting, unavailable, and no-show players", () => {
    const plan = planSmartRotation({
      session,
      players: [
        { ...players[0]!, availability: "resting" },
        { ...players[1]!, availability: "late" },
        { ...players[2]!, availability: "unavailable" },
        players[3]!,
        { id: "p-5", display_name: "Five", sort_order: 4, is_active: true },
        { id: "p-6", display_name: "Six", sort_order: 5, is_active: true },
        { id: "p-7", display_name: "Seven", sort_order: 6, is_active: true },
      ],
      courts,
      queue: [],
      results: {},
    });

    expect(plan.matches[0]?.playerIds).toEqual(["p-4", "p-5", "p-6", "p-7"]);
  });

  it("finds a valid mixed match with an uneven gender roster", () => {
    const plan = planSmartRotation({
      session: { ...session, pairing_mode: "mixed" },
      players: [
        { ...players[0]!, gender: "man" },
        { ...players[1]!, gender: "man" },
        { ...players[2]!, gender: "man" },
        { ...players[3]!, gender: "woman" },
        {
          id: "p-5",
          display_name: "Five",
          sort_order: 4,
          is_active: true,
          gender: "woman",
        },
      ],
      courts,
      queue: [],
      results: {},
    });

    expect(plan.matches[0]?.playerIds).toEqual(["p-1", "p-4", "p-2", "p-5"]);
    expect(plan.matches[0]?.isOpenFallback).toBeUndefined();
  });

  it("prefers a new partnership and smaller skill gap after fairness ties", () => {
    const plan = planSmartRotation({
      session,
      players: [
        { ...players[0]!, skill_level: 2 },
        { ...players[1]!, skill_level: 2 },
        { ...players[2]!, skill_level: 4 },
        { ...players[3]!, skill_level: 4 },
        {
          id: "p-5",
          display_name: "Five",
          sort_order: 4,
          is_active: true,
          skill_level: 3,
        },
      ],
      courts,
      queue: [
        {
          ...queue[0]!,
          id: "history-1",
          match_id: "history-1",
          linked_match_id: "history-1",
          started_at: "2026-10-19T10:00:00.000Z",
        },
      ],
      results: {
        "history-1": { id: "history-1", status: "complete", winner: "A" },
      },
    });

    expect(plan.matches[0]?.playerIds).not.toEqual([
      "p-1",
      "p-2",
      "p-3",
      "p-4",
    ]);
  });

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

  it("requires an explicit open fallback for an invalid mixed manual assignment", () => {
    const mixedPlayers: ClubSessionPlayer[] = [
      { ...players[0]!, gender: "man" },
      { ...players[1]!, gender: "man" },
      { ...players[2]!, gender: "woman" },
      { ...players[3]!, gender: "woman" },
    ];
    const mixedSession = { ...session, pairing_mode: "mixed" as const };

    expect(() =>
      assertQueueAssignment({
        session: mixedSession,
        players: mixedPlayers,
        courts,
        courtId: "court-1",
        playerIds: ["p-1", "p-2", "p-3", "p-4"],
      }),
    ).toThrow("CLUB_SESSION_MIXED_ASSIGNMENT_INVALID");

    expect(() =>
      assertQueueAssignment({
        session: mixedSession,
        players: mixedPlayers,
        courts,
        courtId: "court-1",
        playerIds: ["p-1", "p-2", "p-3", "p-4"],
        allowOpenFallback: true,
      }),
    ).not.toThrow();

    expect(() =>
      assertQueueAssignment({
        session: mixedSession,
        players: mixedPlayers,
        courts,
        courtId: "court-1",
        playerIds: ["p-1", "p-3", "p-2", "p-4"],
      }),
    ).not.toThrow();
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

  it("builds a balanced doubles round-robin schedule", () => {
    expect(generateDoublesSchedule(players, courts)).toEqual([
      {
        courtId: "court-1",
        playerIds: ["p-1", "p-4", "p-2", "p-3"],
        round: 1,
      },
      {
        courtId: "court-1",
        playerIds: ["p-1", "p-3", "p-4", "p-2"],
        round: 2,
      },
      {
        courtId: "court-1",
        playerIds: ["p-1", "p-2", "p-3", "p-4"],
        round: 3,
      },
    ]);
  });

  it("sorts completed players into standings with a win rate", () => {
    const standings = deriveStandings(
      players,
      [
        { ...queue[0]!, linked_match_id: "match-1" },
        {
          ...queue[0]!,
          id: "queue-2",
          team_a_player_1: "p-1",
          team_a_player_2: "p-3",
          team_b_player_1: "p-2",
          team_b_player_2: "p-4",
          linked_match_id: "match-2",
        },
      ],
      {
        "match-1": { id: "match-1", status: "complete", winner: "A" },
        "match-2": { id: "match-2", status: "complete", winner: "B" },
      },
    );

    expect(standings[0]).toMatchObject({
      rank: 1,
      playerId: "p-2",
      played: 2,
      won: 2,
      lost: 0,
      winRate: 100,
    });
    expect(standings).toHaveLength(4);
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

  it("persists an automatic schedule as a batch", async () => {
    const addQueuedMatches = vi.fn().mockResolvedValue(undefined);
    const management = createClubSessionManagement(
      adapter({ addQueuedMatches }),
    );
    const randomUUID = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000011")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000012")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000013");

    await management.generateSchedule({
      session,
      players,
      courts,
      queue: [],
    });

    expect(addQueuedMatches).toHaveBeenCalledWith({
      sessionId: "session-1",
      matches: [
        {
          matchId: "00000000-0000-4000-8000-000000000011",
          courtId: "court-1",
          playerIds: ["p-1", "p-4", "p-2", "p-3"],
          queueOrder: 0,
        },
        {
          matchId: "00000000-0000-4000-8000-000000000012",
          courtId: "court-1",
          playerIds: ["p-1", "p-3", "p-4", "p-2"],
          queueOrder: 1,
        },
        {
          matchId: "00000000-0000-4000-8000-000000000013",
          courtId: "court-1",
          playerIds: ["p-1", "p-2", "p-3", "p-4"],
          queueOrder: 2,
        },
      ],
    });
    randomUUID.mockRestore();
  });

  it("fills the next free court without replacing the existing queue", async () => {
    const addQueuedMatches = vi.fn().mockResolvedValue(undefined);
    const management = createClubSessionManagement(
      adapter({ addQueuedMatches }),
    );
    const randomUUID = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("00000000-0000-4000-8000-000000000021");

    await management.fillNextCourts({
      session,
      players: [
        ...players,
        { id: "p-5", display_name: "Five", sort_order: 4, is_active: true },
        { id: "p-6", display_name: "Six", sort_order: 5, is_active: true },
        { id: "p-7", display_name: "Seven", sort_order: 6, is_active: true },
        { id: "p-8", display_name: "Eight", sort_order: 7, is_active: true },
      ],
      courts: [
        ...courts,
        { id: "court-2", name: "Court 2", sort_order: 1, is_active: true },
      ],
      queue: [
        {
          ...queue[0]!,
          id: "finished-1",
          match_id: "finished-1",
          linked_match_id: "finished-1",
          started_at: "2026-10-19T10:00:00.000Z",
        },
      ],
      results: {
        "finished-1": {
          id: "finished-1",
          status: "complete",
          winner: "A",
        },
      },
    });

    expect(addQueuedMatches).toHaveBeenCalledWith({
      sessionId: "session-1",
      matches: [
        expect.objectContaining({
          matchId: "00000000-0000-4000-8000-000000000021",
          queueOrder: 5,
        }),
        expect.objectContaining({ queueOrder: 6 }),
      ],
    });
    randomUUID.mockRestore();
  });

  it("rejects a preview when the session changed before confirmation", async () => {
    const addQueuedMatches = vi.fn().mockResolvedValue(undefined);
    const loadSession = vi.fn().mockResolvedValue({
      session,
      players: players.map((player) =>
        player.id === "p-4"
          ? { ...player, availability: "resting" as const }
          : player,
      ),
      courts,
      queue: [],
      results: {},
    });
    const management = createClubSessionManagement(
      adapter({ addQueuedMatches, loadSession }),
    );
    const plan = planSmartRotation({
      session,
      players,
      courts,
      queue: [],
      results: {},
    });

    await expect(
      management.queueSmartRotationPlan({
        session,
        queue: [],
        plan,
      }),
    ).rejects.toThrow("CLUB_SESSION_ROTATION_STALE");
    expect(addQueuedMatches).not.toHaveBeenCalled();
  });
});
