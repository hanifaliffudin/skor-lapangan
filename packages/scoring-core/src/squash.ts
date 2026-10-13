import { getMatchFormat } from "./types";
import type {
  CourtSide,
  MatchDefinition,
  MatchState,
  PlayerIndex,
  SquashGameOrders,
  SquashGameOrdersConfirmedEvent,
  SquashMatchState,
  SquashRules,
  SquashServiceBoxSelectedEvent,
  TeamId,
  TeamPosition,
} from "./types";

const teams = ["A", "B"] as const;
const sides = ["left", "right"] as const;
const otherTeam = (team: TeamId): TeamId => (team === "A" ? "B" : "A");
const otherSide = (side: CourtSide): CourtSide =>
  side === "left" ? "right" : "left";

export const DEFAULT_SQUASH_RULES: SquashRules = { bestOf: 5 };

export function squashRulesFor(definition: MatchDefinition): SquashRules {
  return definition.ruleset?.squashConfiguration ?? DEFAULT_SQUASH_RULES;
}

function isDoubles(definition: MatchDefinition): boolean {
  return getMatchFormat(definition) === "doubles";
}

function defaultServiceOrder(
  definition: MatchDefinition,
): Record<TeamId, readonly [PlayerIndex, PlayerIndex]> {
  const first = definition.initialServingPlayer;
  return {
    A: isDoubles(definition)
      ? definition.initialServingTeam === "A"
        ? [first, first === 0 ? 1 : 0]
        : [0, 1]
      : [0, 0],
    B: isDoubles(definition)
      ? definition.initialServingTeam === "B"
        ? [first, first === 0 ? 1 : 0]
        : [0, 1]
      : [0, 0],
  };
}

function defaultReceiverBySide(
  definition: MatchDefinition,
): Record<TeamId, { left: PlayerIndex; right: PlayerIndex }> {
  return isDoubles(definition)
    ? {
        A: { left: 1, right: 0 },
        B: { left: 1, right: 0 },
      }
    : {
        A: { left: 0, right: 0 },
        B: { left: 0, right: 0 },
      };
}

export function squashOrdersFor(definition: MatchDefinition): SquashGameOrders {
  if (definition.squashGameOrders) return definition.squashGameOrders;
  return {
    serviceOrder: defaultServiceOrder(definition),
    receiverBySide: defaultReceiverBySide(definition),
    openingServiceBox: "right",
  };
}

function positionsFromOrders(
  definition: MatchDefinition,
  orders: SquashGameOrders,
): Record<TeamId, TeamPosition> {
  if (!isDoubles(definition)) {
    return {
      A: { left: 0, right: 0 },
      B: { left: 0, right: 0 },
    };
  }

  return {
    A: { ...orders.receiverBySide.A },
    B: { ...orders.receiverBySide.B },
  };
}

function validPlayer(player: PlayerIndex): boolean {
  return player === 0 || player === 1;
}

export function validateSquashOrders(
  definition: MatchDefinition,
  orders: SquashGameOrders,
): void {
  if (!orders || !sides.includes(orders.openingServiceBox)) {
    throw new Error("Squash service orders are invalid.");
  }

  for (const team of teams) {
    const serviceOrder = orders.serviceOrder[team];
    const receiverBySide = orders.receiverBySide[team];
    if (
      !serviceOrder ||
      serviceOrder.length !== 2 ||
      !validPlayer(serviceOrder[0]) ||
      !validPlayer(serviceOrder[1]) ||
      !receiverBySide ||
      !validPlayer(receiverBySide.left) ||
      !validPlayer(receiverBySide.right)
    ) {
      throw new Error("Squash service and receiving orders are invalid.");
    }

    if (!isDoubles(definition)) {
      if (
        serviceOrder[0] !== 0 ||
        serviceOrder[1] !== 0 ||
        receiverBySide.left !== 0 ||
        receiverBySide.right !== 0
      ) {
        throw new Error("Squash singles orders may only contain player zero.");
      }
    } else if (
      serviceOrder[0] === serviceOrder[1] ||
      receiverBySide.left === receiverBySide.right
    ) {
      throw new Error(
        "Each Squash doubles team needs two server and receiver players.",
      );
    }
  }
}

