import { getMatchFormat } from "./types";
import type {
  CourtSide,
  MatchDefinition,
  MatchState,
  PadelCompletedSet,
  PadelLocalRoles,
  PadelRules,
  PadelScoreOverriddenEvent,
  PadelSetOrders,
  PadelSetOrdersConfirmedEvent,
  PadelDecidingSideSelectedEvent,
  PlayerIndex,
  TeamId,
  TeamPosition,
} from "./types";

const teams = ["A", "B"] as const;
const sides = ["right", "left"] as const;
const otherTeam = (team: TeamId): TeamId => (team === "A" ? "B" : "A");
const otherPlayer = (player: PlayerIndex): PlayerIndex =>
  player === 0 ? 1 : 0;
const zeroScore = (): Record<TeamId, number> => ({ A: 0, B: 0 });

export const DEFAULT_PADEL_RULES: PadelRules = {
  gameScoring: "advantage",
  setScoring: "standard",
  finalSetScoring: "standard",
  matchTieBreakPoints: 7,
};

export function padelRulesFor(definition: MatchDefinition): PadelRules {
  return definition.ruleset?.padelConfiguration ?? DEFAULT_PADEL_RULES;
}

export function padelOrdersFor(definition: MatchDefinition): PadelSetOrders {
  if (definition.padelSetOrders) return definition.padelSetOrders;
  const first = definition.initialServingPlayer;
  return {
    serviceOrder: {
      A:
        definition.initialServingTeam === "A"
          ? ([first, otherPlayer(first)] as const)
          : ([0, 1] as const),
      B:
        definition.initialServingTeam === "B"
          ? ([first, otherPlayer(first)] as const)
          : ([0, 1] as const),
    },
    deuceReceiver: { A: 0, B: 0 },
  };
}

