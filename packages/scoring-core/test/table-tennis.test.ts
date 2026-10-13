import { describe, expect, it } from "vitest";
import {
  awardRally,
  confirmTableTennisGameOrders,
  deriveJournal,
  officialRulesetFor,
  overrideState,
  redo,
  undo,
  type MatchDefinition,
  type MatchFormat,
  type MatchJournal,
  type TableTennisGameOrders,
  type TeamId,
} from "../src";

function makeJournal(
  format: MatchFormat = "singles",
  bestOf: 3 | 5 = 3,
  orders?: TableTennisGameOrders,
): MatchJournal {
  const official = officialRulesetFor("table_tennis", format);
  const definition: MatchDefinition = {
    id: `table-tennis-${format}-${bestOf}`,
    sport: "table_tennis",
    format,
    rulesetId: official.id,
    ruleset: {
      id: official.id,
      name: official.name,
      sport: "table_tennis",
      format,
      source: "official",
      version: official.version,
      configuration: { ...official.configuration, bestOf },
      tableTennisConfiguration: { bestOf },
    },
    mode: "casual",
    createdAt: "2026-10-13T00:00:00.000Z",
    initialServingTeam: orders?.firstServer.team ?? "A",
    initialServingPlayer: orders?.firstServer.player ?? 0,
    ...(orders ? { tableTennisOrders: orders } : {}),
    teams: {
      A: {
        name: "Team A",
        players:
          format === "singles"
            ? [{ id: "a1", name: "A1" }]
            : [
                { id: "a1", name: "A1" },
                { id: "a2", name: "A2" },
              ],
      },
      B: {
        name: "Team B",
        players:
          format === "singles"
            ? [{ id: "b1", name: "B1" }]
            : [
                { id: "b1", name: "B1" },
                { id: "b2", name: "B2" },
              ],
      },
    },
  };
  return { definition, events: [] };
}

let eventNumber = 0;
function metadata() {
  eventNumber += 1;
  return {
    id: `table-tennis-event-${eventNumber}`,
    createdAt: `2026-10-13T00:00:${String(eventNumber).padStart(2, "0")}.000Z`,
  };
}

function point(journal: MatchJournal, team: TeamId): MatchJournal {
  return awardRally(journal, team, metadata());
}

function points(
  journal: MatchJournal,
  team: TeamId,
  count: number,
): MatchJournal {
  let next = journal;
  for (let index = 0; index < count; index += 1) next = point(next, team);
  return next;
}

describe("table tennis singles", () => {
  it("changes service every two points and every point at 10-all", () => {
    let match = makeJournal("singles");
    match = points(match, "A", 2);
    expect(deriveJournal(match).state.servingTeam).toBe("B");
    for (let index = 0; index < 8; index += 1) {
      match = point(match, "B");
      match = point(match, "A");
    }
    match = points(match, "B", 2);
    expect(deriveJournal(match).state.points).toEqual({ A: 10, B: 10 });
    expect(deriveJournal(match).state.servingTeam).toBe("A");
    match = point(match, "A");
    expect(deriveJournal(match).state.servingTeam).toBe("B");
  });

  it("requires two points and completes best-of-three after two games", () => {
    let match = points(makeJournal("singles"), "A", 11);
    expect(deriveJournal(match).state.gameNumber).toBe(2);
    expect(deriveJournal(match).state.gamesWon).toEqual({ A: 1, B: 0 });
    match = points(match, "B", 11);
    expect(deriveJournal(match).state.gameNumber).toBe(3);
    match = points(match, "A", 11);
    const state = deriveJournal(match).state;
    expect(state.status).toBe("complete");
    expect(state.winner).toBe("A");
    expect(state.gamesWon).toEqual({ A: 2, B: 1 });
  });

  it("starts the next game with the other player serving", () => {
    const match = points(makeJournal("singles"), "A", 11);
    const state = deriveJournal(match).state;
    expect(state.servingTeam).toBe("B");
    expect(state.currentServer).toBe(0);
    expect(state.tableTennis?.awaitingGameOrders).toBe(false);
  });

  it("completes a best-of-five match after three game wins", () => {
    let match = points(makeJournal("singles", 5), "A", 11);
    match = points(match, "B", 11);
    match = points(match, "A", 11);
    match = points(match, "B", 11);
    match = points(match, "A", 11);
    const state = deriveJournal(match).state;
    expect(state.status).toBe("complete");
    expect(state.gamesWon).toEqual({ A: 3, B: 2 });
  });

  it("supports undo and redo for a table tennis point", () => {
    let match = point(makeJournal("singles"), "A");
    const undone = undo(match, metadata());
    expect(deriveJournal(undone).state.points).toEqual({ A: 0, B: 0 });
    match = redo(undone, metadata());
    expect(deriveJournal(match).state.points).toEqual({ A: 1, B: 0 });
  });
});

describe("table tennis doubles", () => {
  const orders: TableTennisGameOrders = {
    firstServer: { team: "A", player: 0 },
    firstReceiver: { team: "B", player: 0 },
  };

  it("rotates previous receiver into server and server partner into receiver", () => {
    let match = makeJournal("doubles", 3, orders);
    match = points(match, "A", 2);
    let state = deriveJournal(match).state;
    expect(state.servingTeam).toBe("B");
    expect(state.currentServer).toBe(0);
    expect(state.tableTennis?.currentReceiver).toBe(1);
    match = points(match, "B", 2);
    state = deriveJournal(match).state;
    expect(state.servingTeam).toBe("A");
    expect(state.currentServer).toBe(1);
    expect(state.tableTennis?.currentReceiver).toBe(1);
  });

  it("requires the next game's receiver order and swaps it at five in the deciding game", () => {
    let match = makeJournal("doubles", 3, orders);
    match = points(match, "A", 11);
    let state = deriveJournal(match).state;
    expect(state.gameNumber).toBe(2);
    expect(state.tableTennis?.awaitingGameOrders).toBe(true);
    match = confirmTableTennisGameOrders(
      match,
      {
        firstServer: { team: "B", player: 0 },
        firstReceiver: { team: "A", player: 0 },
      },
      metadata(),
    );
    state = deriveJournal(match).state;
    expect(state.tableTennis?.awaitingGameOrders).toBe(false);
    expect(state.servingTeam).toBe("B");
    match = points(match, "B", 11);
    match = confirmTableTennisGameOrders(
      match,
      {
        firstServer: { team: "A", player: 0 },
        firstReceiver: { team: "B", player: 0 },
      },
      metadata(),
    );
    match = points(match, "A", 5);
    state = deriveJournal(match).state;
    expect(state.gameNumber).toBe(3);
    expect(state.tableTennis?.courtEndsSwapped).toBe(true);
    expect(state.tableTennis?.receivingOrderSwapped).toBe(true);
  });

  it("rebuilds service state from a score override", () => {
    const match = overrideState(
      makeJournal("doubles", 3, orders),
      { A: 10, B: 10 },
      metadata(),
    );
    const state = deriveJournal(match).state;
    expect(state.points).toEqual({ A: 10, B: 10 });
    expect(state.servingTeam).toBe("A");
    expect(state.tableTennis?.currentReceiver).toBe(1);
  });
});