export function createSquashState(
  definition: MatchDefinition,
): SquashMatchState {
  const orders = squashOrdersFor(definition);
  validateSquashOrders(definition, orders);
  return {
    gameOrders: orders,
    currentServiceBox: orders.openingServiceBox,
    serviceBoxChoiceRequired: false,
    awaitingGameOrders: false,
    serviceRotationStartTeam: definition.initialServingTeam,
    serviceRotationIndex: 0,
  };
}

export function initializeSquashMatchState(
  definition: MatchDefinition,
  state: MatchState,
): MatchState {
  const squash = createSquashState(definition);
  const initialServer =
    squash.gameOrders.serviceOrder[definition.initialServingTeam][0];
  return {
    ...state,
    format: getMatchFormat(definition),
    servingTeam: definition.initialServingTeam,
    currentServer: initialServer,
    serverNumber: isDoubles(definition) ? 1 : null,
    positions: positionsFromOrders(definition, squash.gameOrders),
    squash,
  };
}

function hasSquash(state: MatchState): asserts state is MatchState & {
  squash: NonNullable<MatchState["squash"]>;
} {
  if (!state.squash) throw new Error("Squash match state is missing.");
}

function copySquash(state: MatchState): SquashMatchState {
  hasSquash(state);
  return {
    ...state.squash,
    gameOrders: {
      serviceOrder: {
        A: [...state.squash.gameOrders.serviceOrder.A] as [
          PlayerIndex,
          PlayerIndex,
        ],
        B: [...state.squash.gameOrders.serviceOrder.B] as [
          PlayerIndex,
          PlayerIndex,
        ],
      },
      receiverBySide: {
        A: { ...state.squash.gameOrders.receiverBySide.A },
        B: { ...state.squash.gameOrders.receiverBySide.B },
      },
      openingServiceBox: state.squash.gameOrders.openingServiceBox,
    },
  };
}

function serviceTeamAt(squash: SquashMatchState, index: number): TeamId {
  return index % 2 === 0
    ? squash.serviceRotationStartTeam
    : otherTeam(squash.serviceRotationStartTeam);
}

function servicePlayerIndexAt(index: number): 0 | 1 {
  return index < 2 ? 0 : 1;
}

function gameWinner(
  definition: MatchDefinition,
  points: Record<TeamId, number>,
): TeamId | null {
  const winBy = isDoubles(definition) ? 1 : 2;
  for (const team of teams) {
    const opponent = otherTeam(team);
    if (points[team] >= 11 && points[team] - points[opponent] >= winBy) {
      return team;
    }
  }
  return null;
}

function resetForNextGame(
  state: MatchState,
  definition: MatchDefinition,
  winner: TeamId,
): MatchState {
  const squash = copySquash(state);
  const doubles = isDoubles(definition);
  squash.serviceRotationStartTeam = winner;
  squash.serviceRotationIndex = 0;
  squash.currentServiceBox = null;
  squash.serviceBoxChoiceRequired = true;
  squash.awaitingGameOrders = doubles;

  const next: MatchState = {
    ...state,
    gameNumber: state.gameNumber + 1,
    points: { A: 0, B: 0 },
    servingTeam: winner,
    currentServer: squash.gameOrders.serviceOrder[winner][0],
    serverNumber: doubles ? 1 : null,
    positions: positionsFromOrders(definition, squash.gameOrders),
    squash,
  };
  return next;
}

function completeGameIfNeeded(
  state: MatchState,
  definition: MatchDefinition,
  winner: TeamId,
): MatchState {
  const gamesWon = { ...state.gamesWon, [winner]: state.gamesWon[winner] + 1 };
  const completedGames = [
    ...state.completedGames,
    { winner, score: { A: state.points.A, B: state.points.B } },
  ];
  const completed = { ...state, gamesWon, completedGames };
  if (gamesWon[winner] >= Math.ceil(squashRulesFor(definition).bestOf / 2)) {
    return { ...completed, status: "complete", winner };
  }
  return resetForNextGame(completed, definition, winner);
}