function positionsFromOrders(
  definition: MatchDefinition,
  orders: PadelSetOrders,
): Record<TeamId, TeamPosition> {
  if (getMatchFormat(definition) === "singles") {
    return { A: { left: 0, right: 0 }, B: { left: 0, right: 0 } };
  }
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

function validateOrders(
  definition: MatchDefinition,
  orders: PadelSetOrders,
): void {
  for (const team of teams) {
    const service = orders.serviceOrder[team];
    const receiver = orders.deuceReceiver[team];
    if (
      !service ||
      service.length !== 2 ||
      ![0, 1].includes(service[0]) ||
      ![0, 1].includes(service[1]) ||
      ![0, 1].includes(receiver)
    ) {
      throw new Error("Padel service and receiving orders are invalid.");
    }
    if (getMatchFormat(definition) === "singles") {
      if (service[0] !== 0 || service[1] !== 0 || receiver !== 0) {
        throw new Error("Singles Padel orders may only contain player zero.");
      }
    } else if (service[0] === service[1]) {
      throw new Error(
        "Each Padel doubles player must serve once per rotation.",
      );
    }
  }
}

function validateMixedRoles(definition: MatchDefinition): void {
  if (getMatchFormat(definition) !== "mixed_doubles") return;
  const roles = definition.padelLocalRoles;
  if (!roles || roles.A[0] === roles.A[1] || roles.B[0] === roles.B[1]) {
    throw new Error(
      "Mixed doubles requires one woman and one man on each team.",
    );
  }
}

export function createPadelState(
  definition: MatchDefinition,
): MatchState["padel"] {
  const orders = padelOrdersFor(definition);
  validateOrders(definition, orders);
  validateMixedRoles(definition);
  return {
    gameScoring: padelRulesFor(definition).gameScoring,
    setNumber: 1,
    setsWon: zeroScore(),
    gamesInSet: zeroScore(),
    pointScore: zeroScore(),
    advantage: null,
    starDeuces: 0,
    gamePointCount: 0,
    tieBreakScore: null,
    phase: "game",
    setOpeningServer: definition.initialServingTeam,
    setOrders: orders,
    serviceTurns: zeroScore(),
    tieBreakFirstServer: null,
    tieBreakStartCourtEndsSwapped: false,
    decidingReceivingSide: null,
    awaitingSetOrders: false,
    courtEndsSwapped: false,
    completedSets: [],
  };
}

export function initializePadelMatchState(
  definition: MatchDefinition,
  state: MatchState,
): MatchState {
  const padel = createPadelState(definition)!;
  return {
    ...state,
    format: getMatchFormat(definition),
    servingTeam: padel.setOpeningServer,
    currentServer: definition.initialServingPlayer,
    positions: positionsFromOrders(definition, padel.setOrders),
    padel,
  };
}

function hasPadel(state: MatchState): asserts state is MatchState & {
  padel: NonNullable<MatchState["padel"]>;
} {
  if (!state.padel) throw new Error("Padel match state is missing.");
}

function copyPadel(state: MatchState) {
  hasPadel(state);
  return {
    ...state.padel,
    setsWon: { ...state.padel.setsWon },
    gamesInSet: { ...state.padel.gamesInSet },
    pointScore: { ...state.padel.pointScore },
    tieBreakScore: state.padel.tieBreakScore
      ? { ...state.padel.tieBreakScore }
      : null,
    serviceTurns: { ...state.padel.serviceTurns },
    setOrders: {
      serviceOrder: {
        A: [...state.padel.setOrders.serviceOrder.A] as [
          PlayerIndex,
          PlayerIndex,
        ],
        B: [...state.padel.setOrders.serviceOrder.B] as [
          PlayerIndex,
          PlayerIndex,
        ],
      },
      deuceReceiver: { ...state.padel.setOrders.deuceReceiver },
    },
    completedSets: [...state.padel.completedSets],
  };
}

function nextGameServer(
  team: TeamId,
  turns: Record<TeamId, number>,
  orders: PadelSetOrders,
  definition: MatchDefinition,
): PlayerIndex {
  if (getMatchFormat(definition) === "singles") return 0;
  return orders.serviceOrder[team][turns[team] % 2]!;
}

function tieBreakServerAt(
  padel: NonNullable<MatchState["padel"]>,
  pointIndex: number,
): { team: TeamId; player: PlayerIndex } {
  const first = padel.tieBreakFirstServer!;
  if (pointIndex === 0) return first;
  const firstTeam = first.team;
  const other = otherTeam(firstTeam);
  const firstPartner =
    padel.setOrders.serviceOrder[firstTeam][
      (padel.serviceTurns[firstTeam] + 1) % 2
    ]!;
  const otherFirst =
    padel.setOrders.serviceOrder[other][padel.serviceTurns[other] % 2]!;
  const otherPartner =
    padel.setOrders.serviceOrder[other][(padel.serviceTurns[other] + 1) % 2]!;
  const rotation = [
    { team: other, player: otherFirst },
    { team: firstTeam, player: firstPartner },
    { team: other, player: otherPartner },
    first,
  ] as const;
  return rotation[Math.floor((pointIndex - 1) / 2) % rotation.length]!;
}

function mirrorPadelState(
  state: MatchState,
  padel: NonNullable<MatchState["padel"]>,
): MatchState {
  const onCourtPoints =
    padel.phase === "game"
      ? padel.pointScore
      : (padel.tieBreakScore ?? zeroScore());
  return {
    ...state,
    gamesWon: { ...padel.setsWon },
    points: { ...onCourtPoints },
    padel,
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
  rules: PadelRules,
  setsWon: Record<TeamId, number>,
): boolean {
  return (
    rules.finalSetScoring === "match_tiebreak" &&
    setsWon.A === 1 &&
    setsWon.B === 1
  );
}

function startSet(
  state: MatchState,
  padel: NonNullable<MatchState["padel"]>,
  definition: MatchDefinition,
  setNumber: number,
  openingServer: TeamId,
  matchTieBreak: boolean,
  orders: PadelSetOrders,
  courtEndsSwapped: boolean,
  awaitingSetOrders: boolean,
): MatchState {
  const nextPadel = {
    ...padel,
    setNumber,
    gamesInSet: zeroScore(),
    pointScore: zeroScore(),
    advantage: null,
    starDeuces: 0,
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
            definition,
          ),
        }
      : null,
    tieBreakStartCourtEndsSwapped: courtEndsSwapped,
    decidingReceivingSide: null as CourtSide | null,
    awaitingSetOrders,
    courtEndsSwapped,
  };
  const firstServer = nextGameServer(
    openingServer,
    zeroScore(),
    orders,
    definition,
  );
  return mirrorPadelState(
    {
      ...state,
      gameNumber: state.gameNumber + (setNumber > padel.setNumber ? 1 : 0),
      servingTeam: openingServer,
      currentServer: firstServer,
      positions: positionsFromOrders(definition, orders),
      serverNumber: null,
    },
    nextPadel,
  );
}

