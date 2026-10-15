import { getMatchFormat } from "./types";
import type {
  CourtSide,
  MatchDefinition,
  MatchState,
  PlayerIndex,
  TeamId,
  TeamPosition,
  TennisCompletedSet,
  TennisRules,
  TennisScoreOverriddenEvent,
  TennisSetOrders,
  TennisSetOrdersConfirmedEvent,
  TennisDecidingSideSelectedEvent,
  TennisLocalRoles,
} from "./types";

const otherTeam = (team: TeamId): TeamId => (team === "A" ? "B" : "A");
const otherPlayer = (player: PlayerIndex): PlayerIndex =>
  player === 0 ? 1 : 0;
const zeroScore = (): Record<TeamId, number> => ({ A: 0, B: 0 });

export const DEFAULT_TENNIS_RULES: TennisRules = {
  bestOf: 3,
  gameScoring: "advantage",
  setScoring: "tiebreak",
  finalSetScoring: "tiebreak",
  matchTieBreakPoints: 7,
};

export function tennisRulesFor(definition: MatchDefinition): TennisRules {
  return definition.ruleset?.tennisConfiguration ?? DEFAULT_TENNIS_RULES;
}

export function tennisOrdersFor(definition: MatchDefinition): TennisSetOrders {
  if (definition.tennisSetOrders) return definition.tennisSetOrders;
  const first: PlayerIndex = definition.initialServingPlayer;
  return {
    serviceOrder: {
      A:
        definition.initialServingTeam === "A"
          ? [first, otherPlayer(first)]
          : [0, 1],
      B:
        definition.initialServingTeam === "B"
          ? [first, otherPlayer(first)]
          : [0, 1],
    },
    deuceReceiver: { A: 0, B: 0 },
  };
}

function positionsFromOrders(
  orders: TennisSetOrders,
): Record<TeamId, TeamPosition> {
  return {
    A: {
      right: orders.deuceReceiver.A,
      left: otherPlayer(orders.deuceReceiver.A),
    },
    B: {
      right: orders.deuceReceiver.B,
      left: otherPlayer(orders.deuceReceiver.B),
    },
  };
}

export function createTennisState(
  definition: MatchDefinition,
): MatchState["tennis"] {
  const orders = tennisOrdersFor(definition);
  validateOrders(definition, orders);
  if (getMatchFormat(definition) === "mixed_doubles") {
    const roles = definition.tennisLocalRoles;
    if (!roles || roles.A[0] === roles.A[1] || roles.B[0] === roles.B[1]) {
      throw new Error(
        "Mixed doubles requires one woman and one man on each team.",
      );
    }
  }
  return {
    setNumber: 1,
    setsWon: zeroScore(),
    gamesInSet: zeroScore(),
    pointScore: zeroScore(),
    advantage: null,
    gamePointCount: 0,
    tieBreakScore: null,
    phase: "game",
    setOpeningServer: definition.initialServingTeam,
    setOrders: orders,
    serviceTurns: zeroScore(),
    tieBreakFirstServer: null,
    tieBreakStartCourtEndsSwapped: false,
    noAdReceivingSide: null,
    awaitingSetOrders: false,
    courtEndsSwapped: false,
    completedSets: [],
  };
}

export function initializeTennisMatchState(
  definition: MatchDefinition,
  state: MatchState,
): MatchState {
  const tennis = createTennisState(definition)!;
  return {
    ...state,
    format: getMatchFormat(definition),
    servingTeam: tennis.setOpeningServer,
    currentServer: definition.initialServingPlayer,
    positions: positionsFromOrders(tennis.setOrders),
    tennis,
  };
}

function hasTennis(state: MatchState): asserts state is MatchState & {
  tennis: NonNullable<MatchState["tennis"]>;
} {
  if (!state.tennis) throw new Error("Tennis match state is missing.");
}

export function isTennisNoAdDecidingPoint(
  definition: MatchDefinition,
  state: MatchState,
): boolean {
  return (
    definition.sport === "tennis" &&
    state.tennis?.phase === "game" &&
    state.tennis.advantage === null &&
    tennisRulesFor(definition).gameScoring === "no_ad" &&
    state.tennis.pointScore.A === 3 &&
    state.tennis.pointScore.B === 3
  );
}

