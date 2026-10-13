import { describe, expect, it } from "vitest";
import {
  awardRally,
  confirmSquashGameOrders,
  deriveJournal,
  officialRulesetFor,
  overrideState,
  redo,
  selectSquashServiceBox,
  undo,
  type MatchDefinition,
  type MatchFormat,
  type MatchJournal,
  type PlayerIndex,
  type SquashGameOrders,
  type TeamId,
} from "../src";

let eventNumber = 0;
function metadata() {
  eventNumber += 1;
  return {
    id: `squash-event-${eventNumber}`,
    createdAt: `2026-10-13T00:00:${String(eventNumber).padStart(2, "0")}.000Z`,
  };
}

function makeJournal(
  format: MatchFormat = "singles",
  bestOf: 3 | 5 = 5,
  orders?: SquashGameOrders,
): MatchJournal {
  const official = officialRulesetFor("squash", format);
  const definition: MatchDefinition = {
    id: `squash-${format}-${bestOf}`,
    sport: "squash",
    format,
    rulesetId: official.id,
    ruleset: {
      id: official.id,
      name: official.name,
      sport: "squash",
      format,
      source: "official",
      version: official.version,
      configuration: { ...official.configuration, bestOf },
      squashConfiguration: { bestOf },
    },
    mode: "casual",
    createdAt: "2026-10-13T00:00:00.000Z",
    initialServingTeam: "A",
    initialServingPlayer: orders?.serviceOrder.A[0] ?? 0,
    ...(orders ? { squashGameOrders: orders } : {}),
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

const doublesOrders: SquashGameOrders = {
  serviceOrder: { A: [0, 1], B: [0, 1] },
  receiverBySide: {
    A: { left: 1, right: 0 },
    B: { left: 1, right: 0 },
  },
  openingServiceBox: "right",
};

describe("squash singles", () => {
  it("alternates the service box while serving and requires a box after handout", () => {
    let match = point(makeJournal(), "A");
    let state = deriveJournal(match).state;
    expect(state.points).toEqual({ A: 1, B: 0 });
    expect(state.squash?.currentServiceBox).toBe("left");
    match = point(match, "B");
    state = deriveJournal(match).state;
    expect(state.servingTeam).toBe("B");
    expect(state.squash?.currentServiceBox).toBeNull();
    expect(state.squash?.serviceBoxChoiceRequired).toBe(true);
    match = selectSquashServiceBox(match, "right", metadata());
    expect(deriveJournal(match).state.squash?.serviceBoxChoiceRequired).toBe(
      false,
    );
  });

  it("uses PARS 11 with a two-point margin", () => {
    let match = points(makeJournal(), "A", 10);
    match = point(match, "B");
    match = selectSquashServiceBox(match, "right", metadata());
    match = points(match, "B", 9);
    expect(deriveJournal(match).state.status).toBe("active");
    match = point(match, "A");
    match = selectSquashServiceBox(match, "left", metadata());
    expect(deriveJournal(match).state.status).toBe("active");
    match = point(match, "A");
    match = selectSquashServiceBox(match, "right", metadata());
    match = point(match, "A");
    expect(deriveJournal(match).state.gamesWon).toEqual({ A: 1, B: 0 });
  });

  it("lets the previous game winner serve next and completes best-of-three", () => {
    let match = points(makeJournal("singles", 3), "A", 11);
    let state = deriveJournal(match).state;
    expect(state.servingTeam).toBe("A");
    expect(state.squash?.serviceBoxChoiceRequired).toBe(true);
    match = selectSquashServiceBox(match, "left", metadata());
    match = point(match, "B");
    match = selectSquashServiceBox(match, "right", metadata());
    match = points(match, "B", 10);
    expect(deriveJournal(match).state.gamesWon).toEqual({ A: 1, B: 1 });
    match = selectSquashServiceBox(match, "right", metadata());
    match = point(match, "A");
    match = selectSquashServiceBox(match, "left", metadata());
    match = points(match, "A", 10);
    state = deriveJournal(match).state;
    expect(state.status).toBe("complete");
    expect(state.winner).toBe("A");
    expect(state.gamesWon).toEqual({ A: 2, B: 1 });
  });

  it("supports score correction, undo, and redo", () => {
    let match = overrideState(makeJournal(), { A: 9, B: 8 }, metadata());
    expect(deriveJournal(match).state.points).toEqual({ A: 9, B: 8 });
    match = point(match, "A");
    const undone = undo(match, metadata());
    expect(deriveJournal(undone).state.points).toEqual({ A: 9, B: 8 });
    const redone = redo(undone, metadata());
    expect(deriveJournal(redone).state.points).toEqual({ A: 10, B: 8 });
  });
});

describe("squash doubles", () => {
  it("follows the fixed A1, B1, A2, B2 service sequence", () => {
    let match = makeJournal("doubles", 5, doublesOrders);
    match = point(match, "B");
    let state = deriveJournal(match).state;
    expect(state.servingTeam).toBe("B");
    expect(state.currentServer).toBe(0);
    expect(state.squash?.serviceBoxChoiceRequired).toBe(true);
    match = selectSquashServiceBox(match, "left", metadata());
    match = point(match, "A");
    state = deriveJournal(match).state;
    expect(state.servingTeam).toBe("A");
    expect(state.currentServer).toBe(1);
    match = selectSquashServiceBox(match, "right", metadata());
    match = point(match, "B");
    state = deriveJournal(match).state;
    expect(state.servingTeam).toBe("B");
    expect(state.currentServer).toBe(1);
  });

  it("ends at 11-10 and asks for receiver mapping before the next game", () => {
    let match = points(makeJournal("doubles", 3, doublesOrders), "A", 11);
    let state = deriveJournal(match).state;
    expect(state.gamesWon).toEqual({ A: 1, B: 0 });
    expect(state.squash?.awaitingGameOrders).toBe(true);
    const nextOrders: SquashGameOrders = {
      ...doublesOrders,
      receiverBySide: {
        A: { left: 0, right: 1 },
        B: { left: 0, right: 1 },
      },
      openingServiceBox: "left",
    };
    match = confirmSquashGameOrders(match, nextOrders, metadata());
    state = deriveJournal(match).state;
    expect(state.squash?.awaitingGameOrders).toBe(false);
    expect(state.servingTeam).toBe("A");
    expect(state.squash?.gameOrders.receiverBySide.A.left).toBe(0);
    match = points(match, "B", 10);
    expect(deriveJournal(match).state.status).toBe("active");
  });

  it("completes best-of-five after three game wins", () => {
    let match = makeJournal("doubles", 5, doublesOrders);
    for (let game = 0; game < 3; game += 1) {
      match = points(match, "A", 11);
      if (game < 2) {
        const state = deriveJournal(match).state;
        match = confirmSquashGameOrders(
          match,
          state.squash!.gameOrders,
          metadata(),
        );
      }
    }
    expect(deriveJournal(match).state.status).toBe("complete");
    expect(deriveJournal(match).state.winner).toBe("A");
  });
});
