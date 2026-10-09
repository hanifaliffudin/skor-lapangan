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
  ScoringRules,
  TeamId,
  TeamPosition,
} from "./types";

export const OFFICIAL_RULESETS = {
  badminton: {
    id: "bwf-doubles-3x21-2025",
    name: "BWF Doubles 3 × 21",
    sport: "badminton",
    source: "official",
    version: 1,
    checkedAt: "2026-10-08",
    sourceUrl:
      "https://system.bwfbadminton.com/documents/folder_1_81/Statutes/CHAPTER-4---RULES-OF-THE-GAME/SECTION%204.1-%20Laws%20of%20Badminton.pdf",
    configuration: {
      pointsToWin: 21,
      winBy: 2,
      maxPoints: 30,
      bestOf: 3,
      scoringMode: "rally",
      serversPerTurn: 1,
      openingServerNumber: 1,
    },
  },
  pickleball: {
    id: "usap-doubles-sideout-2026",
    name: "USA Pickleball Doubles Side-Out",
    sport: "pickleball",
    source: "official",
    version: 1,
    checkedAt: "2026-10-08",
    sourceUrl:
      "https://usapickleball.org/docs/rules/USAP-Official-Rulebook.pdf",
    configuration: {
      pointsToWin: 11,
      winBy: 2,
      maxPoints: null,
      bestOf: 3,
      scoringMode: "side_out",
      serversPerTurn: 2,
      openingServerNumber: 2,
    },
  },
} as const;

export function officialRulesetFor(sport: MatchDefinition["sport"]) {
  return OFFICIAL_RULESETS[sport];
}

function rulesFor(definition: MatchDefinition): ScoringRules {
  return (
    definition.ruleset?.configuration ??
    OFFICIAL_RULESETS[definition.sport].configuration
  );
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
  const rules = rulesFor(definition);

  return {
    matchId: definition.id,
    sport: definition.sport,
    gameNumber: 1,
    gamesWon: { A: 0, B: 0 },
    points: { A: 0, B: 0 },
    servingTeam: definition.initialServingTeam,
    currentServer: definition.initialServingPlayer,
    serverNumber:
      rules.scoringMode === "side_out" ? rules.openingServerNumber : null,
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
  rules: ScoringRules,
  winnerPoints: number,
  loserPoints: number,
): boolean {
  if (
    rules.maxPoints !== null &&
    winnerPoints >= rules.maxPoints &&
    winnerPoints > loserPoints
  ) {
    return true;
  }
  return (
    winnerPoints >= rules.pointsToWin &&
    winnerPoints - loserPoints >= rules.winBy
  );
}

function resetForNextGame(
  state: MatchState,
  definition: MatchDefinition,
  gameWinner: TeamId,
  rules: ScoringRules,
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
    serverNumber:
      rules.scoringMode === "side_out" ? rules.openingServerNumber : null,
    positions,
  };
}

function completeGameIfNeeded(
  state: MatchState,
  definition: MatchDefinition,
  rallyWinner: TeamId,
  rules: ScoringRules,
): MatchState {
  const loser = otherTeam(rallyWinner);
  if (!hasWonGame(rules, state.points[rallyWinner], state.points[loser])) {
    return state;
  }

  const gamesWon = clonePoints(state.gamesWon);
  gamesWon[rallyWinner] += 1;
  const completedGames = [
    ...state.completedGames,
    { winner: rallyWinner, score: clonePoints(state.points) },
  ];
  const completedState = { ...state, gamesWon, completedGames };

  if (gamesWon[rallyWinner] >= Math.ceil(rules.bestOf / 2)) {
    return { ...completedState, status: "complete", winner: rallyWinner };
  }

  return resetForNextGame(completedState, definition, rallyWinner, rules);
}

function applyRallyScoring(
  state: MatchState,
  team: TeamId,
  definition: MatchDefinition,
  rules: ScoringRules,
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

  return completeGameIfNeeded(next, definition, team, rules);
}

function applySideOutScoring(
  state: MatchState,
  team: TeamId,
  definition: MatchDefinition,
  rules: ScoringRules,
): MatchState {
  if (team === state.servingTeam) {
    const points = clonePoints(state.points);
    points[team] += 1;
    const positions = {
      ...state.positions,
      [team]: swapPosition(state.positions[team]),
    };
    const next = { ...state, points, positions };
    return completeGameIfNeeded(next, definition, team, rules);
  }

  if ((state.serverNumber ?? 1) < rules.serversPerTurn) {
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
    currentServer: playerOnSide(
      state.positions[servingTeam],
      requiredServiceSide(state.points[servingTeam]),
    ),
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
  definition: MatchDefinition,
  rules: ScoringRules,
): MatchState {
  validateOverride(points);
  const positions = { ...state.positions };
  const serverNumber = state.serverNumber;
  const naturalSide = requiredServiceSide(points[state.servingTeam]);
  const isOpeningSideOutServe =
    rules.scoringMode === "side_out" &&
    rules.openingServerNumber === 2 &&
    state.points.A === 0 &&
    state.points.B === 0 &&
    points.A === 0 &&
    points.B === 0 &&
    serverNumber === 2;
  const desiredSide = isOpeningSideOutServe
    ? "right"
    : serverNumber === 2 && rules.scoringMode === "side_out"
      ? naturalSide === "right"
        ? "left"
        : "right"
      : naturalSide;
  const currentPosition = positions[state.servingTeam];

  if (playerOnSide(currentPosition, desiredSide) !== state.currentServer) {
    positions[state.servingTeam] = swapPosition(currentPosition);
  }

  const next = { ...state, points: clonePoints(points), positions };
  const gameWinner = (["A", "B"] as const).find((team) =>
    hasWonGame(rules, next.points[team], next.points[otherTeam(team)]),
  );

  return gameWinner
    ? completeGameIfNeeded(next, definition, gameWinner, rules)
    : next;
}

function applyDomainEvent(
  state: MatchState,
  event: DomainEvent,
  definition: MatchDefinition,
): MatchState {
  if (state.status === "complete") {
    return state;
  }
  const rules = rulesFor(definition);

  if (event.type === "state_overridden") {
    return applyOverride(state, event.points, definition, rules);
  }

  return rules.scoringMode === "rally"
    ? applyRallyScoring(state, event.team, definition, rules)
    : applySideOutScoring(state, event.team, definition, rules);
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
  if (journal.finalState) {
    return {
      state: journal.finalState,
      canUndo: false,
      canRedo: false,
      appliedEventIds: [],
      redoEventIds: [],
    };
  }

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
  if (deriveJournal(journal).state.status === "complete") {
    return journal;
  }

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