export function tennisReceivingPlayer(
  definition: MatchDefinition,
  state: MatchState,
  side?: CourtSide,
): PlayerIndex | null {
  const tennis = state.tennis;
  if (!tennis) return null;
  const receivingTeam = otherTeam(state.servingTeam);
  if (
    isTennisNoAdDecidingPoint(definition, state) ||
    (tennis.pointScore.A === 3 &&
      tennis.pointScore.B === 3 &&
      tennis.noAdReceivingSide !== null)
  ) {
    const selectedSide = side ?? tennis.noAdReceivingSide ?? "right";
    return state.positions[receivingTeam][selectedSide];
  }
  const isTieBreak = tennis.phase !== "game";
  const nextPoint = isTieBreak
    ? (tennis.tieBreakScore?.A ?? 0) + (tennis.tieBreakScore?.B ?? 0)
    : tennis.gamePointCount;
  const receivingSide: CourtSide = nextPoint % 2 === 0 ? "right" : "left";
  return state.positions[receivingTeam][receivingSide];
}

export function tennisServingSide(state: MatchState): CourtSide {
  const tennis = state.tennis;
  if (!tennis) return "right";
  if (
    tennis.phase === "game" &&
    tennis.pointScore.A === 3 &&
    tennis.pointScore.B === 3 &&
    tennis.noAdReceivingSide
  ) {
    return tennis.noAdReceivingSide ?? "right";
  }
  const nextPoint =
    tennis.phase === "game"
      ? tennis.gamePointCount
      : (tennis.tieBreakScore?.A ?? 0) + (tennis.tieBreakScore?.B ?? 0);
  return nextPoint % 2 === 0 ? "right" : "left";
}

function roleAtSide(
  roles: TennisLocalRoles | undefined,
  team: TeamId,
  player: PlayerIndex,
) {
  return roles?.[team]?.[player];
}

function defaultNoAdSide(
  definition: MatchDefinition,
  state: MatchState,
): CourtSide {
  if (getMatchFormat(definition) !== "mixed_doubles") return "right";
  const receiverTeam = otherTeam(state.servingTeam);
  const serverRole = roleAtSide(
    definition.tennisLocalRoles,
    state.servingTeam,
    state.currentServer,
  );
  if (!serverRole) return "right";
  return (
    (["right", "left"] as const).find(
      (side) =>
        roleAtSide(
          definition.tennisLocalRoles,
          receiverTeam,
          state.positions[receiverTeam][side],
        ) === serverRole,
    ) ?? "right"
  );
}

export function canSelectTennisDecidingSide(
  definition: MatchDefinition,
  state: MatchState,
  side: CourtSide,
): boolean {
  if (!isTennisNoAdDecidingPoint(definition, state)) return false;
  if (getMatchFormat(definition) !== "mixed_doubles") return true;
  const receiver = tennisReceivingPlayer(definition, state, side);
  return (
    roleAtSide(
      definition.tennisLocalRoles,
      otherTeam(state.servingTeam),
      receiver ?? 0,
    ) ===
    roleAtSide(
      definition.tennisLocalRoles,
      state.servingTeam,
      state.currentServer,
    )
  );
}

function copyTennis(state: MatchState) {
  hasTennis(state);
  return {
    ...state.tennis,
    setsWon: { ...state.tennis.setsWon },
    gamesInSet: { ...state.tennis.gamesInSet },
    pointScore: { ...state.tennis.pointScore },
    tieBreakScore: state.tennis.tieBreakScore
      ? { ...state.tennis.tieBreakScore }
      : null,
    serviceTurns: { ...state.tennis.serviceTurns },
    setOrders: {
      serviceOrder: {
        A: [...state.tennis.setOrders.serviceOrder.A] as [
          PlayerIndex,
          PlayerIndex,
        ],
        B: [...state.tennis.setOrders.serviceOrder.B] as [
          PlayerIndex,
          PlayerIndex,
        ],
      },
      deuceReceiver: { ...state.tennis.setOrders.deuceReceiver },
    },
    completedSets: [...state.tennis.completedSets],
  };
}

