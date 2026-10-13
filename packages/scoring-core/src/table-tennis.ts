import { getMatchFormat } from "./types";
import type {
  MatchDefinition,
  MatchState,
  PlayerIndex,
  TableTennisGameOrders,
  TableTennisMatchState,
  TableTennisRules,
  TeamId,
  TeamPosition,
  TableTennisGameOrdersConfirmedEvent,
} from "./types";

export const DEFAULT_TABLE_TENNIS_RULES: TableTennisRules = {
  bestOf: 3,
};

export function tableTennisRulesFor(
  definition: MatchDefinition,
): TableTennisRules {
  return (
    definition.ruleset?.tableTennisConfiguration ?? DEFAULT_TABLE_TENNIS_RULES
  );
}

const otherTeam = (team: TeamId): TeamId => (team === "A" ? "B" : "A");
const otherPlayer = (player: PlayerIndex): PlayerIndex =>
  player === 0 ? 1 : 0;

function playerRef(team: TeamId, player: PlayerIndex) {
  return { team, player };
}

function samePlayer(
  left: { team: TeamId; player: PlayerIndex },
  right: { team: TeamId; player: PlayerIndex },
): boolean {
  return left.team === right.team && left.player === right.player;
}

function validOrders(
  definition: MatchDefinition,
  orders: TableTennisGameOrders,
): boolean {
  const format = getMatchFormat(definition);
  if (orders.firstServer.team === orders.firstReceiver.team) return false;
  if (format === "singles") {
    return orders.firstServer.player === 0 && orders.firstReceiver.player === 0;
  }
  return [orders.firstServer.player, orders.firstReceiver.player].every(
    (player) => player === 0 || player === 1,
  );
}

function ordersFor(definition: MatchDefinition): TableTennisGameOrders {
  const configured = definition.tableTennisOrders;
  if (configured && validOrders(definition, configured)) return configured;

  const firstServer = {
    team: definition.initialServingTeam,
    player:
      getMatchFormat(definition) === "singles"
        ? 0
        : definition.initialServingPlayer,
  } as const;
  return {
    firstServer,
    firstReceiver: {
      team: otherTeam(firstServer.team),
      player: 0,
    },
  };
}

function positionWithMarkedPlayer(player: PlayerIndex): TeamPosition {
  return player === 0 ? { left: 1, right: 0 } : { left: 0, right: 1 };
}

function positionsForOrders(
  definition: MatchDefinition,
  orders: TableTennisGameOrders,
): Record<TeamId, TeamPosition> {
  if (getMatchFormat(definition) === "singles") {
    return {
      A: { left: 0, right: 0 },
      B: { left: 0, right: 0 },
    };
  }

  const positions: Record<TeamId, TeamPosition> = {
    A: { left: 1, right: 0 },
    B: { left: 1, right: 0 },
  };
  positions[orders.firstServer.team] = positionWithMarkedPlayer(
    orders.firstServer.player,
  );
  positions[orders.firstReceiver.team] = positionWithMarkedPlayer(
    orders.firstReceiver.player,
  );
  return positions;
}

export function createTableTennisState(
  definition: MatchDefinition,
): TableTennisMatchState {
  const gameOrders = ordersFor(definition);
  return {
    gameOrders,
    currentReceiver: gameOrders.firstReceiver.player,
    awaitingGameOrders: false,
    courtEndsSwapped: false,
    receivingOrderSwapped: false,
  };
}

export function initializeTableTennisMatchState(
  definition: MatchDefinition,
  state: MatchState,
): MatchState {
  const tableTennis = createTableTennisState(definition);
  return {
    ...state,
    positions: positionsForOrders(definition, tableTennis.gameOrders),
    servingTeam: tableTennis.gameOrders.firstServer.team,
    currentServer: tableTennis.gameOrders.firstServer.player,
    serverNumber: null,
    tableTennis,
  };
}

function serviceCycle(orders: TableTennisGameOrders): Array<{
  server: { team: TeamId; player: PlayerIndex };
  receiver: { team: TeamId; player: PlayerIndex };
}> {
  const serverPartner = playerRef(
    orders.firstServer.team,
    otherPlayer(orders.firstServer.player),
  );
  const receiverPartner = playerRef(
    orders.firstReceiver.team,
    otherPlayer(orders.firstReceiver.player),
  );
  const sequence = [
    playerRef(orders.firstServer.team, orders.firstServer.player),
    playerRef(orders.firstReceiver.team, orders.firstReceiver.player),
    serverPartner,
    receiverPartner,
  ];
  return sequence.map((server, index) => ({
    server,
    receiver: sequence[(index + 1) % sequence.length]!,
  }));
}

function nextServiceState(
  definition: MatchDefinition,
  state: MatchState,
): {
  servingTeam: TeamId;
  currentServer: PlayerIndex;
  currentReceiver: PlayerIndex;
} {
  const tableTennis = state.tableTennis!;
  if (getMatchFormat(definition) === "singles") {
    return {
      servingTeam: otherTeam(state.servingTeam),
      currentServer: 0,
      currentReceiver: 0,
    };
  }

  return {
    servingTeam: otherTeam(state.servingTeam),
    currentServer: tableTennis.currentReceiver,
    currentReceiver: otherPlayer(state.currentServer),
  };
}

