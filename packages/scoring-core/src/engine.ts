import { getMatchFormat } from "./types";
import {
  applyPadelDecidingSideEvent,
  applyPadelPoint,
  applyPadelScoreOverride,
  applyPadelSetOrdersEvent,
  canSelectPadelDecidingSide,
  createPadelState,
  initializePadelMatchState,
  padelServingSide,
} from "./padel";
import {
  applyTennisDecidingSideEvent,
  applyTennisPoint,
  applyTennisScoreOverride,
  applyTennisSetOrdersEvent,
  canSelectTennisDecidingSide,
  createTennisState,
  initializeTennisMatchState,
  tennisServingSide,
} from "./tennis";
import {
  applyTableTennisGameOrdersEvent,
  applyTableTennisPoint,
  applyTableTennisScoreOverride,
  createTableTennisState,
  initializeTableTennisMatchState,
} from "./table-tennis";
import {
  applySquashGameOrdersEvent,
  applySquashPoint,
  applySquashScoreOverride,
  applySquashServiceBoxEvent,
  createSquashState,
  initializeSquashMatchState,
  squashServingSide,
} from "./squash";
import type {
  CourtSide,
  DomainEvent,
  EventMetadata,
  JournalView,
  MatchFormat,
  MatchDefinition,
  MatchEvent,
  MatchJournal,
  MatchState,
  PlayerIndex,
  ScoringRules,
  ScoringMode,
  TeamId,
  TeamPosition,
  TennisScoreOverriddenEvent,
  TennisSetOrders,
  PadelScoreOverriddenEvent,
  PadelSetOrders,
  TableTennisGameOrders,
  SquashGameOrders,
  SquashServiceBoxSelectedEvent,
  SquashRules,
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
  badmintonSingles: {
    id: "bwf-singles-3x21-2025",
    name: "BWF Singles 3 × 21",
    sport: "badminton",
    format: "singles",
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
  pickleballSinglesSideOut: {
    id: "usap-singles-sideout-2026",
    name: "USA Pickleball Singles Side-Out",
    sport: "pickleball",
    format: "singles",
    source: "official",
    version: 1,
    checkedAt: "2026-10-08",
    sourceUrl: "https://usapickleball.org/rules/",
    configuration: {
      pointsToWin: 11,
      winBy: 2,
      maxPoints: null,
      bestOf: 3,
      scoringMode: "side_out",
      serversPerTurn: 1,
      openingServerNumber: 1,
    },
  },
  pickleballSinglesRally: {
    id: "usap-singles-rally-2026",
    name: "USA Pickleball Singles Rally Scoring",
    sport: "pickleball",
    format: "singles",
    source: "official",
    version: 1,
    checkedAt: "2026-10-08",
    sourceUrl: "https://usapickleball.org/rules/",
    configuration: {
      pointsToWin: 11,
      winBy: 2,
      maxPoints: null,
      bestOf: 3,
      scoringMode: "rally",
      serversPerTurn: 1,
      openingServerNumber: 1,
    },
  },
  tennis: {
    id: "itf-tennis-2026",
    name: "ITF Rules of Tennis 2026",
    sport: "tennis",
    source: "official",
    version: 1,
    checkedAt: "2026-10-12",
    sourceUrl:
      "https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf",
    configuration: {
      pointsToWin: 6,
      winBy: 2,
      maxPoints: null,
      bestOf: 3,
      scoringMode: "rally",
      serversPerTurn: 1,
      openingServerNumber: 1,
    },
    tennisConfiguration: {
      bestOf: 3,
      gameScoring: "advantage",
      setScoring: "tiebreak",
      finalSetScoring: "tiebreak",
      matchTieBreakPoints: 7,
    },
  },
  padel: {
    id: "fip-padel-2026",
    name: "FIP Rules of Padel 2026",
    sport: "padel",
    source: "official",
    version: 1,
    checkedAt: "2026-10-12",
    sourceUrl:
      "https://www.padelfip.com/wp-content/uploads/2025/12/FIP_Rules-of-Padel-1.pdf",
    configuration: {
      pointsToWin: 6,
      winBy: 2,
      maxPoints: null,
      bestOf: 3,
      scoringMode: "rally",
      serversPerTurn: 1,
      openingServerNumber: 1,
    },
    padelConfiguration: {
      gameScoring: "advantage",
      setScoring: "standard",
      finalSetScoring: "standard",
      matchTieBreakPoints: 7,
    },
  },
  padelSingles: {
    id: "club-padel-singles-2026",
    name: "Club Padel Singles (FIP-derived scoring)",
    sport: "padel",
    format: "singles",
    source: "local_variant",
    version: 1,
    checkedAt: "2026-10-12",
    sourceUrl:
      "https://www.padelfip.com/wp-content/uploads/2025/12/FIP_Rules-of-Padel-1.pdf",
    configuration: {
      pointsToWin: 6,
      winBy: 2,
      maxPoints: null,
      bestOf: 3,
      scoringMode: "rally",
      serversPerTurn: 1,
      openingServerNumber: 1,
    },
    padelConfiguration: {
      gameScoring: "advantage",
      setScoring: "standard",
      finalSetScoring: "standard",
      matchTieBreakPoints: 7,
    },
  },
  tableTennis: {
    id: "ittf-table-tennis-2022",
    name: "ITTF Laws of Table Tennis 2022",
    sport: "table_tennis",
    source: "official",
    version: 1,
    checkedAt: "2026-10-13",
    sourceUrl:
      "https://db.ittf.com/sites/default/files/public/2022-02/ITTF_HB_2022_clean_v1_0.pdf",
    configuration: {
      pointsToWin: 11,
      winBy: 2,
      maxPoints: null,
      bestOf: 3,
      scoringMode: "rally",
      serversPerTurn: 1,
      openingServerNumber: 1,
    },
    tableTennisConfiguration: {
      bestOf: 3,
    },
  },
  squashSingles: {
    id: "wsf-squash-singles-2025",
    name: "World Squash Singles Rules 2025",
    sport: "squash",
    format: "singles",
    source: "official",
    version: 1,
    checkedAt: "2026-10-13",
    sourceUrl: "https://worldsquashofficiating.com/rules-of-squash/",
    configuration: {
      pointsToWin: 11,
      winBy: 2,
      maxPoints: null,
      bestOf: 5,
      scoringMode: "rally",
      serversPerTurn: 1,
      openingServerNumber: 1,
    },
    squashConfiguration: {
      bestOf: 5,
    },
  },
  squashDoubles: {
    id: "wsf-squash-doubles-2022",
    name: "World Squash Doubles Rules 2022",
    sport: "squash",
    format: "doubles",
    source: "official",
    version: 1,
    checkedAt: "2026-10-13",
    sourceUrl:
      "https://www.worldsquash.org/wp-content/uploads/2022/03/2022-International-Doubles-Squash-Rules-V2.pdf",
    configuration: {
      pointsToWin: 11,
      winBy: 1,
      maxPoints: 11,
      bestOf: 5,
      scoringMode: "rally",
      serversPerTurn: 1,
      openingServerNumber: 1,
    },
    squashConfiguration: {
      bestOf: 5,
    },
  },
} as const;

export function officialRulesetFor(
  sport: MatchDefinition["sport"],
  format: MatchFormat = "doubles",
  scoringMode?: ScoringMode,
) {
  if (sport === "tennis") return OFFICIAL_RULESETS.tennis;
  if (sport === "padel") {
    return format === "singles"
      ? OFFICIAL_RULESETS.padelSingles
      : OFFICIAL_RULESETS.padel;
  }
  if (sport === "table_tennis") return OFFICIAL_RULESETS.tableTennis;
  if (sport === "squash") {
    return format === "singles"
      ? OFFICIAL_RULESETS.squashSingles
      : OFFICIAL_RULESETS.squashDoubles;
  }
  if (format === "doubles") return OFFICIAL_RULESETS[sport];
  if (sport === "badminton") return OFFICIAL_RULESETS.badmintonSingles;
  return scoringMode === "rally"
    ? OFFICIAL_RULESETS.pickleballSinglesRally
    : OFFICIAL_RULESETS.pickleballSinglesSideOut;
}

function rulesFor(definition: MatchDefinition): ScoringRules {
  return (
    definition.ruleset?.configuration ??
    officialRulesetFor(definition.sport, getMatchFormat(definition))
      .configuration!
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
  if (getMatchFormat(definition) === "singles") {
    return {
      A: { left: 0, right: 0 },
      B: { left: 0, right: 0 },
    };
  }

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

  const initial: MatchState = {
    matchId: definition.id,
    sport: definition.sport,
    format: getMatchFormat(definition),
    gameNumber: 1,
    gamesWon: { A: 0, B: 0 },
    points: { A: 0, B: 0 },
    servingTeam: definition.initialServingTeam,
    currentServer:
      getMatchFormat(definition) === "singles"
        ? 0
        : definition.initialServingPlayer,
    serverNumber:
      getMatchFormat(definition) === "doubles" &&
      rules.scoringMode === "side_out"
        ? rules.openingServerNumber
        : null,
    positions,
    status: "active",
    winner: null,
    completedGames: [],
  };
  return definition.sport === "tennis"
    ? initializeTennisMatchState(definition, {
        ...initial,
        tennis: createTennisState(definition)!,
      })
    : definition.sport === "padel"
      ? initializePadelMatchState(definition, {
          ...initial,
          padel: createPadelState(definition)!,
        })
      : definition.sport === "table_tennis"
        ? initializeTableTennisMatchState(definition, {
            ...initial,
            tableTennis: createTableTennisState(definition),
          })
        : definition.sport === "squash"
          ? initializeSquashMatchState(definition, {
              ...initial,
              squash: createSquashState(definition),
            })
          : initial;
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
      getMatchFormat(definition) === "doubles" &&
      rules.scoringMode === "side_out"
        ? rules.openingServerNumber
        : null,
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

  if (getMatchFormat(definition) === "singles") {
    const next = {
      ...state,
      points,
      servingTeam: team,
      currentServer: 0 as PlayerIndex,
      serverNumber: null,
    };
    return completeGameIfNeeded(next, definition, team, rules);
  }

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
  if (getMatchFormat(definition) === "singles") {
    if (team === state.servingTeam) {
      const points = clonePoints(state.points);
      points[team] += 1;
      const next = { ...state, points, serverNumber: null };
      return completeGameIfNeeded(next, definition, team, rules);
    }

    return {
      ...state,
      servingTeam: team,
      currentServer: 0,
      serverNumber: null,
    };
  }

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

  if (getMatchFormat(definition) === "singles") {
    const next = {
      ...state,
      points: clonePoints(points),
      currentServer: 0 as PlayerIndex,
      serverNumber: null,
    };
    const gameWinner = (["A", "B"] as const).find((team) =>
      hasWonGame(rules, next.points[team], next.points[otherTeam(team)]),
    );

    return gameWinner
      ? completeGameIfNeeded(next, definition, gameWinner, rules)
      : next;
  }

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
  if (definition.sport === "tennis") {
    switch (event.type) {
      case "rally_awarded":
        return applyTennisPoint(state, event.team, definition);
      case "tennis_set_orders_confirmed":
        return applyTennisSetOrdersEvent(state, event, definition);
      case "tennis_deciding_side_selected":
        return applyTennisDecidingSideEvent(state, event, definition);
      case "tennis_score_overridden":
        return applyTennisScoreOverride(state, event, definition);
      case "state_overridden":
        return state;
    }
    return state;
  }
  if (definition.sport === "padel") {
    switch (event.type) {
      case "rally_awarded":
        return applyPadelPoint(state, event.team, definition);
      case "padel_set_orders_confirmed":
        return applyPadelSetOrdersEvent(state, event, definition);
      case "padel_deciding_side_selected":
        return applyPadelDecidingSideEvent(state, event, definition);
      case "padel_score_overridden":
        return applyPadelScoreOverride(state, event, definition);
      case "state_overridden":
        return state;
    }
    return state;
  }
  if (definition.sport === "table_tennis") {
    switch (event.type) {
      case "rally_awarded":
        return applyTableTennisPoint(state, event.team, definition);
      case "table_tennis_game_orders_confirmed":
        return applyTableTennisGameOrdersEvent(state, event, definition);
      case "state_overridden":
        return applyTableTennisScoreOverride(state, event.points, definition);
    }
    return state;
  }
  if (definition.sport === "squash") {
    switch (event.type) {
      case "rally_awarded":
        return applySquashPoint(state, event.team, definition);
      case "squash_game_orders_confirmed":
        return applySquashGameOrdersEvent(state, event, definition);
      case "squash_service_box_selected":
        return applySquashServiceBoxEvent(state, event);
      case "state_overridden":
        return applySquashScoreOverride(state, event.points, definition);
    }
    return state;
  }
  const rules = rulesFor(definition);

  if (event.type === "state_overridden") {
    return applyOverride(state, event.points, definition, rules);
  }
  if (event.type !== "rally_awarded") return state;

  return rules.scoringMode === "rally"
    ? applyRallyScoring(state, event.team, definition, rules)
    : applySideOutScoring(state, event.team, definition, rules);
}

function domainEvents(events: MatchEvent[]): Map<string, DomainEvent> {
  const byId = new Map<string, DomainEvent>();
  for (const event of events) {
    if (
      event.type === "rally_awarded" ||
      event.type === "state_overridden" ||
      event.type === "tennis_set_orders_confirmed" ||
      event.type === "tennis_deciding_side_selected" ||
      event.type === "tennis_score_overridden" ||
      event.type === "padel_set_orders_confirmed" ||
      event.type === "padel_deciding_side_selected" ||
      event.type === "padel_score_overridden" ||
      event.type === "table_tennis_game_orders_confirmed" ||
      event.type === "squash_game_orders_confirmed" ||
      event.type === "squash_service_box_selected"
    ) {
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
    if (
      event.type === "rally_awarded" ||
      event.type === "state_overridden" ||
      event.type === "tennis_set_orders_confirmed" ||
      event.type === "tennis_deciding_side_selected" ||
      event.type === "tennis_score_overridden" ||
      event.type === "padel_set_orders_confirmed" ||
      event.type === "padel_deciding_side_selected" ||
      event.type === "padel_score_overridden" ||
      event.type === "table_tennis_game_orders_confirmed" ||
      event.type === "squash_game_orders_confirmed" ||
      event.type === "squash_service_box_selected"
    ) {
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

export function confirmTennisSetOrders(
  journal: MatchJournal,
  orders: TennisSetOrders,
  metadata: EventMetadata,
): MatchJournal {
  const state = deriveJournal(journal).state;
  if (
    journal.definition.sport !== "tennis" ||
    state.status === "complete" ||
    !state.tennis?.awaitingSetOrders
  )
    return journal;
  return {
    ...journal,
    events: [
      ...journal.events,
      {
        ...baseEvent(journal, metadata),
        type: "tennis_set_orders_confirmed",
        orders,
      },
    ],
  };
}

export function confirmPadelSetOrders(
  journal: MatchJournal,
  orders: PadelSetOrders,
  metadata: EventMetadata,
): MatchJournal {
  const state = deriveJournal(journal).state;
  if (
    journal.definition.sport !== "padel" ||
    state.status === "complete" ||
    !state.padel?.awaitingSetOrders
  )
    return journal;
  return {
    ...journal,
    events: [
      ...journal.events,
      {
        ...baseEvent(journal, metadata),
        type: "padel_set_orders_confirmed",
        orders,
      },
    ],
  };
}

export function confirmTableTennisGameOrders(
  journal: MatchJournal,
  orders: TableTennisGameOrders,
  metadata: EventMetadata,
): MatchJournal {
  const state = deriveJournal(journal).state;
  if (
    journal.definition.sport !== "table_tennis" ||
    state.status === "complete" ||
    !state.tableTennis?.awaitingGameOrders
  )
    return journal;
  return {
    ...journal,
    events: [
      ...journal.events,
      {
        ...baseEvent(journal, metadata),
        type: "table_tennis_game_orders_confirmed",
        orders,
      },
    ],
  };
}

export function confirmSquashGameOrders(
  journal: MatchJournal,
  orders: SquashGameOrders,
  metadata: EventMetadata,
): MatchJournal {
  const state = deriveJournal(journal).state;
  if (
    journal.definition.sport !== "squash" ||
    state.status === "complete" ||
    !state.squash?.awaitingGameOrders
  )
    return journal;
  return {
    ...journal,
    events: [
      ...journal.events,
      {
        ...baseEvent(journal, metadata),
        type: "squash_game_orders_confirmed",
        orders,
      },
    ],
  };
}

export function selectSquashServiceBox(
  journal: MatchJournal,
  side: CourtSide,
  metadata: EventMetadata,
): MatchJournal {
  const state = deriveJournal(journal).state;
  if (
    journal.definition.sport !== "squash" ||
    state.status === "complete" ||
    !state.squash?.serviceBoxChoiceRequired
  )
    return journal;
  return {
    ...journal,
    events: [
      ...journal.events,
      {
        ...baseEvent(journal, metadata),
        type: "squash_service_box_selected",
        side,
      },
    ],
  };
}

export function selectPadelDecidingSide(
  journal: MatchJournal,
  side: CourtSide,
  metadata: EventMetadata,
): MatchJournal {
  const state = deriveJournal(journal).state;
  if (
    journal.definition.sport !== "padel" ||
    state.status === "complete" ||
    !canSelectPadelDecidingSide(journal.definition, state, side)
  )
    return journal;
  return {
    ...journal,
    events: [
      ...journal.events,
      {
        ...baseEvent(journal, metadata),
        type: "padel_deciding_side_selected",
        side,
      },
    ],
  };
}

export function overridePadelScore(
  journal: MatchJournal,
  score: Omit<
    PadelScoreOverriddenEvent,
    "id" | "matchId" | "clientSequence" | "createdAt" | "type"
  >,
  metadata: EventMetadata,
): MatchJournal {
  const state = deriveJournal(journal).state;
  if (journal.definition.sport !== "padel" || state.status === "complete")
    return journal;
  return {
    ...journal,
    events: [
      ...journal.events,
      {
        ...baseEvent(journal, metadata),
        type: "padel_score_overridden",
        ...score,
      },
    ],
  };
}

export function selectTennisDecidingSide(
  journal: MatchJournal,
  side: CourtSide,
  metadata: EventMetadata,
): MatchJournal {
  const state = deriveJournal(journal).state;
  if (
    journal.definition.sport !== "tennis" ||
    state.status === "complete" ||
    !canSelectTennisDecidingSide(journal.definition, state, side)
  )
    return journal;
  return {
    ...journal,
    events: [
      ...journal.events,
      {
        ...baseEvent(journal, metadata),
        type: "tennis_deciding_side_selected",
        side,
      },
    ],
  };
}

export function overrideTennisScore(
  journal: MatchJournal,
  score: Omit<
    TennisScoreOverriddenEvent,
    "id" | "matchId" | "clientSequence" | "createdAt" | "type"
  >,
  metadata: EventMetadata,
): MatchJournal {
  const state = deriveJournal(journal).state;
  if (journal.definition.sport !== "tennis" || state.status === "complete")
    return journal;
  return {
    ...journal,
    events: [
      ...journal.events,
      {
        ...baseEvent(journal, metadata),
        type: "tennis_score_overridden",
        ...score,
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

export function servingSide(
  state: MatchState,
  definition?: MatchDefinition,
): CourtSide {
  if (state.sport === "tennis") return tennisServingSide(state);
  if (state.sport === "padel") return padelServingSide(state);
  if (state.sport === "table_tennis") {
    return state.positions[state.servingTeam].right === state.currentServer
      ? "right"
      : "left";
  }
  if (state.sport === "squash") return squashServingSide(state);
  if (getMatchFormat(state) === "singles") {
    return requiredServiceSide(state.points[state.servingTeam]);
  }

  return state.positions[state.servingTeam].right === state.currentServer
    ? "right"
    : "left";
}