function nextGameServer(
  team: TeamId,
  turns: Record<TeamId, number>,
  orders: TennisSetOrders,
  format: MatchDefinition["format"],
): PlayerIndex {
  if (format === "singles") return 0;
  return orders.serviceOrder[team][turns[team] % 2]!;
}

function tieBreakServerAt(
  tennis: NonNullable<MatchState["tennis"]>,
  pointIndex: number,
): { team: TeamId; player: PlayerIndex } {
  const first = tennis.tieBreakFirstServer!;
  if (pointIndex === 0) return first;
  const firstTeam = first.team;
  const other = otherTeam(firstTeam);
  const firstPartner =
    tennis.setOrders.serviceOrder[firstTeam][
      (tennis.serviceTurns[firstTeam] + 1) % 2
    ]!;
  const otherFirst =
    tennis.setOrders.serviceOrder[other][tennis.serviceTurns[other] % 2]!;
  const otherPartner =
    tennis.setOrders.serviceOrder[other][(tennis.serviceTurns[other] + 1) % 2]!;
  const rotation = [
    { team: other, player: otherFirst },
    { team: firstTeam, player: firstPartner },
    { team: other, player: otherPartner },
    first,
  ] as const;
  return rotation[Math.floor((pointIndex - 1) / 2) % rotation.length]!;
}

function mirrorTennisState(
  state: MatchState,
  tennis: NonNullable<MatchState["tennis"]>,
): MatchState {
  const onCourtPoints =
    tennis.phase === "game"
      ? tennis.pointScore
      : (tennis.tieBreakScore ?? zeroScore());
  return {
    ...state,
    gamesWon: { ...tennis.setsWon },
    points: { ...onCourtPoints },
    tennis,
  };
}

function winByTwo(
  score: Record<TeamId, number>,
  target: number,
): TeamId | null {
  if (score.A >= target && score.A - score.B >= 2) return "A";
  if (score.B >= target && score.B - score.A >= 2) return "B";
  return null;
}

function shouldUseMatchTieBreak(
  rules: TennisRules,
  setsWon: Record<TeamId, number>,
): boolean {
  const lastBeforeDecider = Math.ceil(rules.bestOf / 2) - 1;
  return (
    rules.finalSetScoring === "match_tiebreak" &&
    setsWon.A === lastBeforeDecider &&
    setsWon.B === lastBeforeDecider
  );
}

function startSet(
  state: MatchState,
  tennis: NonNullable<MatchState["tennis"]>,
  definition: MatchDefinition,
  setNumber: number,
  openingServer: TeamId,
  matchTieBreak: boolean,
  orders: TennisSetOrders,
  courtEndsSwapped: boolean,
  awaitingSetOrders: boolean,
): MatchState {
  const nextTennis = {
    ...tennis,
    setNumber,
    gamesInSet: zeroScore(),
    pointScore: zeroScore(),
    advantage: null,
    gamePointCount: 0,
    tieBreakScore: matchTieBreak ? zeroScore() : null,
    phase: matchTieBreak ? ("match_tiebreak" as const) : ("game" as const),
    setOpeningServer: openingServer,
    setOrders: orders,
    serviceTurns: zeroScore(),
    tieBreakFirstServer: matchTieBreak
      ? {
          team: openingServer,
          player: nextGameServer(
            openingServer,
            zeroScore(),
            orders,
            getMatchFormat(definition),
          ),
        }
      : null,
    tieBreakStartCourtEndsSwapped: courtEndsSwapped,
    noAdReceivingSide: null as CourtSide | null,
    awaitingSetOrders,
    courtEndsSwapped,
  };
  const positions = positionsFromOrders(orders);
  const firstServer = nextGameServer(
    openingServer,
    zeroScore(),
    orders,
    getMatchFormat(definition),
  );
  const matchState = mirrorTennisState(
    {
      ...state,
      gameNumber: state.gameNumber + (setNumber > tennis.setNumber ? 1 : 0),
      servingTeam: openingServer,
      currentServer: firstServer,
      positions,
      serverNumber: null,
    },
    nextTennis,
  );
  if (matchTieBreak) {
    return {
      ...matchState,
      servingTeam: openingServer,
      currentServer: firstServer,
    };
  }
  return matchState;
}

