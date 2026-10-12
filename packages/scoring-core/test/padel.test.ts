import { describe, expect, it } from "vitest";
import {
  awardRally,
  confirmPadelSetOrders,
  DEFAULT_PADEL_RULES,
  deriveJournal,
  officialRulesetFor,
  overridePadelScore,
  padelScoreLabel,
  padelReceivingPlayer,
  redo,
  selectPadelDecidingSide,
  undo,
  type MatchDefinition,
  type MatchJournal,
  type PadelRules,
  type PadelSetOrders,
  type TeamId,
} from "../src/index";

const doublesOrders: PadelSetOrders = {
  serviceOrder: { A: [0, 1], B: [0, 1] },
  deuceReceiver: { A: 0, B: 0 },
};

function makeJournal(
  options: {
    format?: MatchDefinition["format"];
    rules?: Partial<PadelRules>;
    orders?: PadelSetOrders;
    servingTeam?: TeamId;
    servingPlayer?: 0 | 1;
    roles?: MatchDefinition["padelLocalRoles"];
  } = {},
): MatchJournal {
  const format = options.format ?? "singles";
  const rules = { ...DEFAULT_PADEL_RULES, ...options.rules };
  const orders =
    options.orders ??
    (format === "singles"
      ? {
          serviceOrder: { A: [0, 0], B: [0, 0] },
          deuceReceiver: { A: 0, B: 0 },
        }
      : doublesOrders);
  const servingTeam = options.servingTeam ?? "A";
  const servingPlayer =
    options.servingPlayer ?? orders.serviceOrder[servingTeam][0];
  const official = officialRulesetFor("padel", format);
  const definition: MatchDefinition = {
    id: "padel-test",
    sport: "padel",
    format,
    rulesetId: official.id,
    ruleset: {
      id: official.id,
      name: official.name,
      sport: "padel",
      format,
      source: official.source,
      version: official.version,
      configuration: { ...official.configuration },
      padelConfiguration: rules,
    },
    mode: "casual",
    createdAt: "2026-10-12T00:00:00.000Z",
    initialServingTeam: servingTeam,
    initialServingPlayer: servingPlayer,
    padelSetOrders: orders,
    ...(options.roles ? { padelLocalRoles: options.roles } : {}),
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
  const sequence = journal.events.length + 1;
  return awardRally(journal, team, {
    id: `event-${sequence}`,
    createdAt: `2026-10-12T00:00:${String(sequence).padStart(2, "0")}.000Z`,
  });
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

function winGame(journal: MatchJournal, team: TeamId): MatchJournal {
  return points(journal, team, 4);
}

function winGames(
  journal: MatchJournal,
  team: TeamId,
  count: number,
): MatchJournal {
  let next = journal;
  for (let index = 0; index < count; index += 1) next = winGame(next, team);
  return next;
}

function reachAll(journal: MatchJournal, target = 6): MatchJournal {
  let next = journal;
  for (let index = 0; index < target; index += 1) {
    next = winGame(next, "A");
    next = winGame(next, "B");
  }
  return next;
}

function winTieBreak(journal: MatchJournal, target: number): MatchJournal {
  let next = journal;
  for (let index = 0; index < target - 2; index += 1) {
    next = point(next, "A");
    next = point(next, "B");
  }
  next = point(next, "A");
  next = point(next, "A");
  return next;
}

function state(journal: MatchJournal) {
  return deriveJournal(journal).state;
}

describe("FIP Padel scoring", () => {
  it("uses advantage games and returns to deuce after the advantage is lost", () => {
    let journal = makeJournal();
    journal = points(journal, "A", 3);
    journal = points(journal, "B", 3);
    journal = point(journal, "A");
    expect(state(journal).padel?.advantage).toBe("A");
    journal = point(journal, "B");
    expect(state(journal).padel?.advantage).toBeNull();
    journal = points(journal, "B", 2);
    expect(state(journal).padel?.gamesInSet).toEqual({ A: 0, B: 1 });
  });

  it("ends a Star Point game after two advantages and a third deuce", () => {
    let journal = makeJournal({ rules: { gameScoring: "star_point" } });
    journal = points(journal, "A", 3);
    journal = points(journal, "B", 3);
    journal = point(journal, "A");
    journal = point(journal, "B");
    expect(state(journal).padel?.starDeuces).toBe(1);
    journal = point(journal, "B");
    journal = point(journal, "A");
    expect(state(journal).padel?.starDeuces).toBe(2);
    journal = point(journal, "A");
    expect(state(journal).padel?.gamesInSet).toEqual({ A: 1, B: 0 });
  });

  it("awards Golden Point at deuce and enforces same-sex mixed receivers", () => {
    const orders: PadelSetOrders = {
      serviceOrder: { A: [0, 1], B: [0, 1] },
      deuceReceiver: { A: 0, B: 0 },
    };
    const roles = { A: ["woman", "man"], B: ["man", "woman"] } as const;
    let journal = makeJournal({
      format: "mixed_doubles",
      rules: { gameScoring: "golden_point" },
      orders,
      roles,
    });
    journal = points(journal, "A", 3);
    journal = points(journal, "B", 3);
    expect(state(journal).padel?.decidingReceivingSide).toBe("left");
    expect(
      padelReceivingPlayer(journal.definition, state(journal), "left"),
    ).toBe(1);
    journal = selectPadelDecidingSide(journal, "left", {
      id: "choose-left",
      createdAt: "2026-10-12T00:01:00.000Z",
    });
    journal = point(journal, "B");
    expect(state(journal).padel?.gamesInSet).toEqual({ A: 0, B: 1 });
  });

  it("starts a tie-break at 6–6 and awards the set only with a two-point lead", () => {
    let journal = reachAll(makeJournal());
    expect(state(journal).padel?.phase).toBe("tiebreak");
    journal = point(journal, "A");
    for (let index = 0; index < 6; index += 1) journal = point(journal, "B");
    expect(state(journal).padel?.setsWon).toEqual({ A: 0, B: 0 });
    journal = points(journal, "A", 7);
    expect(state(journal).padel?.completedSets[0]).toMatchObject({
      winner: "A",
      score: { A: 7, B: 6 },
      tieBreakScore: { A: 8, B: 6 },
    });
  });

  it("uses a four-game mini-set and ties it at 4–4", () => {
    let journal = makeJournal({ rules: { setScoring: "mini" } });
    journal = reachAll(journal, 4);
    expect(state(journal).padel?.gamesInSet).toEqual({ A: 4, B: 4 });
    expect(state(journal).padel?.phase).toBe("tiebreak");
    journal = winTieBreak(journal, 7);
    expect(state(journal).padel?.setsWon).toEqual({ A: 1, B: 0 });
    expect(state(journal).padel?.completedSets[0]?.score).toEqual({
      A: 5,
      B: 4,
    });
  });

  it("keeps an advantage final set going after 6–6", () => {
    let journal = makeJournal({ rules: { finalSetScoring: "advantage" } });
    journal = winGames(journal, "A", 6);
    expect(state(journal).padel?.setsWon).toEqual({ A: 1, B: 0 });
    journal = winGames(journal, "B", 6);
    expect(state(journal).padel?.setsWon).toEqual({ A: 1, B: 1 });
    journal = reachAll(journal);
    expect(state(journal).padel?.gamesInSet).toEqual({ A: 6, B: 6 });
    expect(state(journal).padel?.phase).toBe("game");
    journal = winGames(journal, "A", 2);
    expect(state(journal).winner).toBe("A");
    expect(state(journal).padel?.completedSets.at(-1)?.score).toEqual({
      A: 8,
      B: 6,
    });
  });

  it.each([7, 10] as const)(
    "uses a %i-point match tie-break to replace the third set",
    (target) => {
      let journal = makeJournal({
        rules: {
          finalSetScoring: "match_tiebreak",
          matchTieBreakPoints: target,
        },
      });
      journal = winGames(journal, "A", 6);
      journal = winGames(journal, "B", 6);
      expect(state(journal).padel?.phase).toBe("match_tiebreak");
      journal = winTieBreak(journal, target);
      expect(state(journal).status).toBe("complete");
      expect(state(journal).winner).toBe("A");
      expect(state(journal).padel?.completedSets.at(-1)).toMatchObject({
        matchTieBreak: true,
        tieBreakScore: { A: target, B: target - 2 },
      });
    },
  );

  it("completes best of three after two sets", () => {
    let journal = makeJournal();
    journal = winGames(journal, "A", 6);
    journal = winGames(journal, "A", 6);
    expect(state(journal).status).toBe("complete");
    expect(state(journal).padel?.setsWon).toEqual({ A: 2, B: 0 });
  });

  it("corrects the active game and tie-break through replayable score events", () => {
    let gameJournal = makeJournal({ rules: { gameScoring: "golden_point" } });
    gameJournal = overridePadelScore(
      gameJournal,
      {
        pointScore: { A: 3, B: 3 },
        advantage: null,
        starDeuces: 0,
        tieBreakScore: null,
        gamePointCount: 6,
      },
      { id: "game-correction", createdAt: "2026-10-12T00:04:00.000Z" },
    );
    expect(padelScoreLabel(state(gameJournal), "A", "en")).toBe("Golden");
    gameJournal = undo(gameJournal, {
      id: "undo-game-correction",
      createdAt: "2026-10-12T00:04:01.000Z",
    });
    expect(state(gameJournal).padel?.pointScore).toEqual({ A: 0, B: 0 });
    gameJournal = redo(gameJournal, {
      id: "redo-game-correction",
      createdAt: "2026-10-12T00:04:02.000Z",
    });
    expect(padelScoreLabel(state(gameJournal), "B", "en")).toBe("Golden");

    let tieBreakJournal = reachAll(makeJournal());
    expect(state(tieBreakJournal).padel?.phase).toBe("tiebreak");
    tieBreakJournal = overridePadelScore(
      tieBreakJournal,
      {
        pointScore: { A: 0, B: 0 },
        advantage: null,
        starDeuces: 0,
        tieBreakScore: { A: 6, B: 5 },
        gamePointCount: 0,
      },
      { id: "tiebreak-correction", createdAt: "2026-10-12T00:04:03.000Z" },
    );
    expect(state(tieBreakJournal).padel?.tieBreakScore).toEqual({ A: 6, B: 5 });
    expect(state(tieBreakJournal).padel?.courtEndsSwapped).toBe(true);
  });

  it("rotates doubles servers and applies new server and receiver orders per set", () => {
    let journal = makeJournal({ format: "doubles" });
    expect(state(journal).currentServer).toBe(0);
    journal = winGames(journal, "A", 1);
    expect(state(journal).servingTeam).toBe("B");
    expect(state(journal).currentServer).toBe(0);
    expect(state(journal).padel?.courtEndsSwapped).toBe(true);
    journal = winGames(journal, "B", 1);
    expect(state(journal).servingTeam).toBe("A");
    expect(state(journal).currentServer).toBe(1);
    expect(state(journal).padel?.courtEndsSwapped).toBe(true);
    journal = winGames(journal, "A", 1);
    expect(state(journal).padel?.courtEndsSwapped).toBe(false);
  });

  it("allows each doubles pair to confirm new service and receiver orders per set", () => {
    let journal = makeJournal({ format: "doubles" });
    journal = winGames(journal, "A", 6);
    const waiting = state(journal);
    expect(waiting.padel?.awaitingSetOrders).toBe(true);
    const nextOrders: PadelSetOrders = {
      serviceOrder: { A: [1, 0], B: [1, 0] },
      deuceReceiver: { A: 1, B: 1 },
    };
    journal = confirmPadelSetOrders(journal, nextOrders, {
      id: "orders-2",
      createdAt: "2026-10-12T00:02:00.000Z",
    });
    expect(state(journal).padel?.awaitingSetOrders).toBe(false);
    expect(state(journal).currentServer).toBe(1);
    expect(state(journal).positions.B).toEqual({ right: 1, left: 0 });
  });

  it("undoes and redoes score and match-order events through the event journal", () => {
    let journal = point(makeJournal(), "A");
    expect(state(journal).padel?.pointScore.A).toBe(1);
    journal = undo(journal, {
      id: "undo",
      createdAt: "2026-10-12T00:03:00.000Z",
    });
    expect(state(journal).padel?.pointScore.A).toBe(0);
    journal = redo(journal, {
      id: "redo",
      createdAt: "2026-10-12T00:03:01.000Z",
    });
    expect(state(journal).padel?.pointScore.A).toBe(1);
  });
});
