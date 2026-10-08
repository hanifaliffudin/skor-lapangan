import type {
  CourtSide,
  DomainEvent,
  EventMetadata,
  JournalView,
  MatchDefinition,
  MatchEvent,
  MatchJournal,
  MatchState,
  PlayerIndex,
  TeamId,
  TeamPosition,
} from "./types";

export const OFFICIAL_RULESETS = {
  badminton: {
    id: "bwf-doubles-3x21-2025",
    checkedAt: "2026-10-08",
    source:
      "https://system.bwfbadminton.com/documents/folder_1_81/Statutes/CHAPTER-4---RULES-OF-THE-GAME/SECTION%204.1-%20Laws%20of%20Badminton.pdf",
  },
  pickleball: {
    id: "usap-doubles-sideout-2026",
    checkedAt: "2026-10-08",
    source: "https://usapickleball.org/docs/rules/USAP-Official-Rulebook.pdf",
  },
} as const;

export function officialRulesetFor(sport: MatchDefinition["sport"]) {
  return OFFICIAL_RULESETS[sport];
}

const otherTeam = (team: TeamId): TeamId => (team === "A" ? "B" : "A");
const otherPlayer = (player: PlayerIndex): PlayerIndex =>
  player === 0 ? 1 : 0;

const clonePoints = (
  points: Record<TeamId, number>,
): Record<TeamId, number> => ({
  A: points.A,
  B: points.B,
});

const swapPosition = (position: TeamPosition): TeamPosition => ({
  left: position.right,
  right: position.left,
});

function initialPositions(
  definition: MatchDefinition,
): Record<TeamId, TeamPosition> {
  const standard: TeamPosition = { left: 1, right: 0 };
  const serving: TeamPosition =
    definition.initialServingPlayer === 0
      ? standard
      : { left: 0, right: definition.initialServingPlayer };

  return definition.initialServingTeam === "A"
    ? { A: serving, B: standard }
    : { A: standard, B: serving };
}

export function createInitialState(definition: MatchDefinition): MatchState {
  const positions = initialPositions(definition);

  return {
    matchId: definition.id,
    sport: definition.sport,
    gameNumber: 1,
    gamesWon: { A: 0, B: 0 },
    points: { A: 0, B: 0 },
    servingTeam: definition.initialServingTeam,
    currentServer: definition.initialServingPlayer,
    serverNumber: definition.sport === "pickleball" ? 2 : null,
    positions,
    status: "active",
    winner: null,
    completedGames: [],
  };
}

function requiredServiceSide(score: number): CourtSide {
  return score % 2 === 0 ? "right" : "left";
}

function playerOnSide(position: TeamPosition, side: CourtSide): PlayerIndex {
  return position[side];
}

function hasWonGame(
  sport: MatchDefinition["sport"],
  winnerPoints: number,
  loserPoints: number,
): boolean {
  if (sport === "badminton") {
    return (
      winnerPoints === 30 ||
      (winnerPoints >= 21 && winnerPoints - loserPoints >= 2)
    );
  }

  return winnerPoints >= 11 && winnerPoints - loserPoints >= 2;
}

function resetForNextGame(
  state: MatchState,
  definition: MatchDefinition,
  gameWinner: TeamId,
): MatchState {
  const gameNumber = state.gameNumber + 1;
  const positions = initialPositions(definition);
  const servingTeam =
    definition.sport === "badminton"
      ? gameWinner
      : gameNumber % 2 === 0
        ? otherTeam(definition.initialServingTeam)
        : definition.initialServingTeam;
  const currentServer = playerOnSide(positions[servingTeam], "right");

  return {
    ...state,
    gameNumber,
    points: { A: 0, B: 0 },
    servingTeam,
    currentServer,
    serverNumber: definition.sport === "pickleball" ? 2 : null,
    positions,
  };
}

function completeGameIfNeeded(
  state: MatchState,
  definition: MatchDefinition,
  rallyWinner: TeamId,
): MatchState {
  const loser = otherTeam(rallyWinner);
  if (
    !hasWonGame(
      definition.sport,
      state.points[rallyWinner],
      state.points[loser],
    )
  ) {
    return state;
  }

  const gamesWon = clonePoints(state.gamesWon);
  gamesWon[rallyWinner] += 1;
  const completedGames = [
    ...state.completedGames,
    { winner: rallyWinner, score: clonePoints(state.points) },
  ];
  const completedState = { ...state, gamesWon, completedGames };

  if (gamesWon[rallyWinner] === 2) {
    return { ...completedState, status: "complete", winner: rallyWinner };
  }

  return resetForNextGame(completedState, definition, rallyWinner);
}

function applyBadmintonRally(
  state: MatchState,
  team: TeamId,
  definition: MatchDefinition,
): MatchState {
  const points = clonePoints(state.points);
  points[team] += 1;
  const positions = { ...state.positions };
  let currentServer = state.currentServer;

  if (team === state.servingTeam) {
    positions[team] = swapPosition(positions[team]);
  } else {
    currentServer = playerOnSide(
      positions[team],
      requiredServiceSide(points[team]),
    );
  }

  const next = {
    ...state,
    points,
    positions,
    servingTeam: team,
    currentServer,
  };

  return completeGameIfNeeded(next, definition, team);
}

function applyPickleballRally(
  state: MatchState,
  team: TeamId,
  definition: MatchDefinition,
): MatchState {
  if (team === state.servingTeam) {
    const points = clonePoints(state.points);
    points[team] += 1;
    const positions = {
      ...state.positions,
      [team]: swapPosition(state.positions[team]),
    };
    const next = { ...state, points, positions };
    return completeGameIfNeeded(next, definition, team);
  }

  if (state.serverNumber === 1) {
    return {
      ...state,
      currentServer: otherPlayer(state.currentServer),
      serverNumber: 2,
    };
  }

  const servingTeam = otherTeam(state.servingTeam);
  return {
    ...state,
    servingTeam,
    currentServer: playerOnSide(state.positions[servingTeam], "right"),
    serverNumber: 1,
  };
}