function completeSet(
  state: MatchState,
  tennis: NonNullable<MatchState["tennis"]>,
  definition: MatchDefinition,
  rules: TennisRules,
  winner: TeamId,
  score: Record<TeamId, number>,
  nextOpeningServer: TeamId,
  options: {
    tieBreakScore?: Record<TeamId, number>;
    matchTieBreak?: boolean;
    endsSwapped?: boolean;
  } = {},
): MatchState {
  const setsWon = { ...tennis.setsWon, [winner]: tennis.setsWon[winner] + 1 };
  const completed: TennisCompletedSet = {
    winner,
    score: { ...score },
    ...(options.tieBreakScore
      ? { tieBreakScore: { ...options.tieBreakScore } }
      : {}),
    ...(options.matchTieBreak ? { matchTieBreak: true } : {}),
  };
  const completedSets = [...tennis.completedSets, completed];
  const setTennis = {
    ...tennis,
    setsWon,
    completedSets,
    gamesInSet: { ...score },
  };
  const target = Math.ceil(rules.bestOf / 2);
  if (setsWon[winner] >= target) {
    const finished = mirrorTennisState(state, setTennis);
    return { ...finished, status: "complete", winner };
  }

  const nextSetNumber = tennis.setNumber + 1;
  const matchTieBreak = shouldUseMatchTieBreak(rules, setsWon);
  const isDoubles = getMatchFormat(definition) !== "singles";
  const next = startSet(
    state,
    setTennis,
    definition,
    nextSetNumber,
    nextOpeningServer,
    matchTieBreak,
    tennis.setOrders,
    options.endsSwapped ?? tennis.courtEndsSwapped,
    isDoubles,
  );
  if (!isDoubles) return next;
  return {
    ...next,
    tennis: { ...next.tennis!, awaitingSetOrders: true },
  };
}

function finishRegularGame(
  state: MatchState,
  definition: MatchDefinition,
  rules: TennisRules,
  tennis: NonNullable<MatchState["tennis"]>,
  winner: TeamId,
): MatchState {
  const gamesInSet = {
    ...tennis.gamesInSet,
    [winner]: tennis.gamesInSet[winner] + 1,
  };
  const totalGames = gamesInSet.A + gamesInSet.B;
  const serviceTurns = { ...tennis.serviceTurns };
  serviceTurns[state.servingTeam] += 1;
  const nextServingTeam = otherTeam(state.servingTeam);
  const gamesWonSet =
    gamesInSet[winner] >= 6 &&
    gamesInSet[winner] - gamesInSet[otherTeam(winner)] >= 2;
  const currentSetScoring =
    tennis.setNumber === rules.bestOf
      ? rules.finalSetScoring
      : rules.setScoring;
  const entersTieBreak =
    !gamesWonSet &&
    currentSetScoring === "tiebreak" &&
    gamesInSet.A === 6 &&
    gamesInSet.B === 6;
  const endsSwapped =
    totalGames % 2 === 1 ? !tennis.courtEndsSwapped : tennis.courtEndsSwapped;
  const completedGames = [
    ...state.completedGames,
    { winner, score: { ...tennis.pointScore } },
  ];
  const baseTennis = {
    ...tennis,
    gamesInSet,
    pointScore: zeroScore(),
    advantage: null,
    gamePointCount: 0,
    serviceTurns,
    noAdReceivingSide: null as CourtSide | null,
    courtEndsSwapped: endsSwapped,
  };
  const withGame = mirrorTennisState(
    {
      ...state,
      gameNumber: state.gameNumber + 1,
      completedGames,
      servingTeam: nextServingTeam,
      currentServer: nextGameServer(
        nextServingTeam,
        serviceTurns,
        tennis.setOrders,
        getMatchFormat(definition),
      ),
    },
    baseTennis,
  );

  if (gamesWonSet) {
    return completeSet(
      withGame,
      baseTennis,
      definition,
      rules,
      winner,
      gamesInSet,
      nextServingTeam,
      { endsSwapped },
    );
  }
  if (entersTieBreak) {
    const firstServer = {
      team: nextServingTeam,
      player: nextGameServer(
        nextServingTeam,
        serviceTurns,
        tennis.setOrders,
        getMatchFormat(definition),
      ),
    };
    return mirrorTennisState(
      {
        ...withGame,
        servingTeam: firstServer.team,
        currentServer: firstServer.player,
      },
      {
        ...baseTennis,
        phase: "tiebreak",
        tieBreakScore: zeroScore(),
        tieBreakFirstServer: firstServer,
        tieBreakStartCourtEndsSwapped: endsSwapped,
      },
    );
  }
  return withGame;
}