function serviceChangesBeforePoint(totalPoints: number): number {
  return totalPoints <= 20 ? Math.floor(totalPoints / 2) : totalPoints - 10;
}

function serviceStateAtScore(
  definition: MatchDefinition,
  state: MatchState,
  points: Record<TeamId, number>,
): {
  servingTeam: TeamId;
  currentServer: PlayerIndex;
  currentReceiver: PlayerIndex;
} {
  const tableTennis = state.tableTennis!;
  const totalPoints = points.A + points.B;
  if (getMatchFormat(definition) === "singles") {
    let servingTeam = tableTennis.gameOrders.firstServer.team;
    const changes = serviceChangesBeforePoint(totalPoints);
    if (changes % 2 === 1) servingTeam = otherTeam(servingTeam);
    return { servingTeam, currentServer: 0, currentReceiver: 0 };
  }

  const cycle = serviceCycle(tableTennis.gameOrders);
  const changes = serviceChangesBeforePoint(totalPoints) % cycle.length;
  const current = cycle[changes]!;
  return {
    servingTeam: current.server.team,
    currentServer: current.server.player,
    currentReceiver: current.receiver.player,
  };
}

function setPositions(
  definition: MatchDefinition,
  state: MatchState,
  servingTeam: TeamId,
  currentServer: PlayerIndex,
  currentReceiver: PlayerIndex,
): Record<TeamId, TeamPosition> {
  if (getMatchFormat(definition) === "singles") {
    return {
      A: { left: 0, right: 0 },
      B: { left: 0, right: 0 },
    };
  }

  const receiverTeam = otherTeam(servingTeam);
  return {
    ...state.positions,
    [servingTeam]: positionWithMarkedPlayer(currentServer),
    [receiverTeam]: positionWithMarkedPlayer(currentReceiver),
  };
}

function hasWonGame(points: Record<TeamId, number>, winner: TeamId): boolean {
  const loser = otherTeam(winner);
  return points[winner] >= 11 && points[winner] - points[loser] >= 2;
}

function isDecidingGame(
  state: MatchState,
  definition: MatchDefinition,
): boolean {
  return state.gameNumber === tableTennisRulesFor(definition).bestOf;
}

function resetForNextGame(
  state: MatchState,
  definition: MatchDefinition,
): MatchState {
  const previousOrders = state.tableTennis!.gameOrders;
  const nextServingTeam = otherTeam(previousOrders.firstServer.team);
  if (getMatchFormat(definition) === "singles") {
    const orders: TableTennisGameOrders = {
      firstServer: { team: nextServingTeam, player: 0 },
      firstReceiver: { team: otherTeam(nextServingTeam), player: 0 },
    };
    return {
      ...state,
      gameNumber: state.gameNumber + 1,
      points: { A: 0, B: 0 },
      servingTeam: nextServingTeam,
      currentServer: 0,
      serverNumber: null,
      positions: positionsForOrders(definition, orders),
      tableTennis: {
        gameOrders: orders,
        currentReceiver: 0,
        awaitingGameOrders: false,
        courtEndsSwapped: false,
        receivingOrderSwapped: false,
      },
    };
  }

  return {
    ...state,
    gameNumber: state.gameNumber + 1,
    points: { A: 0, B: 0 },
    servingTeam: nextServingTeam,
    currentServer: 0,
    serverNumber: null,
    positions: positionsForOrders(definition, previousOrders),
    tableTennis: {
      gameOrders: previousOrders,
      currentReceiver: 0,
      awaitingGameOrders: true,
      courtEndsSwapped: false,
      receivingOrderSwapped: false,
    },
  };
}

function completeGameIfNeeded(
  state: MatchState,
  definition: MatchDefinition,
  winner: TeamId,
): MatchState {
  if (!hasWonGame(state.points, winner)) return state;

  const gamesWon = { ...state.gamesWon, [winner]: state.gamesWon[winner] + 1 };
  const completedGames = [
    ...state.completedGames,
    { winner, score: { ...state.points } },
  ];
  const completedState = { ...state, gamesWon, completedGames };
  if (
    gamesWon[winner] >= Math.ceil(tableTennisRulesFor(definition).bestOf / 2)
  ) {
    return { ...completedState, status: "complete", winner };
  }
  return resetForNextGame(completedState, definition);
}

export function tableTennisReceivingPlayer(
  definition: MatchDefinition,
  state: MatchState,
): PlayerIndex {
  if (getMatchFormat(definition) === "singles") return 0;
  return state.tableTennis?.currentReceiver ?? 0;
}

