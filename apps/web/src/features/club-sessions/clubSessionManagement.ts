export type ClubSessionStatus = "active" | "completed";
export type ClubSessionGender = "man" | "woman" | "other" | "unspecified";
export type ClubSessionPairingMode = "open" | "mixed";
export type ClubSessionAvailability =
  "available" | "late" | "resting" | "unavailable";

export interface ClubSessionSummary {
  id: string;
  name: string;
  session_date: string;
  status: ClubSessionStatus;
  created_at: string;
  pairing_mode?: ClubSessionPairingMode;
}

export interface ClubSessionPlayer {
  id: string;
  display_name: string;
  sort_order: number;
  is_active: boolean;
  gender?: ClubSessionGender | null;
  skill_level?: number;
  availability?: ClubSessionAvailability;
  avoid_player_ids?: string[];
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
  is_open_fallback?: boolean;
}

export interface ClubSessionMatchResult {
  id: string;
  status: string;
  winner: string | null;
}

export interface ClubSessionScheduleMatch {
  courtId: string;
  playerIds: [string, string, string, string];
  round: number;
  isOpenFallback?: boolean;
  explanation?: {
    playerCounts: [number, number, number, number];
    fairnessGap: number;
    avoidPenalty: number;
    repeatPenalty: number;
    skillGap: number;
  };
}

export interface ClubSessionSmartRotationPlan {
  matches: ClubSessionScheduleMatch[];
  snapshotKey: string;
  reason?:
    "NO_FREE_COURT" | "NOT_ENOUGH_ELIGIBLE_PLAYERS" | "MIXED_FALLBACK_REQUIRED";
  canUseOpenFallback: boolean;
  usedOpenFallback: boolean;
}