function awardTennisTieBreakPoint(
  state: MatchState,
  definition: MatchDefinition,
  rules: TennisRules,
  team: TeamId,
): MatchState {
  const tennis = copyTennis(state);
  const isMatchTieBreak = tennis.phase === "match_tiebreak";
  const tieBreakScore = {
    ...(tennis.tieBreakScore ?? zeroScore()),
    [team]: (tennis.tieBreakScore?.[team] ?? 0) + 1,
  };
  const pointsPlayed = tieBreakScore.A + tieBreakScore.B;
  const courtEndsSwapped = courtEndsForTieBreak(
    tennis,
    pointsPlayed,
    isMatchTieBreak,
  );
  const nextTennis = { ...tennis, tieBreakScore, courtEndsSwapped };
  const nextServer = tieBreakServerAt(nextTennis, pointsPlayed);
  const nextState = mirrorTennisState(
    {
      ...state,
      servingTeam: nextServer.team,
      currentServer: nextServer.player,
    },
    nextTennis,
  );
  const target = isMatchTieBreak ? rules.matchTieBreakPoints : 7;
  const winner = winByTwo(tieBreakScore, target);
  if (!winner) return nextState;

  if (isMatchTieBreak) {
    const result = completeSet(
      nextState,
      nextTennis,
      definition,
      rules,
      winner,
      tieBreakScore,
      nextTennis.tieBreakFirstServer!.team,
      { tieBreakScore, matchTieBreak: true },
    );
    return { ...result, status: "complete", winner };
  }

  const gamesInSet = {
    ...tennis.gamesInSet,
    [winner]: tennis.gamesInSet[winner] + 1,
  };
  const totalGames = gamesInSet.A + gamesInSet.B;
  const endsSwappedAtSetEnd =
    totalGames % 2 === 1
      ? !nextTennis.courtEndsSwapped
      : nextTennis.courtEndsSwapped;
  return completeSet(
    mirrorTennisState(nextState, { ...nextTennis, gamesInSet }),
    { ...nextTennis, gamesInSet, courtEndsSwapped: endsSwappedAtSetEnd },
    definition,
    rules,
    winner,
    gamesInSet,
    otherTeam(nextTennis.tieBreakFirstServer!.team),
    { tieBreakScore, endsSwapped: endsSwappedAtSetEnd },
  );
}

function courtEndsForTieBreak(
  tennis: NonNullable<MatchState["tennis"]>,
  pointsPlayed: number,
  isMatchTieBreak: boolean,
): boolean {
  const changes = isMatchTieBreak
    ? pointsPlayed === 0
      ? 0
      : 1 + Math.floor((pointsPlayed - 1) / 4)
    : Math.floor(pointsPlayed / 6);
  return changes % 2 === 1
    ? !tennis.tieBreakStartCourtEndsSwapped
    : tennis.tieBreakStartCourtEndsSwapped;
}