function completeSet(
  state: MatchState,
  padel: NonNullable<MatchState["padel"]>,
  definition: MatchDefinition,
  rules: PadelRules,
  winner: TeamId,
  score: Record<TeamId, number>,
  nextOpeningServer: TeamId,
  options: {
    tieBreakScore?: Record<TeamId, number>;
    matchTieBreak?: boolean;
    endsSwapped?: boolean;
  } = {},
): MatchState {
  const setsWon = { ...padel.setsWon, [winner]: padel.setsWon[winner] + 1 };
  const completed: PadelCompletedSet = {
    winner,
    score: { ...score },
    ...(options.tieBreakScore
      ? { tieBreakScore: { ...options.tieBreakScore } }
      : {}),
    ...(options.matchTieBreak ? { matchTieBreak: true } : {}),
  };
  const completedSets = [...padel.completedSets, completed];
  const setPadel = {
    ...padel,
    setsWon,
    completedSets,
    gamesInSet: { ...score },
  };
  if (setsWon[winner] >= 2) {
    const finished = mirrorPadelState(state, setPadel);
    return { ...finished, status: "complete", winner };
  }

  const nextSetNumber = padel.setNumber + 1;
  const matchTieBreak = shouldUseMatchTieBreak(rules, setsWon);
  const ordersRequired = getMatchFormat(definition) !== "singles";
  return startSet(
    state,
    setPadel,
    definition,
    nextSetNumber,
    nextOpeningServer,
    matchTieBreak,
    padel.setOrders,
    options.endsSwapped ?? padel.courtEndsSwapped,
    ordersRequired,
  );
}

function setTarget(
  padel: NonNullable<MatchState["padel"]>,
  rules: PadelRules,
): number {
  if (padel.setNumber === 3 || rules.setScoring === "standard") return 6;
  return 4;
}

function setUsesTieBreak(
  padel: NonNullable<MatchState["padel"]>,
  rules: PadelRules,
): boolean {
  if (padel.setNumber === 3) return rules.finalSetScoring === "standard";
  return true;
}

function finishRegularGame(
  state: MatchState,
  definition: MatchDefinition,
  rules: PadelRules,
  padel: NonNullable<MatchState["padel"]>,
  winner: TeamId,
): MatchState {
  const gamesInSet = {
    ...padel.gamesInSet,
    [winner]: padel.gamesInSet[winner] + 1,
  };
  const totalGames = gamesInSet.A + gamesInSet.B;
  const serviceTurns = { ...padel.serviceTurns };
  serviceTurns[state.servingTeam] += 1;
  const nextServingTeam = otherTeam(state.servingTeam);
  const target = setTarget(padel, rules);
  const gamesWonSet =
    gamesInSet[winner] >= target &&
    gamesInSet[winner] - gamesInSet[otherTeam(winner)] >= 2;
  const entersTieBreak =
    !gamesWonSet &&
    setUsesTieBreak(padel, rules) &&
    gamesInSet.A === target &&
    gamesInSet.B === target;
  const endsSwapped =
    totalGames % 2 === 1 ? !padel.courtEndsSwapped : padel.courtEndsSwapped;
  const completedGames = [
    ...state.completedGames,
    { winner, score: { ...padel.pointScore } },
  ];
  const basePadel = {
    ...padel,
    gamesInSet,
    pointScore: zeroScore(),
    advantage: null,
    starDeuces: 0,
    gamePointCount: 0,
    serviceTurns,
    decidingReceivingSide: null as CourtSide | null,
    courtEndsSwapped: endsSwapped,
  };
  const withGame = mirrorPadelState(
    {
      ...state,
      gameNumber: state.gameNumber + 1,
      completedGames,
      servingTeam: nextServingTeam,
      currentServer: nextGameServer(
        nextServingTeam,
        serviceTurns,
        padel.setOrders,
        definition,
      ),
    },
    basePadel,
  );

  if (gamesWonSet) {
    return completeSet(
      withGame,
      basePadel,
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
        padel.setOrders,
        definition,
      ),
    };
    return mirrorPadelState(
      {
        ...withGame,
        servingTeam: firstServer.team,
        currentServer: firstServer.player,
      },
      {
        ...basePadel,
        phase: "tiebreak",
        tieBreakScore: zeroScore(),
        tieBreakFirstServer: firstServer,
        tieBreakStartCourtEndsSwapped: endsSwapped,
      },
    );
  }
  return withGame;
}

function courtEndsForTieBreak(
  padel: NonNullable<MatchState["padel"]>,
  pointsPlayed: number,
): boolean {
  const changes = Math.floor(pointsPlayed / 6);
  return changes % 2 === 1
    ? !padel.tieBreakStartCourtEndsSwapped
    : padel.tieBreakStartCourtEndsSwapped;
}