export interface ClubSessionStanding {
  rank: number;
  playerId: string;
  played: number;
  won: number;
  lost: number;
  winRate: number;
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
    pairingMode?: ClubSessionPairingMode;
  }): Promise<{ id: string }>;
  addPlayer(input: {
    sessionId: string;
    displayName: string;
    sortOrder: number;
    gender?: ClubSessionGender;
    skillLevel?: number;
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
  updatePlayerProfile(input: {
    sessionId: string;
    playerId: string;
    gender?: ClubSessionGender;
    skillLevel?: number;
    availability?: ClubSessionAvailability;
    avoidPlayerIds?: string[];
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
    isOpenFallback?: boolean;
  }): Promise<void>;
  addQueuedMatches(input: {
    sessionId: string;
    matches: Array<{
      matchId: string;
      courtId: string;
      playerIds: [string, string, string, string];
      queueOrder: number;
      isOpenFallback?: boolean;
    }>;
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
    pairingMode?: ClubSessionPairingMode;
  }): Promise<{ id: string }>;
  addPlayer(input: {
    sessionId: string;
    displayName: string;
    currentPlayerCount: number;
    gender?: ClubSessionGender;
    skillLevel?: number;
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
  updatePlayerProfile(input: {
    sessionId: string;
    playerId: string;
    gender?: ClubSessionGender;
    skillLevel?: number;
    availability?: ClubSessionAvailability;
    avoidPlayerIds?: string[];
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
    allowOpenFallback?: boolean;
  }): Promise<void>;
  generateSchedule(input: {
    session: ClubSessionSummary;
    players: ClubSessionPlayer[];
    courts: ClubSessionCourt[];
    queue: ClubSessionMatch[];
  }): Promise<number>;
  planSmartRotation(input: {
    session: ClubSessionSummary;
    players: ClubSessionPlayer[];
    courts: ClubSessionCourt[];
    queue: ClubSessionMatch[];
    results: Record<string, ClubSessionMatchResult>;
    allowOpenFallback?: boolean;
  }): ClubSessionSmartRotationPlan;
  queueSmartRotationPlan(input: {
    session: ClubSessionSummary;
    queue: ClubSessionMatch[];
    plan: ClubSessionSmartRotationPlan;
  }): Promise<void>;
  fillNextCourts(input: {
    session: ClubSessionSummary;
    players: ClubSessionPlayer[];
    courts: ClubSessionCourt[];
    queue: ClubSessionMatch[];
    results: Record<string, ClubSessionMatchResult>;
    allowOpenFallback?: boolean;
  }): Promise<ClubSessionSmartRotationPlan>;
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
  allowOpenFallback?: boolean;
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
  if (input.session.pairing_mode !== "mixed") return;
  const playersById = new Map(
    input.players.map((player) => [player.id, player]),
  );
  const teamA: [string, string] = [input.playerIds[0], input.playerIds[1]];
  const teamB: [string, string] = [input.playerIds[2], input.playerIds[3]];
  const isValidMixedAssignment =
    isMixedPair(teamA, playersById) && isMixedPair(teamB, playersById);
  if (!isValidMixedAssignment && !input.allowOpenFallback) {
    throw new Error("CLUB_SESSION_MIXED_ASSIGNMENT_INVALID");
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

export function deriveStandings(
  players: ClubSessionPlayer[],
  queue: ClubSessionMatch[],
  results: Record<string, ClubSessionMatchResult>,
): ClubSessionStanding[] {
  return [...derivePlayerRecords(players, queue, results).entries()]
    .map(([playerId, record]) => ({
      playerId,
      ...record,
      winRate:
        record.played === 0
          ? 0
          : Number(((record.won / record.played) * 100).toFixed(1)),
      sortOrder:
        players.find((player) => player.id === playerId)?.sort_order ?? 0,
    }))
    .sort(
      (left, right) =>
        right.won - left.won ||
        right.winRate - left.winRate ||
        right.played - left.played ||
        left.sortOrder - right.sortOrder,
    )
    .map(({ sortOrder: _sortOrder, ...standing }, index) => ({
      ...standing,
      rank: index + 1,
    }));
}

interface RotationPairing {
  playerIds: [string, string, string, string];
  teams: [[string, string], [string, string]];
}

interface RotationCandidate {
  pairing: RotationPairing;
  countVector: number[];
  avoidPenalty: number;
  waitKey: number;
  repeatPenalty: number;
  skillGap: number;
  stableKey: string;
}

function isPlayedEntry(
  entry: ClubSessionMatch,
  results: Record<string, ClubSessionMatchResult>,
): boolean {
  const result = entry.linked_match_id
    ? results[entry.linked_match_id]
    : undefined;
  return Boolean(entry.started_at) || result?.status === "complete";
}

function isFinishedEntry(
  entry: ClubSessionMatch,
  results: Record<string, ClubSessionMatchResult>,
): boolean {
  const result = entry.linked_match_id
    ? results[entry.linked_match_id]
    : undefined;
  return result?.status === "complete" && Boolean(result.winner);
}

function queuePlayerIds(entry: ClubSessionMatch): string[] {
  return [
    entry.team_a_player_1,
    entry.team_a_player_2,
    entry.team_b_player_1,
    entry.team_b_player_2,
  ];
}

function rotationSnapshotKey(input: {
  session: ClubSessionSummary;
  players: ClubSessionPlayer[];
  courts: ClubSessionCourt[];
  queue: ClubSessionMatch[];
  results: Record<string, ClubSessionMatchResult>;
}): string {
  return JSON.stringify({
    session: {
      id: input.session.id,
      status: input.session.status,
      pairingMode: input.session.pairing_mode ?? "open",
    },
    players: [...input.players]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((player) => ({
        id: player.id,
        displayName: player.display_name,
        sortOrder: player.sort_order,
        isActive: player.is_active,
        gender: player.gender ?? null,
        skillLevel: player.skill_level ?? 3,
        availability: player.availability ?? "available",
        avoidPlayerIds: [...(player.avoid_player_ids ?? [])].sort(),
      })),
    courts: [...input.courts]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((court) => ({
        id: court.id,
        name: court.name,
        sortOrder: court.sort_order,
        isActive: court.is_active,
      })),
    queue: [...input.queue]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((entry) => ({
        id: entry.id,
        matchId: entry.match_id,
        linkedMatchId: entry.linked_match_id,
        courtId: entry.court_id,
        playerIds: queuePlayerIds(entry),
        queueOrder: entry.queue_order,
        startedAt: entry.started_at,
        isOpenFallback: entry.is_open_fallback ?? false,
      })),
    results: Object.entries(input.results)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, result]) => ({
        id,
        status: result.status,
        winner: result.winner,
      })),
  });
}

function pairKey(first: string, second: string): string {
  return [first, second].sort().join("|");
}

function pairingOptions(playerIds: string[]): RotationPairing[] {
  const [a, b, c, d] = playerIds;
  if (!a || !b || !c || !d) return [];
  return [
    {
      playerIds: [a, b, c, d],
      teams: [
        [a, b],
        [c, d],
      ],
    },
    {
      playerIds: [a, c, b, d],
      teams: [
        [a, c],
        [b, d],
      ],
    },
    {
      playerIds: [a, d, b, c],
      teams: [
        [a, d],
        [b, c],
      ],
    },
  ];
}

function isMixedPair(
  pair: [string, string],
  playersById: Map<string, ClubSessionPlayer>,
): boolean {
  const first = playersById.get(pair[0])?.gender;
  const second = playersById.get(pair[1])?.gender;
  return (
    (first === "man" && second === "woman") ||
    (first === "woman" && second === "man")
  );
}

function combinationsOfFour(playerIds: string[]): string[][] {
  const combinations: string[][] = [];
  for (let first = 0; first < playerIds.length - 3; first += 1) {
    for (let second = first + 1; second < playerIds.length - 2; second += 1) {
      for (let third = second + 1; third < playerIds.length - 1; third += 1) {
        for (let fourth = third + 1; fourth < playerIds.length; fourth += 1) {
          combinations.push([
            playerIds[first]!,
            playerIds[second]!,
            playerIds[third]!,
            playerIds[fourth]!,
          ]);
        }
      }
    }
  }
  return combinations;
}

function compareNumberVectors(left: number[], right: number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function planCandidate(
  playerIds: string[],
  pairingMode: ClubSessionPairingMode,
  playersById: Map<string, ClubSessionPlayer>,
  playedCounts: Map<string, number>,
  lastPlayedAt: Map<string, number>,
  partnerHistory: Map<string, number>,
  opponentHistory: Map<string, number>,
): RotationCandidate | null {
  const pairings = pairingOptions(playerIds).filter((pairing) =>
    pairingMode === "mixed"
      ? pairing.teams.every((team) => isMixedPair(team, playersById))
      : true,
  );
  if (!pairings.length) return null;

  const avoidPenalty = playerIds.reduce((total, playerId) => {
    const avoided = new Set(playersById.get(playerId)?.avoid_player_ids ?? []);
    return (
      total +
      playerIds.filter(
        (otherId) => otherId !== playerId && avoided.has(otherId),
      ).length
    );
  }, 0);
  const countVector = playerIds
    .map((playerId) => playedCounts.get(playerId) ?? 0)
    .sort((left, right) => left - right);
  const waitKey = playerIds.reduce(
    (total, playerId) => total + (lastPlayedAt.get(playerId) ?? 0),
    0,
  );
  const sortedPlayerIds = [...playerIds].sort();

  return pairings
    .map((pairing) => {
      const partnerPenalty = pairing.teams.reduce(
        (total, [first, second]) =>
          total + (partnerHistory.get(pairKey(first, second)) ?? 0),
        0,
      );
      const opponentPenalty =
        (opponentHistory.get(
          pairKey(pairing.teams[0][0], pairing.teams[1][0]),
        ) ?? 0) +
        (opponentHistory.get(
          pairKey(pairing.teams[0][0], pairing.teams[1][1]),
        ) ?? 0) +
        (opponentHistory.get(
          pairKey(pairing.teams[0][1], pairing.teams[1][0]),
        ) ?? 0) +
        (opponentHistory.get(
          pairKey(pairing.teams[0][1], pairing.teams[1][1]),
        ) ?? 0);
      const teamSkill = pairing.teams.map((team) =>
        team.reduce(
          (total, playerId) =>
            total + (playersById.get(playerId)?.skill_level ?? 3),
          0,
        ),
      );
      return {
        pairing,
        countVector,
        avoidPenalty,
        waitKey,
        repeatPenalty: partnerPenalty + opponentPenalty,
        skillGap: Math.abs(teamSkill[0]! - teamSkill[1]!),
        stableKey: sortedPlayerIds.join("|") + pairKey(...pairing.teams[0]),
      };
    })
    .sort(
      (left, right) =>
        compareNumberVectors(left.countVector, right.countVector) ||
        left.avoidPenalty - right.avoidPenalty ||
        left.waitKey - right.waitKey ||
        left.repeatPenalty - right.repeatPenalty ||
        left.skillGap - right.skillGap ||
        left.stableKey.localeCompare(right.stableKey),
    )[0]!;
}

export function planSmartRotation(input: {
  session: ClubSessionSummary;
  players: ClubSessionPlayer[];
  courts: ClubSessionCourt[];
  queue: ClubSessionMatch[];
  results: Record<string, ClubSessionMatchResult>;
  allowOpenFallback?: boolean;
}): ClubSessionSmartRotationPlan {
  const snapshotKey = rotationSnapshotKey(input);
  if (input.session.status !== "active") {
    return {
      matches: [],
      snapshotKey,
      reason: "NOT_ENOUGH_ELIGIBLE_PLAYERS",
      canUseOpenFallback: false,
      usedOpenFallback: false,
    };
  }

  const occupiedCourts = new Set(
    input.queue
      .filter((entry) => !isFinishedEntry(entry, input.results))
      .map((entry) => entry.court_id),
  );
  const freeCourts = input.courts.filter(
    (court) => court.is_active && !occupiedCourts.has(court.id),
  );
  if (!freeCourts.length) {
    return {
      matches: [],
      snapshotKey,
      reason: "NO_FREE_COURT",
      canUseOpenFallback: false,
      usedOpenFallback: false,
    };
  }

  const playersById = new Map(
    input.players.map((player) => [player.id, player]),
  );
  const playedCounts = new Map<string, number>();
  const lastPlayedAt = new Map<string, number>();
  const partnerHistory = new Map<string, number>();
  const opponentHistory = new Map<string, number>();
  const occupiedPlayers = new Set<string>();

  for (const entry of input.queue) {
    const ids = queuePlayerIds(entry);
    if (!isFinishedEntry(entry, input.results)) {
      ids.forEach((playerId) => occupiedPlayers.add(playerId));
    }
    if (!isPlayedEntry(entry, input.results)) continue;
    ids.forEach((playerId) => {
      playedCounts.set(playerId, (playedCounts.get(playerId) ?? 0) + 1);
      const timestamp = entry.started_at ? Date.parse(entry.started_at) : 0;
      if (timestamp) {
        lastPlayedAt.set(
          playerId,
          Math.max(lastPlayedAt.get(playerId) ?? 0, timestamp),
        );
      }
    });
    const teams: [[string, string], [string, string]] = [
      [entry.team_a_player_1, entry.team_a_player_2],
      [entry.team_b_player_1, entry.team_b_player_2],
    ];
    for (const [first, second] of teams) {
      const key = pairKey(first, second);
      partnerHistory.set(key, (partnerHistory.get(key) ?? 0) + 1);
    }
    for (const first of teams[0]) {
      for (const second of teams[1]) {
        const key = pairKey(first, second);
        opponentHistory.set(key, (opponentHistory.get(key) ?? 0) + 1);
      }
    }
  }

  let remainingPlayers = input.players
    .filter(
      (player) =>
        player.is_active &&
        (player.availability ?? "available") === "available" &&
        !occupiedPlayers.has(player.id),
    )
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((player) => player.id);
  const matches: ClubSessionScheduleMatch[] = [];
  let canUseOpenFallback = false;
  let usedOpenFallback = false;
  let reason: ClubSessionSmartRotationPlan["reason"];

  for (const court of freeCourts) {
    const openCandidate = combinationsOfFour(remainingPlayers)
      .map((ids) =>
        planCandidate(
          ids,
          "open",
          playersById,
          playedCounts,
          lastPlayedAt,
          partnerHistory,
          opponentHistory,
        ),
      )
      .filter((candidate): candidate is RotationCandidate => Boolean(candidate))
      .sort(
        (left, right) =>
          compareNumberVectors(left.countVector, right.countVector) ||
          left.avoidPenalty - right.avoidPenalty ||
          left.waitKey - right.waitKey ||
          left.repeatPenalty - right.repeatPenalty ||
          left.skillGap - right.skillGap ||
          left.stableKey.localeCompare(right.stableKey),
      )[0];
    if (!openCandidate) {
      reason = "NOT_ENOUGH_ELIGIBLE_PLAYERS";
      break;
    }

    const mixedCandidate =
      input.session.pairing_mode === "mixed"
        ? combinationsOfFour(remainingPlayers)
            .map((ids) =>
              planCandidate(
                ids,
                "mixed",
                playersById,
                playedCounts,
                lastPlayedAt,
                partnerHistory,
                opponentHistory,
              ),
            )
            .filter((candidate): candidate is RotationCandidate =>
              Boolean(candidate),
            )
            .sort(
              (left, right) =>
                compareNumberVectors(left.countVector, right.countVector) ||
                left.avoidPenalty - right.avoidPenalty ||
                left.waitKey - right.waitKey ||
                left.repeatPenalty - right.repeatPenalty ||
                left.skillGap - right.skillGap ||
                left.stableKey.localeCompare(right.stableKey),
            )[0]
        : openCandidate;

    const chosen = mixedCandidate ?? openCandidate;
    let selectedOpenFallback = false;
    if (!mixedCandidate && input.session.pairing_mode === "mixed") {
      canUseOpenFallback = true;
      if (!input.allowOpenFallback) {
        reason = "MIXED_FALLBACK_REQUIRED";
        break;
      }
      selectedOpenFallback = true;
      usedOpenFallback = true;
    }

    matches.push({
      courtId: court.id,
      playerIds: chosen.pairing.playerIds,
      round: matches.length + 1,
      explanation: {
        playerCounts: chosen.pairing.playerIds.map(
          (playerId) => playedCounts.get(playerId) ?? 0,
        ) as [number, number, number, number],
        fairnessGap:
          Math.max(...chosen.countVector) - Math.min(...chosen.countVector),
        avoidPenalty: chosen.avoidPenalty,
        repeatPenalty: chosen.repeatPenalty,
        skillGap: chosen.skillGap,
      },
      ...(selectedOpenFallback ? { isOpenFallback: true } : {}),
    });
    remainingPlayers = remainingPlayers.filter(
      (playerId) => !chosen.pairing.playerIds.includes(playerId),
    );
  }

  return {
    matches,
    snapshotKey,
    ...(reason ? { reason } : {}),
    canUseOpenFallback,
    usedOpenFallback,
  };
}

export function generateDoublesSchedule(
  players: ClubSessionPlayer[],
  courts: ClubSessionCourt[],
): ClubSessionScheduleMatch[] {
  const activePlayers = players.filter((player) => player.is_active);
  const activeCourts = courts.filter((court) => court.is_active);
  if (activePlayers.length < 4 || activeCourts.length === 0) return [];

  const rotation: Array<string | null> = activePlayers.map(
    (player) => player.id,
  );
  if (rotation.length % 2 !== 0) rotation.push(null);

  const schedule: ClubSessionScheduleMatch[] = [];
  for (let round = 0; round < rotation.length - 1; round += 1) {
    const pairs: Array<[string, string]> = [];
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const first = rotation[index];
      const second = rotation[rotation.length - 1 - index];
      if (first && second) pairs.push([first, second]);
    }

    for (let pairIndex = 0; pairIndex + 1 < pairs.length; pairIndex += 2) {
      const firstPair = pairs[pairIndex]!;
      const secondPair = pairs[pairIndex + 1]!;
      schedule.push({
        courtId: activeCourts[schedule.length % activeCourts.length]!.id,
        playerIds: [firstPair[0], firstPair[1], secondPair[0], secondPair[1]],
        round: round + 1,
      });
    }

    const last = rotation.pop();
    if (last !== undefined) rotation.splice(1, 0, last);
  }
  return schedule;
}

async function persistSmartRotationPlan(
  adapter: ClubSessionAdapter,
  input: {
    session: ClubSessionSummary;
    queue: ClubSessionMatch[];
    plan: ClubSessionSmartRotationPlan;
  },
): Promise<void> {
  if (!input.plan.matches.length) return;
  const nextQueueOrder =
    input.queue.reduce(
      (highest, entry) => Math.max(highest, entry.queue_order),
      -1,
    ) + 1;
  await adapter.addQueuedMatches({
    sessionId: input.session.id,
    matches: input.plan.matches.map((match, index) => ({
      matchId: crypto.randomUUID(),
      courtId: match.courtId,
      playerIds: match.playerIds,
      queueOrder: nextQueueOrder + index,
      ...(match.isOpenFallback ? { isOpenFallback: true } : {}),
    })),
  });
}

export function createClubSessionManagement(
  adapter: ClubSessionAdapter,
): ClubSessionManagement {
  return {
    listSessions: () => adapter.listSessions(),
    loadSession: (sessionId) => adapter.loadSession(sessionId),
    createSession: (input) => adapter.createSession(input),
    addPlayer: ({
      sessionId,
      displayName,
      currentPlayerCount,
      gender,
      skillLevel,
    }) =>
      adapter.addPlayer({
        sessionId,
        displayName: displayName.trim(),
        sortOrder: currentPlayerCount,
        ...(gender ? { gender } : {}),
        ...(skillLevel !== undefined ? { skillLevel } : {}),
      }),
    addCourt: ({ sessionId, name, currentCourtCount }) =>
      adapter.addCourt({
        sessionId,
        name: name.trim(),
        sortOrder: currentCourtCount,
      }),
    setPlayerActive: (input) => adapter.setPlayerActive(input),
    setCourtActive: (input) => adapter.setCourtActive(input),
    updatePlayerProfile: (input) => adapter.updatePlayerProfile(input),
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
        ...(input.session.pairing_mode === "mixed" && input.allowOpenFallback
          ? { isOpenFallback: true }
          : {}),
      });
    },
    generateSchedule: async (input) => {
      if (input.session.status !== "active") {
        throw new Error("CLUB_SESSION_COMPLETED");
      }
      if (input.queue.length > 0) {
        throw new Error("CLUB_SESSION_SCHEDULE_EXISTS");
      }
      const schedule = generateDoublesSchedule(input.players, input.courts);
      if (schedule.length === 0) {
        throw new Error("CLUB_SESSION_SCHEDULE_REQUIREMENTS");
      }
      await adapter.addQueuedMatches({
        sessionId: input.session.id,
        matches: schedule.map((match, index) => ({
          matchId: crypto.randomUUID(),
          courtId: match.courtId,
          playerIds: match.playerIds,
          queueOrder: index,
        })),
      });
      return schedule.length;
    },
    planSmartRotation: (input) => planSmartRotation(input),
    queueSmartRotationPlan: async (input) => {
      const current = await adapter.loadSession(input.session.id);
      if (rotationSnapshotKey(current) !== input.plan.snapshotKey) {
        throw new Error("CLUB_SESSION_ROTATION_STALE");
      }
      await persistSmartRotationPlan(adapter, input);
    },
    fillNextCourts: async (input) => {
      const plan = planSmartRotation(input);
      await persistSmartRotationPlan(adapter, {
        session: input.session,
        queue: input.queue,
        plan,
      });
      return plan;
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