function awardTennisGamePoint(
  state: MatchState,
  definition: MatchDefinition,
  rules: TennisRules,
  team: TeamId,
): MatchState {
  if (state.tennis!.awaitingSetOrders) return state;
  const tennis = copyTennis(state);
  const points = { ...tennis.pointScore };
  let advantage = tennis.advantage;
  let gameWinner: TeamId | null = null;

  if (rules.gameScoring === "no_ad") {
    points[team] += 1;
    if (points[team] >= 4) gameWinner = team;
  } else if (advantage) {
    if (advantage === team) gameWinner = team;
    else advantage = null;
  } else {
    points[team] += 1;
    if (points[team] >= 4 && points[team] - points[otherTeam(team)] >= 2) {
      gameWinner = team;
    } else if (points[team] >= 4) {
      points[team] = 3;
      advantage = team;
    }
  }

  const pointCount = tennis.gamePointCount + 1;
  if (gameWinner) {
    return finishRegularGame(
      mirrorTennisState(state, {
        ...tennis,
        pointScore: points,
        advantage,
        gamePointCount: pointCount,
      }),
      definition,
      rules,
      { ...tennis, pointScore: points, advantage, gamePointCount: pointCount },
      gameWinner,
    );
  }
  let noAdReceivingSide = tennis.noAdReceivingSide;
  const reachedDecidingPoint =
    rules.gameScoring === "no_ad" && points.A === 3 && points.B === 3;
  const updated = {
    ...tennis,
    pointScore: points,
    advantage,
    gamePointCount: pointCount,
    noAdReceivingSide: reachedDecidingPoint
      ? defaultNoAdSide(
          definition,
          mirrorTennisState(state, {
            ...tennis,
            pointScore: points,
            advantage,
            gamePointCount: pointCount,
          }),
        )
      : noAdReceivingSide,
  };
  return mirrorTennisState(state, updated);
}

export function applyTennisPoint(
  state: MatchState,
  team: TeamId,
  definition: MatchDefinition,
): MatchState {
  if (
    definition.sport !== "tennis" ||
    !state.tennis ||
    state.status === "complete"
  )
    return state;
  if (state.tennis.awaitingSetOrders) return state;
  const rules = tennisRulesFor(definition);
  return state.tennis.phase === "game"
    ? awardTennisGamePoint(state, definition, rules, team)
    : awardTennisTieBreakPoint(state, definition, rules, team);
}

function validateOrders(
  definition: MatchDefinition,
  orders: TennisSetOrders,
): void {
  for (const team of ["A", "B"] as const) {
    const service = orders.serviceOrder[team];
    if (
      !service ||
      service.length !== 2 ||
      ![0, 1].includes(service[0]) ||
      ![0, 1].includes(service[1]) ||
      (getMatchFormat(definition) !== "singles" && service[0] === service[1]) ||
      (orders.deuceReceiver[team] !== 0 && orders.deuceReceiver[team] !== 1)
    ) {
      throw new Error("Tennis doubles orders are invalid.");
    }
    if (
      getMatchFormat(definition) === "singles" &&
      (service[0] !== 0 || service[1] !== 0)
    ) {
      throw new Error("Singles tennis has one player per side.");
    }
  }
}

export function applyTennisSetOrdersEvent(
  state: MatchState,
  event: TennisSetOrdersConfirmedEvent,
  definition: MatchDefinition,
): MatchState {
  if (!state.tennis?.awaitingSetOrders) return state;
  validateOrders(definition, event.orders);
  return startSet(
    state,
    state.tennis,
    definition,
    state.tennis.setNumber,
    state.tennis.setOpeningServer,
    state.tennis.phase === "match_tiebreak",
    event.orders,
    state.tennis.courtEndsSwapped,
    false,
  );
}

export function applyTennisDecidingSideEvent(
  state: MatchState,
  event: TennisDecidingSideSelectedEvent,
  definition: MatchDefinition,
): MatchState {
  if (!canSelectTennisDecidingSide(definition, state, event.side)) return state;
  return mirrorTennisState(state, {
    ...copyTennis(state),
    noAdReceivingSide: event.side,
  });
}