export function tableTennisFirstReceiverForNextGame(
  state: MatchState,
  firstServer: PlayerIndex,
): PlayerIndex {
  const orders = state.tableTennis!.gameOrders;
  const cycle = serviceCycle(orders);
  const nextServer = playerRef(otherTeam(orders.firstServer.team), firstServer);
  const index = cycle.findIndex((entry) =>
    samePlayer(entry.server, nextServer),
  );
  if (index < 0) return 0;
  return cycle[(index + cycle.length - 1) % cycle.length]!.server.player;
}

export function applyTableTennisPoint(
  state: MatchState,
  team: TeamId,
  definition: MatchDefinition,
): MatchState {
  if (!state.tableTennis || state.tableTennis.awaitingGameOrders) return state;

  const points = { ...state.points, [team]: state.points[team] + 1 };
  const gameWinner = hasWonGame(points, team);
  if (gameWinner) {
    return completeGameIfNeeded({ ...state, points }, definition, team);
  }

  const totalPoints = points.A + points.B;
  const shouldChangeService = totalPoints >= 20 || totalPoints % 2 === 0;
  let next = { ...state, points };
  if (shouldChangeService) {
    const service = nextServiceState(definition, state);
    next = {
      ...next,
      servingTeam: service.servingTeam,
      currentServer: service.currentServer,
      positions: setPositions(
        definition,
        state,
        service.servingTeam,
        service.currentServer,
        service.currentReceiver,
      ),
      tableTennis: {
        ...state.tableTennis,
        currentReceiver: service.currentReceiver,
      },
    };
  }

  if (
    getMatchFormat(definition) === "doubles" &&
    isDecidingGame(state, definition) &&
    !state.tableTennis.receivingOrderSwapped &&
    Math.max(points.A, points.B) >= 5
  ) {
    const swappedReceiver = otherPlayer(next.tableTennis!.currentReceiver);
    next = {
      ...next,
      positions: setPositions(
        definition,
        next,
        next.servingTeam,
        next.currentServer,
        swappedReceiver,
      ),
      tableTennis: {
        ...next.tableTennis!,
        currentReceiver: swappedReceiver,
        receivingOrderSwapped: true,
        courtEndsSwapped: true,
      },
    };
  }

  return next;
}

export function applyTableTennisGameOrdersEvent(
  state: MatchState,
  event: TableTennisGameOrdersConfirmedEvent,
  definition: MatchDefinition,
): MatchState {
  if (
    !state.tableTennis?.awaitingGameOrders ||
    !validOrders(definition, event.orders) ||
    event.orders.firstServer.team !== state.servingTeam
  ) {
    return state;
  }

  const expectedReceiver = tableTennisFirstReceiverForNextGame(
    state,
    event.orders.firstServer.player,
  );
  if (
    getMatchFormat(definition) === "doubles" &&
    event.orders.firstReceiver.player !== expectedReceiver
  ) {
    return state;
  }

  return {
    ...state,
    servingTeam: event.orders.firstServer.team,
    currentServer: event.orders.firstServer.player,
    positions: positionsForOrders(definition, event.orders),
    tableTennis: {
      ...state.tableTennis,
      gameOrders: event.orders,
      currentReceiver: event.orders.firstReceiver.player,
      awaitingGameOrders: false,
    },
  };
}

export function applyTableTennisScoreOverride(
  state: MatchState,
  points: Record<TeamId, number>,
  definition: MatchDefinition,
): MatchState {
  if (!state.tableTennis || state.tableTennis.awaitingGameOrders) return state;
  if (
    !Number.isInteger(points.A) ||
    !Number.isInteger(points.B) ||
    points.A < 0 ||
    points.B < 0
  ) {
    throw new Error("Override scores must be non-negative integers.");
  }

  const service = serviceStateAtScore(definition, state, points);
  let next: MatchState = {
    ...state,
    points: { A: points.A, B: points.B },
    servingTeam: service.servingTeam,
    currentServer: service.currentServer,
    positions: setPositions(
      definition,
      state,
      service.servingTeam,
      service.currentServer,
      service.currentReceiver,
    ),
    tableTennis: {
      ...state.tableTennis,
      currentReceiver: service.currentReceiver,
      courtEndsSwapped:
        getMatchFormat(definition) === "doubles" &&
        isDecidingGame(state, definition) &&
        Math.max(points.A, points.B) >= 5,
      receivingOrderSwapped:
        getMatchFormat(definition) === "doubles" &&
        isDecidingGame(state, definition) &&
        Math.max(points.A, points.B) >= 5,
    },
  };

  if (
    getMatchFormat(definition) === "doubles" &&
    next.tableTennis!.receivingOrderSwapped
  ) {
    const swappedReceiver = otherPlayer(next.tableTennis!.currentReceiver);
    next = {
      ...next,
      positions: setPositions(
        definition,
        next,
        next.servingTeam,
        next.currentServer,
        swappedReceiver,
      ),
      tableTennis: {
        ...next.tableTennis!,
        currentReceiver: swappedReceiver,
      },
    };
  }

  const gameWinner = (Object.keys(points) as TeamId[]).find((team) =>
    hasWonGame(points, team),
  );
  return gameWinner ? completeGameIfNeeded(next, definition, gameWinner) : next;
}