function applySquashPointInternal(
  state: MatchState,
  team: TeamId,
  definition: MatchDefinition,
): MatchState {
  hasSquash(state);
  if (
    state.squash.awaitingGameOrders ||
    state.squash.serviceBoxChoiceRequired
  ) {
    return state;
  }

  const points = { ...state.points, [team]: state.points[team] + 1 };
  const squash = copySquash(state);
  let next: MatchState = { ...state, points, squash };

  if (team === state.servingTeam) {
    squash.currentServiceBox = otherSide(
      state.squash.currentServiceBox ?? "right",
    );
  } else if (isDoubles(definition)) {
    squash.serviceRotationIndex = ((state.squash.serviceRotationIndex + 1) %
      4) as 0 | 1 | 2 | 3;
    const servingTeam = serviceTeamAt(squash, squash.serviceRotationIndex);
    const servicePlayerIndex = servicePlayerIndexAt(
      squash.serviceRotationIndex,
    );
    next = {
      ...next,
      servingTeam,
      currentServer:
        squash.gameOrders.serviceOrder[servingTeam][servicePlayerIndex],
      serverNumber: (servicePlayerIndex + 1) as 1 | 2,
    };
    squash.currentServiceBox = null;
    squash.serviceBoxChoiceRequired = true;
  } else {
    next = {
      ...next,
      servingTeam: team,
      currentServer: 0,
      serverNumber: null,
    };
    squash.currentServiceBox = null;
    squash.serviceBoxChoiceRequired = true;
  }

  const winner = gameWinner(definition, points);
  return winner ? completeGameIfNeeded(next, definition, winner) : next;
}

export function applySquashPoint(
  state: MatchState,
  team: TeamId,
  definition: MatchDefinition,
): MatchState {
  return applySquashPointInternal(state, team, definition);
}

export function applySquashGameOrdersEvent(
  state: MatchState,
  event: SquashGameOrdersConfirmedEvent,
  definition: MatchDefinition,
): MatchState {
  hasSquash(state);
  if (!state.squash.awaitingGameOrders) return state;
  validateSquashOrders(definition, event.orders);
  const currentOrders = state.squash.gameOrders;
  if (
    event.orders.serviceOrder.A[0] !== currentOrders.serviceOrder.A[0] ||
    event.orders.serviceOrder.A[1] !== currentOrders.serviceOrder.A[1] ||
    event.orders.serviceOrder.B[0] !== currentOrders.serviceOrder.B[0] ||
    event.orders.serviceOrder.B[1] !== currentOrders.serviceOrder.B[1]
  ) {
    throw new Error("Squash server order cannot change during a match.");
  }

  const squash = copySquash(state);
  squash.gameOrders = event.orders;
  squash.currentServiceBox = event.orders.openingServiceBox;
  squash.serviceBoxChoiceRequired = false;
  squash.awaitingGameOrders = false;
  squash.serviceRotationStartTeam = state.servingTeam;
  squash.serviceRotationIndex = 0;
  return {
    ...state,
    currentServer: event.orders.serviceOrder[state.servingTeam][0],
    serverNumber: isDoubles(definition) ? 1 : null,
    positions: positionsFromOrders(definition, event.orders),
    squash,
  };
}

export function applySquashServiceBoxEvent(
  state: MatchState,
  event: SquashServiceBoxSelectedEvent,
): MatchState {
  hasSquash(state);
  if (!state.squash.serviceBoxChoiceRequired) return state;
  const squash = copySquash(state);
  squash.currentServiceBox = event.side;
  squash.gameOrders.openingServiceBox = event.side;
  squash.serviceBoxChoiceRequired = false;
  return { ...state, squash };
}

export function applySquashScoreOverride(
  state: MatchState,
  points: Record<TeamId, number>,
  definition: MatchDefinition,
): MatchState {
  hasSquash(state);
  for (const point of [points.A, points.B]) {
    if (!Number.isInteger(point) || point < 0) {
      throw new Error("Override scores must be non-negative integers.");
    }
  }
  const next = { ...state, points: { A: points.A, B: points.B } };
  const winner = gameWinner(definition, next.points);
  return winner ? completeGameIfNeeded(next, definition, winner) : next;
}

export function squashReceivingPlayer(
  definition: MatchDefinition,
  state: MatchState,
): PlayerIndex | null {
  if (!state.squash) return null;
  if (!isDoubles(definition)) return 0;
  const receivingTeam = otherTeam(state.servingTeam);
  const side = state.squash.currentServiceBox ?? "right";
  return state.squash.gameOrders.receiverBySide[receivingTeam][side];
}

export function squashServingSide(state: MatchState): CourtSide {
  return state.squash?.currentServiceBox ?? "right";
}