export function applyTennisScoreOverride(
  state: MatchState,
  event: TennisScoreOverriddenEvent,
  definition: MatchDefinition,
): MatchState {
  if (!state.tennis || state.tennis.awaitingSetOrders) return state;
  const valid = (score: Record<TeamId, number>) =>
    Number.isInteger(score.A) &&
    score.A >= 0 &&
    Number.isInteger(score.B) &&
    score.B >= 0;
  if (
    !valid(event.pointScore) ||
    (event.tieBreakScore && !valid(event.tieBreakScore))
  ) {
    throw new Error("Tennis scores must be non-negative whole numbers.");
  }
  const tennis = copyTennis(state);
  if (tennis.phase !== "game") {
    if (!event.tieBreakScore) return state;
    const pointsPlayed = event.tieBreakScore.A + event.tieBreakScore.B;
    const isMatchTieBreak = tennis.phase === "match_tiebreak";
    const target = isMatchTieBreak
      ? tennisRulesFor(definition).matchTieBreakPoints
      : 7;
    const nextTennis = {
      ...tennis,
      tieBreakScore: { ...event.tieBreakScore },
      courtEndsSwapped: courtEndsForTieBreak(
        tennis,
        pointsPlayed,
        isMatchTieBreak,
      ),
    };
    const nextServer = tieBreakServerAt(nextTennis, pointsPlayed);
    const updated = mirrorTennisState(
      {
        ...state,
        servingTeam: nextServer.team,
        currentServer: nextServer.player,
      },
      nextTennis,
    );
    const winner = winByTwo(event.tieBreakScore, target);
    if (!winner) return updated;
    if (isMatchTieBreak) {
      const completed = completeSet(
        updated,
        nextTennis,
        definition,
        tennisRulesFor(definition),
        winner,
        event.tieBreakScore,
        nextTennis.tieBreakFirstServer!.team,
        { tieBreakScore: event.tieBreakScore, matchTieBreak: true },
      );
      return { ...completed, status: "complete", winner };
    }
    const gamesInSet = {
      ...tennis.gamesInSet,
      [winner]: tennis.gamesInSet[winner] + 1,
    };
    const endState = gamesInSet.A + gamesInSet.B;
    const endsSwapped =
      endState % 2 === 1
        ? !nextTennis.courtEndsSwapped
        : nextTennis.courtEndsSwapped;
    return completeSet(
      mirrorTennisState(updated, { ...nextTennis, gamesInSet }),
      { ...nextTennis, gamesInSet, courtEndsSwapped: endsSwapped },
      definition,
      tennisRulesFor(definition),
      winner,
      gamesInSet,
      otherTeam(nextTennis.tieBreakFirstServer!.team),
      { tieBreakScore: event.tieBreakScore, endsSwapped },
    );
  }
  const pointScore = { ...event.pointScore };
  if (pointScore.A > 3 || pointScore.B > 3)
    throw new Error("Game points must be Love, 15, 30, or 40.");
  if (
    event.advantage &&
    (pointScore.A !== 3 ||
      pointScore.B !== 3 ||
      tennisRulesFor(definition).gameScoring === "no_ad")
  ) {
    throw new Error("Advantage can only be set from deuce.");
  }
  if (!Number.isInteger(event.gamePointCount) || event.gamePointCount < 0) {
    throw new Error("The point count must be a non-negative whole number.");
  }
  return mirrorTennisState(state, {
    ...tennis,
    pointScore,
    advantage: event.advantage,
    gamePointCount: event.gamePointCount,
    noAdReceivingSide:
      tennisRulesFor(definition).gameScoring === "no_ad" &&
      pointScore.A === 3 &&
      pointScore.B === 3
        ? defaultNoAdSide(definition, state)
        : null,
  });
}

export function tennisPointLabel(value: number, locale: "en" | "id"): string {
  return (
    ([locale === "id" ? "Nol" : "Love", "15", "30", "40"] as const)[
      Math.min(value, 3)
    ] ?? "40"
  );
}

export function tennisScoreLabel(
  state: MatchState,
  team: TeamId,
  locale: "en" | "id",
): string {
  const tennis = state.tennis;
  if (!tennis) return String(state.points[team]);
  if (tennis.phase !== "game") return String(tennis.tieBreakScore?.[team] ?? 0);
  if (tennis.advantage === team) return "Ad";
  return tennisPointLabel(tennis.pointScore[team], locale);
}

export function tennisStateScore(state: MatchState): Record<TeamId, number> {
  return state.tennis?.phase === "game"
    ? { ...state.tennis.pointScore }
    : { ...(state.tennis?.tieBreakScore ?? zeroScore()) };
}
