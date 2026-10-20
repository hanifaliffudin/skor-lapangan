export type ClubSessionStatus = "active" | "completed";

export interface ClubSessionSummary {
  id: string;
  name: string;
  session_date: string;
  status: ClubSessionStatus;
  created_at: string;
}

export interface ClubSessionPlayer {
  id: string;
  display_name: string;
  sort_order: number;
  is_active: boolean;
}

export interface ClubSessionCourt {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface ClubSessionMatch {
  id: string;
  match_id: string;
  linked_match_id: string | null;
  court_id: string;
  team_a_player_1: string;
  team_a_player_2: string;
  team_b_player_1: string;
  team_b_player_2: string;
  queue_order: number;
  started_at: string | null;
}

export interface ClubSessionMatchResult {
  id: string;
  status: string;
  winner: string | null;
}

export interface ClubSessionDetail {
  session: ClubSessionSummary;
  players: ClubSessionPlayer[];
  courts: ClubSessionCourt[];
  queue: ClubSessionMatch[];
  results: Record<string, ClubSessionMatchResult>;
}

export interface ClubSessionAdapter {
  listSessions(): Promise<ClubSessionSummary[]>;
  loadSession(sessionId: string): Promise<ClubSessionDetail>;
  createSession(input: {
    name: string;
    sessionDate: string;
  }): Promise<{ id: string }>;
  addPlayer(input: {
    sessionId: string;
    displayName: string;
    sortOrder: number;
  }): Promise<void>;
  addCourt(input: {
    sessionId: string;
    name: string;
    sortOrder: number;
  }): Promise<void>;
  setPlayerActive(input: {
    sessionId: string;
    playerId: string;
    isActive: boolean;
  }): Promise<void>;
  setCourtActive(input: {
    sessionId: string;
    courtId: string;
    isActive: boolean;
  }): Promise<void>;
  addQueuedMatch(input: {
    sessionId: string;
    matchId: string;
    courtId: string;
    playerIds: [string, string, string, string];
    queueOrder: number;
  }): Promise<void>;
  markMatchStarted(input: {
    sessionId: string;
    matchId: string;
  }): Promise<void>;
  removeQueuedMatch(input: {
    sessionId: string;
    queueId: string;
  }): Promise<void>;
  setStatus(input: {
    sessionId: string;
    status: ClubSessionStatus;
  }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

export interface ClubSessionManagement {
  listSessions(): Promise<ClubSessionSummary[]>;
  loadSession(sessionId: string): Promise<ClubSessionDetail>;
  createSession(input: {
    name: string;
    sessionDate: string;
  }): Promise<{ id: string }>;
  addPlayer(input: {
    sessionId: string;
    displayName: string;
    currentPlayerCount: number;
  }): Promise<void>;
  addCourt(input: {
    sessionId: string;
    name: string;
    currentCourtCount: number;
  }): Promise<void>;
  setPlayerActive(input: {
    sessionId: string;
    playerId: string;
    isActive: boolean;
  }): Promise<void>;
  setCourtActive(input: {
    sessionId: string;
    courtId: string;
    isActive: boolean;
  }): Promise<void>;
  addQueuedMatch(input: {
    session: ClubSessionSummary;
    players: ClubSessionPlayer[];
    courts: ClubSessionCourt[];
    queue: ClubSessionMatch[];
    courtId: string;
    playerIds: [string, string, string, string];
  }): Promise<void>;
  markMatchStarted(input: {
    sessionId: string;
    matchId: string;
  }): Promise<void>;
  removeQueuedMatch(input: {
    sessionId: string;
    queueId: string;
  }): Promise<void>;
  toggleStatus(session: ClubSessionSummary): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

export function assertQueueAssignment(input: {
  session: ClubSessionSummary;
  players: ClubSessionPlayer[];
  courts: ClubSessionCourt[];
  courtId: string;
  playerIds: [string, string, string, string];
}): void {
  if (input.session.status !== "active") {
    throw new Error("CLUB_SESSION_COMPLETED");
  }
  const activePlayerIds = new Set(
    input.players
      .filter((player) => player.is_active)
      .map((player) => player.id),
  );
  const activeCourtIds = new Set(
    input.courts.filter((court) => court.is_active).map((court) => court.id),
  );
  if (
    !activeCourtIds.has(input.courtId) ||
    input.playerIds.some((playerId) => !activePlayerIds.has(playerId)) ||
    new Set(input.playerIds).size !== input.playerIds.length
  ) {
    throw new Error("CLUB_SESSION_ASSIGNMENT_INVALID");
  }
}

export function derivePlayerRecords(
  players: ClubSessionPlayer[],
  queue: ClubSessionMatch[],
  results: Record<string, ClubSessionMatchResult>,
): Map<string, { played: number; won: number; lost: number }> {
  const records = new Map<
    string,
    { played: number; won: number; lost: number }
  >();
  for (const player of players) {
    records.set(player.id, { played: 0, won: 0, lost: 0 });
  }
  for (const entry of queue) {
    if (!entry.linked_match_id) continue;
    const result = results[entry.linked_match_id];
    if (!result || result.status !== "complete" || !result.winner) continue;
    const sideA = [entry.team_a_player_1, entry.team_a_player_2];
    const sideB = [entry.team_b_player_1, entry.team_b_player_2];
    for (const playerId of sideA) {
      const record = records.get(playerId);
      if (!record) continue;
      record.played += 1;
      result.winner === "A" ? (record.won += 1) : (record.lost += 1);
    }
    for (const playerId of sideB) {
      const record = records.get(playerId);
      if (!record) continue;
      record.played += 1;
      result.winner === "B" ? (record.won += 1) : (record.lost += 1);
    }
  }
  return records;
}

export function createClubSessionManagement(
  adapter: ClubSessionAdapter,
): ClubSessionManagement {
  return {
    listSessions: () => adapter.listSessions(),
    loadSession: (sessionId) => adapter.loadSession(sessionId),
    createSession: (input) => adapter.createSession(input),
    addPlayer: ({ sessionId, displayName, currentPlayerCount }) =>
      adapter.addPlayer({
        sessionId,
        displayName: displayName.trim(),
        sortOrder: currentPlayerCount,
      }),
    addCourt: ({ sessionId, name, currentCourtCount }) =>
      adapter.addCourt({
        sessionId,
        name: name.trim(),
        sortOrder: currentCourtCount,
      }),
    setPlayerActive: (input) => adapter.setPlayerActive(input),
    setCourtActive: (input) => adapter.setCourtActive(input),
    addQueuedMatch: async (input) => {
      assertQueueAssignment(input);
      const queueOrder =
        input.queue.reduce(
          (highest, entry) => Math.max(highest, entry.queue_order),
          -1,
        ) + 1;
      await adapter.addQueuedMatch({
        sessionId: input.session.id,
        matchId: crypto.randomUUID(),
        courtId: input.courtId,
        playerIds: input.playerIds,
        queueOrder,
      });
    },
    markMatchStarted: (input) => adapter.markMatchStarted(input),
    removeQueuedMatch: (input) => adapter.removeQueuedMatch(input),
    toggleStatus: (session) =>
      adapter.setStatus({
        sessionId: session.id,
        status: session.status === "active" ? "completed" : "active",
      }),
    deleteSession: (sessionId) => adapter.deleteSession(sessionId),
  };
}