function awardTieBreakPoint(
  state: MatchState,
  definition: MatchDefinition,
  rules: PadelRules,
  team: TeamId,
): MatchState {
  const padel = copyPadel(state);
  const isMatchTieBreak = padel.phase === "match_tiebreak";
  const tieBreakScore = {
    ...(padel.tieBreakScore ?? zeroScore()),
    [team]: (padel.tieBreakScore?.[team] ?? 0) + 1,
  };
  const pointsPlayed = tieBreakScore.A + tieBreakScore.B;
  const courtEndsSwapped = courtEndsForTieBreak(padel, pointsPlayed);
  const nextPadel = { ...padel, tieBreakScore, courtEndsSwapped };
  const nextServer = tieBreakServerAt(nextPadel, pointsPlayed);
  const nextState = mirrorPadelState(
    {
      ...state,
      servingTeam: nextServer.team,
      currentServer: nextServer.player,
    },
    nextPadel,
  );
  const target = isMatchTieBreak ? rules.matchTieBreakPoints : 7;
  const winner = winByTwo(tieBreakScore, target);
  if (!winner) return nextState;

  if (isMatchTieBreak) {
    const completed = completeSet(
      nextState,
      nextPadel,
      definition,
      rules,
      winner,
      tieBreakScore,
      nextPadel.tieBreakFirstServer!.team,
      { tieBreakScore, matchTieBreak: true },
    );
    return { ...completed, status: "complete", winner };
  }

  const gamesInSet = {
    ...padel.gamesInSet,
    [winner]: padel.gamesInSet[winner] + 1,
  };
  const totalGames = gamesInSet.A + gamesInSet.B;
  const endsSwapped =
    totalGames % 2 === 1
      ? !nextPadel.courtEndsSwapped
      : nextPadel.courtEndsSwapped;
  return completeSet(
    mirrorPadelState(nextState, { ...nextPadel, gamesInSet }),
    { ...nextPadel, gamesInSet, courtEndsSwapped: endsSwapped },
    definition,
    rules,
    winner,
    gamesInSet,
    otherTeam(nextPadel.tieBreakFirstServer!.team),
    { tieBreakScore, endsSwapped },
  );
}

function roleAtSide(
  roles: PadelLocalRoles | undefined,
  team: TeamId,
  player: PlayerIndex,
) {
  return roles?.[team]?.[player];
}

export function isPadelDecidingPoint(
  definition: MatchDefinition,
  state: MatchState,
): boolean {
  const padel = state.padel;
  if (definition.sport !== "padel" || !padel || padel.phase !== "game")
    return false;
  if (padel.pointScore.A !== 3 || padel.pointScore.B !== 3 || padel.advantage) {
    return false;
  }
  const scoring = padel.gameScoring;
  return (
    scoring === "golden_point" ||
    (scoring === "star_point" && padel.starDeuces >= 2)
  );
}

function defaultDecidingSide(
  definition: MatchDefinition,
  state: MatchState,
): CourtSide {
  if (getMatchFormat(definition) !== "mixed_doubles") return "right";
  const receivingTeam = otherTeam(state.servingTeam);
  const serverRole = roleAtSide(
    definition.padelLocalRoles,
    state.servingTeam,
    state.currentServer,
  );
  if (!serverRole) return "right";
  return (
    sides.find(
      (side) =>
        roleAtSide(
          definition.padelLocalRoles,
          receivingTeam,
          state.positions[receivingTeam][side],
        ) === serverRole,
    ) ?? "right"
  );
}

export function canSelectPadelDecidingSide(
  definition: MatchDefinition,
  state: MatchState,
  side: CourtSide,
): boolean {
  if (!isPadelDecidingPoint(definition, state)) return false;
  if (getMatchFormat(definition) !== "mixed_doubles") return true;
  const receivingTeam = otherTeam(state.servingTeam);
  const receiver = state.positions[receivingTeam][side];
  return (
    roleAtSide(definition.padelLocalRoles, receivingTeam, receiver) ===
    roleAtSide(
      definition.padelLocalRoles,
      state.servingTeam,
      state.currentServer,
    )
  );
}

export function padelReceivingPlayer(
  definition: MatchDefinition,
  state: MatchState,
  side?: CourtSide,
): PlayerIndex | null {
  if (!state.padel) return null;
  const receivingTeam = otherTeam(state.servingTeam);
  if (getMatchFormat(definition) === "singles") return 0;
  const selected = isPadelDecidingPoint(definition, state)
    ? (side ?? state.padel.decidingReceivingSide ?? "right")
    : (side ?? padelServingSide(state));
  return state.positions[receivingTeam][selected];
}