function validateOverride(points: Record<TeamId, number>): void {
  for (const point of [points.A, points.B]) {
    if (!Number.isInteger(point) || point < 0) {
      throw new Error("Override scores must be non-negative integers.");
    }
  }
}

function applyOverride(
  state: MatchState,
  points: Record<TeamId, number>,
): MatchState {
  validateOverride(points);
  const positions = { ...state.positions };
  const serverNumber = state.serverNumber;
  const naturalSide = requiredServiceSide(points[state.servingTeam]);
  const isOpeningPickleballServe =
    state.sport === "pickleball" &&
    state.points.A === 0 &&
    state.points.B === 0 &&
    points.A === 0 &&
    points.B === 0 &&
    serverNumber === 2;
  const desiredSide = isOpeningPickleballServe
    ? "right"
    : serverNumber === 2 && state.sport === "pickleball"
      ? naturalSide === "right"
        ? "left"
        : "right"
      : naturalSide;
  const currentPosition = positions[state.servingTeam];

  if (playerOnSide(currentPosition, desiredSide) !== state.currentServer) {
    positions[state.servingTeam] = swapPosition(currentPosition);
  }

  return { ...state, points: clonePoints(points), positions };
}

function applyDomainEvent(
  state: MatchState,
  event: DomainEvent,
  definition: MatchDefinition,
): MatchState {
  if (state.status === "complete") {
    return state;
  }

  if (event.type === "state_overridden") {
    return applyOverride(state, event.points);
  }

  return definition.sport === "badminton"
    ? applyBadmintonRally(state, event.team, definition)
    : applyPickleballRally(state, event.team, definition);
}

function domainEvents(events: MatchEvent[]): Map<string, DomainEvent> {
  const byId = new Map<string, DomainEvent>();
  for (const event of events) {
    if (event.type === "rally_awarded" || event.type === "state_overridden") {
      byId.set(event.id, event);
    }
  }
  return byId;
}

function activeTimeline(events: MatchEvent[]): {
  applied: string[];
  redo: string[];
} {
  const applied: string[] = [];
  const redo: string[] = [];
  const seenDomainEvents = new Set<string>();

  for (const event of events) {
    if (event.type === "rally_awarded" || event.type === "state_overridden") {
      if (seenDomainEvents.has(event.id)) continue;
      seenDomainEvents.add(event.id);
      applied.push(event.id);
      redo.length = 0;
      continue;
    }

    if (event.type === "undo_applied") {
      const last = applied.at(-1);
      if (last === event.targetEventId) {
        applied.pop();
        redo.push(event.targetEventId);
      }
      continue;
    }

    const next = redo.at(-1);
    if (next === event.targetEventId) {
      redo.pop();
      applied.push(event.targetEventId);
    }
  }

  return { applied, redo };
}

export function deriveJournal(journal: MatchJournal): JournalView {
  const timeline = activeTimeline(journal.events);
  const byId = domainEvents(journal.events);
  const state = timeline.applied.reduce((current, id) => {
    const event = byId.get(id);
    return event
      ? applyDomainEvent(current, event, journal.definition)
      : current;
  }, createInitialState(journal.definition));

  return {
    state,
    canUndo: timeline.applied.length > 0,
    canRedo: timeline.redo.length > 0,
    appliedEventIds: timeline.applied,
    redoEventIds: timeline.redo,
  };
}

function nextSequence(journal: MatchJournal): number {
  return (
    journal.events.reduce(
      (maximum, event) => Math.max(maximum, event.clientSequence),
      0,
    ) + 1
  );
}

function baseEvent(journal: MatchJournal, metadata: EventMetadata) {
  return {
    id: metadata.id,
    matchId: journal.definition.id,
    clientSequence: nextSequence(journal),
    createdAt: metadata.createdAt,
  };
}

export function awardRally(
  journal: MatchJournal,
  team: TeamId,
  metadata: EventMetadata,
): MatchJournal {
  if (deriveJournal(journal).state.status === "complete") {
    return journal;
  }

  return {
    ...journal,
    events: [
      ...journal.events,
      { ...baseEvent(journal, metadata), type: "rally_awarded", team },
    ],
  };
}

export function overrideState(
  journal: MatchJournal,
  points: Record<TeamId, number>,
  metadata: EventMetadata,
): MatchJournal {
  validateOverride(points);
  return {
    ...journal,
    events: [
      ...journal.events,
      {
        ...baseEvent(journal, metadata),
        type: "state_overridden",
        points: clonePoints(points),
      },
    ],
  };
}

export function undo(
  journal: MatchJournal,
  metadata: EventMetadata,
): MatchJournal {
  const view = deriveJournal(journal);
  const targetEventId = view.appliedEventIds.at(-1);
  if (!targetEventId) return journal;

  return {
    ...journal,
    events: [
      ...journal.events,
      { ...baseEvent(journal, metadata), type: "undo_applied", targetEventId },
    ],
  };
}

export function redo(
  journal: MatchJournal,
  metadata: EventMetadata,
): MatchJournal {
  const view = deriveJournal(journal);
  const targetEventId = view.redoEventIds.at(-1);
  if (!targetEventId) return journal;

  return {
    ...journal,
    events: [
      ...journal.events,
      { ...baseEvent(journal, metadata), type: "redo_applied", targetEventId },
    ],
  };
}

export function servingSide(state: MatchState): CourtSide {
  return state.positions[state.servingTeam].right === state.currentServer
    ? "right"
    : "left";
}