export function padelServingSide(state: MatchState): CourtSide {
  const padel = state.padel;
  if (!padel) return "right";
  if (
    padel.phase === "game" &&
    padel.pointScore.A === 3 &&
    padel.pointScore.B === 3 &&
    padel.advantage === null &&
    (padel.gameScoring === "golden_point" ||
      (padel.gameScoring === "star_point" && padel.starDeuces >= 2))
  ) {
    return padel.decidingReceivingSide ?? "right";
  }
  const nextPoint =
    padel.phase === "game"
      ? padel.gamePointCount
      : (padel.tieBreakScore?.A ?? 0) + (padel.tieBreakScore?.B ?? 0);
  return nextPoint % 2 === 0 ? "right" : "left";
}

function awardGamePoint(
  state: MatchState,
  definition: MatchDefinition,
  rules: PadelRules,
  team: TeamId,
): MatchState {
  if (state.padel!.awaitingSetOrders) return state;
  const padel = copyPadel(state);
  const points = { ...padel.pointScore };
  let advantage = padel.advantage;
  let starDeuces = padel.starDeuces;
  let gameWinner: TeamId | null = null;
  const scoring = rules.gameScoring;
  const atDeuce = points.A === 3 && points.B === 3;

  if (scoring === "golden_point" && atDeuce) {
    gameWinner = team;
  } else if (
    scoring === "star_point" &&
    atDeuce &&
    starDeuces >= 2 &&
    !advantage
  ) {
    gameWinner = team;
  } else if (advantage) {
    if (advantage === team) gameWinner = team;
    else {
      advantage = null;
      if (scoring === "star_point") starDeuces = Math.min(2, starDeuces + 1);
    }
  } else {
    points[team] += 1;
    if (points[team] >= 4 && points[team] - points[otherTeam(team)] >= 2) {
      gameWinner = team;
    } else if (points[team] >= 4) {
      points[team] = 3;
      advantage = team;
    }
  }

  const gamePointCount = padel.gamePointCount + 1;
  const preFinish = {
    ...padel,
    pointScore: points,
    advantage,
    starDeuces,
    gamePointCount,
  };
  if (gameWinner) {
    return finishRegularGame(
      mirrorPadelState(state, preFinish),
      definition,
      rules,
      preFinish,
      gameWinner,
    );
  }
  const updatedState = mirrorPadelState(state, preFinish);
  const decidingReceivingSide = isPadelDecidingPoint(definition, updatedState)
    ? defaultDecidingSide(definition, updatedState)
    : null;
  return mirrorPadelState(state, { ...preFinish, decidingReceivingSide });
}

export function applyPadelPoint(
  state: MatchState,
  team: TeamId,
  definition: MatchDefinition,
): MatchState {
  if (
    definition.sport !== "padel" ||
    !state.padel ||
    state.status === "complete"
  )
    return state;
  if (state.padel.awaitingSetOrders) return state;
  const rules = padelRulesFor(definition);
  return state.padel.phase === "game"
    ? awardGamePoint(state, definition, rules, team)
    : awardTieBreakPoint(state, definition, rules, team);
}

export function applyPadelSetOrdersEvent(
  state: MatchState,
  event: PadelSetOrdersConfirmedEvent,
  definition: MatchDefinition,
): MatchState {
  if (
    definition.sport !== "padel" ||
    !state.padel ||
    !state.padel.awaitingSetOrders ||
    getMatchFormat(definition) === "singles"
  )
    return state;
  validateOrders(definition, event.orders);
  const padel = copyPadel(state);
  const firstServer = nextGameServer(
    padel.setOpeningServer,
    zeroScore(),
    event.orders,
    definition,
  );
  const nextPadel = {
    ...padel,
    setOrders: event.orders,
    serviceTurns: zeroScore(),
    awaitingSetOrders: false,
  };
  return mirrorPadelState(
    {
      ...state,
      positions: positionsFromOrders(definition, event.orders),
      currentServer: firstServer,
    },
    nextPadel,
  );
}

export function applyPadelDecidingSideEvent(
  state: MatchState,
  event: PadelDecidingSideSelectedEvent,
  definition: MatchDefinition,
): MatchState {
  if (
    !state.padel ||
    !canSelectPadelDecidingSide(definition, state, event.side)
  )
    return state;
  return mirrorPadelState(state, {
    ...copyPadel(state),
    decidingReceivingSide: event.side,
  });
}

export function applyPadelScoreOverride(
  state: MatchState,
  event: PadelScoreOverriddenEvent,
  definition: MatchDefinition,
): MatchState {
  if (
    definition.sport !== "padel" ||
    !state.padel ||
    state.status === "complete"
  )
    return state;
  const padel = copyPadel(state);
  if (padel.phase !== "game") {
    if (
      !event.tieBreakScore ||
      !teams.every(
        (team) =>
          Number.isInteger(event.tieBreakScore![team]) &&
          event.tieBreakScore![team] >= 0,
      )
    )
      throw new Error("Tie-break points must be non-negative whole numbers.");
    const tieBreakScore = { ...event.tieBreakScore };
    const pointsPlayed = tieBreakScore.A + tieBreakScore.B;
    const nextPadel = {
      ...padel,
      tieBreakScore,
      courtEndsSwapped: courtEndsForTieBreak(padel, pointsPlayed),
    };
    const server = tieBreakServerAt(nextPadel, pointsPlayed);
    return mirrorPadelState(
      { ...state, servingTeam: server.team, currentServer: server.player },
      nextPadel,
    );
  }

  if (
    !teams.every(
      (team) =>
        Number.isInteger(event.pointScore[team]) &&
        event.pointScore[team] >= 0 &&
        event.pointScore[team] <= 3,
    ) ||
    !Number.isInteger(event.starDeuces) ||
    event.starDeuces < 0 ||
    event.starDeuces > 2 ||
    (event.advantage !== null &&
      event.advantage !== "A" &&
      event.advantage !== "B") ||
    (event.advantage !== null &&
      (event.pointScore.A !== 3 || event.pointScore.B !== 3)) ||
    !Number.isInteger(event.gamePointCount) ||
    event.gamePointCount < 0
  )
    throw new Error("Padel game score is invalid.");
  const rules = padelRulesFor(definition);
  if (rules.gameScoring !== "star_point" && event.starDeuces !== 0) {
    throw new Error(
      "Star-point deuce count is only used for Star Point scoring.",
    );
  }
  if (rules.gameScoring === "golden_point" && event.advantage !== null) {
    throw new Error("Golden Point games cannot have an advantage score.");
  }
  const updated = {
    ...padel,
    pointScore: { ...event.pointScore },
    advantage: event.advantage,
    starDeuces: event.starDeuces,
    gamePointCount: event.gamePointCount,
  };
  const updatedState = mirrorPadelState(state, updated);
  const decidingReceivingSide = isPadelDecidingPoint(definition, updatedState)
    ? (padel.decidingReceivingSide ??
      defaultDecidingSide(definition, updatedState))
    : null;
  return mirrorPadelState(state, { ...updated, decidingReceivingSide });
}

export function padelPointLabel(value: number, locale: "en" | "id"): string {
  return (
    ([locale === "id" ? "Nol" : "Love", "15", "30", "40"] as const)[
      Math.min(value, 3)
    ] ?? "40"
  );
}

export function padelScoreLabel(
  state: MatchState,
  team: TeamId,
  locale: "en" | "id",
): string {
  const padel = state.padel;
  if (!padel) return String(state.points[team]);
  if (padel.phase !== "game") return String(padel.tieBreakScore?.[team] ?? 0);
  if (padel.advantage === team) {
    if (padel.gameScoring === "star_point") {
      return `${locale === "id" ? "Ad" : "Ad"}${padel.starDeuces + 1}`;
    }
    return "Ad";
  }
  if (
    padel.pointScore.A === 3 &&
    padel.pointScore.B === 3 &&
    padel.advantage === null &&
    (padel.gameScoring === "golden_point" ||
      (padel.gameScoring === "star_point" && padel.starDeuces >= 2))
  ) {
    const scoring = padel.gameScoring;
    return scoring === "star_point" ? "Star" : "Golden";
  }
  if (
    padel.gameScoring === "star_point" &&
    padel.pointScore.A === 3 &&
    padel.pointScore.B === 3
  ) {
    return `${locale === "id" ? "Deuce" : "Deuce"} ${padel.starDeuces + 1}`;
  }
  return padelPointLabel(padel.pointScore[team], locale);
}

export function padelStateScore(state: MatchState): Record<TeamId, number> {
  return state.padel?.phase === "game"
    ? { ...state.padel.pointScore }
    : { ...(state.padel?.tieBreakScore ?? zeroScore()) };
}
