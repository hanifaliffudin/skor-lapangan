import { describe, expect, it } from "vitest";
import {
  awardRally,
  confirmTennisSetOrders,
  DEFAULT_TENNIS_RULES,
  deriveJournal,
  officialRulesetFor,
  redo,
  selectTennisDecidingSide,
  overrideTennisScore,
  tennisReceivingPlayer,
  undo,
  type MatchDefinition,
  type MatchJournal,
  type TeamId,
  type TennisRules,
  type TennisSetOrders,
} from "../src/index";

const defaultOrders: TennisSetOrders = {
  serviceOrder: { A: [0, 1], B: [0, 1] },
  deuceReceiver: { A: 0, B: 0 },
};

function makeJournal(
  options: {
    format?: MatchDefinition["format"];
    rules?: Partial<TennisRules>;
    orders?: TennisSetOrders;
    servingTeam?: TeamId;
    servingPlayer?: 0 | 1;
    roles?: MatchDefinition["tennisLocalRoles"];
  } = {},
): MatchJournal {
  const format = options.format ?? "singles";
  const rules = {
    ...DEFAULT_TENNIS_RULES,
    ...options.rules,
  };
  const orders =
    options.orders ??
    (format === "singles"
      ? {
          serviceOrder: { A: [0, 0], B: [0, 0] },
          deuceReceiver: { A: 0, B: 0 },
        }
      : defaultOrders);
  const servingTeam = options.servingTeam ?? "A";
  const servingPlayer =
    options.servingPlayer ?? orders.serviceOrder[servingTeam][0];
  const official = officialRulesetFor("tennis");
  const definition: MatchDefinition = {
    id: crypto.randomUUID(),
    sport: "tennis",
    format,
    rulesetId: official.id,
    ruleset: {
      id: official.id,
      name: official.name,
      sport: "tennis",
      format,
      source: "official",
      version: official.version,
      tennisConfiguration: rules,
    },
    mode: "casual",
    createdAt: "2026-10-12T00:00:00.000Z",
    initialServingTeam: servingTeam,
    initialServingPlayer: servingPlayer,
    tennisSetOrders: orders,
    ...(options.roles ? { tennisLocalRoles: options.roles } : {}),
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
  for (let i = 0; i < count; i += 1) next = point(next, team);
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
  for (let i = 0; i < count; i += 1) next = winGame(next, team);
  return next;
}

function reachSixAll(journal: MatchJournal): MatchJournal {
  let next = journal;
  for (let i = 0; i < 6; i += 1) {
    next = winGame(next, "A");
    next = winGame(next, "B");
  }
  return next;
}

function winTieBreakByTwo(
  journal: MatchJournal,
  target: number,
  trailing: number,
): MatchJournal {
  let next = journal;
  for (let i = 0; i < trailing; i += 1) {
    next = point(next, "A");
    next = point(next, "B");
  }
  return points(next, "A", target - trailing);
}

function state(journal: MatchJournal) {
  return deriveJournal(journal).state;
}

describe("Tennis ITF scoring", () => {
  it("scores advantage games through deuce, advantage, and return to deuce", () => {
    let journal = makeJournal();
    journal = points(journal, "A", 3);
    journal = points(journal, "B", 3);
    expect(state(journal).tennis?.pointScore).toEqual({ A: 3, B: 3 });
    expect(state(journal).tennis?.advantage).toBeNull();
    journal = point(journal, "A");
    expect(state(journal).tennis?.advantage).toBe("A");
    journal = point(journal, "B");
    expect(state(journal).tennis?.advantage).toBeNull();
    journal = point(journal, "B");
    expect(state(journal).tennis?.advantage).toBe("B");
    journal = point(journal, "B");
    expect(state(journal).tennis?.gamesInSet).toEqual({ A: 0, B: 1 });
  });

  it("awards a no-ad deciding point as the game", () => {
    let journal = makeJournal({ rules: { gameScoring: "no_ad" } });
    journal = points(journal, "A", 3);
    journal = points(journal, "B", 3);
    expect(state(journal).tennis?.noAdReceivingSide).toBe("right");
    journal = point(journal, "B");
    expect(state(journal).tennis?.gamesInSet).toEqual({ A: 0, B: 1 });
    expect(state(journal).tennis?.pointScore).toEqual({ A: 0, B: 0 });
  });

  it("starts a seven-point tie-break at 6–6 and completes the set by two", () => {
    let journal = makeJournal();
    journal = reachSixAll(journal);
    expect(state(journal).tennis?.phase).toBe("tiebreak");
    journal = winTieBreakByTwo(journal, 7, 5);
    expect(state(journal).tennis?.setsWon).toEqual({ A: 1, B: 0 });
    expect(state(journal).tennis?.completedSets[0]).toMatchObject({
      winner: "A",
      score: { A: 7, B: 6 },
      tieBreakScore: { A: 7, B: 5 },
    });
  });

  it("rotates singles tie-break service after one point, then two-point turns", () => {
    let journal = reachSixAll(makeJournal());
    expect(state(journal).servingTeam).toBe("A");
    expect(state(journal).currentServer).toBe(0);
    journal = point(journal, "A");
    expect(state(journal).servingTeam).toBe("B");
    expect(state(journal).currentServer).toBe(0);
    journal = point(journal, "B");
    expect(state(journal).servingTeam).toBe("B");
    journal = point(journal, "A");
    expect(state(journal).servingTeam).toBe("A");
  });

  it("keeps an advantage set going after 6–6 until the two-game margin", () => {
    let journal = makeJournal({ rules: { setScoring: "advantage" } });
    journal = reachSixAll(journal);
    expect(state(journal).tennis?.phase).toBe("game");
    journal = winGame(journal, "A");
    expect(state(journal).tennis?.setsWon).toEqual({ A: 0, B: 0 });
    journal = winGame(journal, "A");
    expect(state(journal).tennis?.setsWon).toEqual({ A: 1, B: 0 });
    expect(state(journal).tennis?.completedSets[0]?.score).toEqual({
      A: 8,
      B: 6,
    });
  });

  it.each([7, 10] as const)(
    "plays a %i-point match tie-break to two",
    (target) => {
      let journal = makeJournal({
        rules: {
          finalSetScoring: "match_tiebreak",
          matchTieBreakPoints: target,
        },
      });
      journal = winGames(journal, "A", 6);
      journal = winGames(journal, "B", 6);
      expect(state(journal).tennis?.phase).toBe("match_tiebreak");
      expect(state(journal).tennis?.setNumber).toBe(3);
      journal = winTieBreakByTwo(journal, target, target - 2);
      expect(state(journal).status).toBe("complete");
      expect(state(journal).winner).toBe("A");
      expect(state(journal).tennis?.completedSets.at(-1)).toMatchObject({
        matchTieBreak: true,
        tieBreakScore: { A: target, B: target - 2 },
      });
    },
  );

  it("completes best-of-five matches after three sets", () => {
    let journal = makeJournal({ rules: { bestOf: 5 } });
    journal = winGames(journal, "A", 6);
    journal = winGames(journal, "A", 6);
    journal = winGames(journal, "A", 6);
    expect(state(journal).status).toBe("complete");
    expect(state(journal).tennis?.setsWon).toEqual({ A: 3, B: 0 });
  });
});

describe("Tennis doubles order and court state", () => {
  it("rotates the first server within both pairs and uses each deuce receiver", () => {
    const orders: TennisSetOrders = {
      serviceOrder: { A: [1, 0], B: [0, 1] },
      deuceReceiver: { A: 0, B: 1 },
    };
    let journal = makeJournal({
      format: "doubles",
      orders,
      servingTeam: "A",
      servingPlayer: 1,
    });
    expect(state(journal).currentServer).toBe(1);
    expect(tennisReceivingPlayer(journal.definition, state(journal))).toBe(1);
    journal = winGame(journal, "A");
    expect(state(journal).servingTeam).toBe("B");
    expect(state(journal).currentServer).toBe(0);
    expect(tennisReceivingPlayer(journal.definition, state(journal))).toBe(0);
    journal = winGame(journal, "B");
    expect(state(journal).servingTeam).toBe("A");
    expect(state(journal).currentServer).toBe(0);
  });

  it("rotates doubles tie-break service in one-point and two-point turns", () => {
    const orders: TennisSetOrders = {
      serviceOrder: { A: [0, 1], B: [1, 0] },
      deuceReceiver: { A: 0, B: 0 },
    };
    let journal = reachSixAll(
      makeJournal({
        format: "doubles",
        orders,
        servingTeam: "A",
        servingPlayer: 0,
      }),
    );
    expect(state(journal).servingTeam).toBe("A");
    expect(state(journal).currentServer).toBe(0);
    journal = point(journal, "A");
    expect([state(journal).servingTeam, state(journal).currentServer]).toEqual([
      "B",
      1,
    ]);
    journal = point(journal, "B");
    expect([state(journal).servingTeam, state(journal).currentServer]).toEqual([
      "B",
      1,
    ]);
    journal = point(journal, "A");
    expect([state(journal).servingTeam, state(journal).currentServer]).toEqual([
      "A",
      1,
    ]);
    journal = points(journal, "A", 2);
    expect([state(journal).servingTeam, state(journal).currentServer]).toEqual([
      "B",
      0,
    ]);
    journal = points(journal, "B", 2);
    expect([state(journal).servingTeam, state(journal).currentServer]).toEqual([
      "A",
      0,
    ]);
  });

  it("asks each pair to confirm or change orders before the next set", () => {
    let journal = makeJournal({ format: "doubles" });
    journal = winGames(journal, "A", 6);
    expect(state(journal).tennis?.awaitingSetOrders).toBe(true);
    const newOrders: TennisSetOrders = {
      serviceOrder: { A: [1, 0], B: [1, 0] },
      deuceReceiver: { A: 1, B: 1 },
    };
    journal = confirmTennisSetOrders(journal, newOrders, {
      id: "confirm-set-2",
      createdAt: "2026-10-12T01:00:00.000Z",
    });
    expect(state(journal).tennis?.awaitingSetOrders).toBe(false);
    expect(state(journal).servingTeam).toBe("A");
    expect(state(journal).currentServer).toBe(1);
    expect(state(journal).positions.B.right).toBe(1);
  });

  it("enforces the same-gender mixed receiver without allowing a position swap", () => {
    const orders: TennisSetOrders = {
      serviceOrder: { A: [0, 1], B: [0, 1] },
      deuceReceiver: { A: 0, B: 1 },
    };
    let journal = makeJournal({
      format: "mixed_doubles",
      rules: { gameScoring: "no_ad" },
      orders,
      roles: { A: ["woman", "man"], B: ["woman", "man"] },
    });
    journal = points(journal, "A", 3);
    journal = points(journal, "B", 3);
    expect(state(journal).tennis?.noAdReceivingSide).toBe("left");
    expect(tennisReceivingPlayer(journal.definition, state(journal))).toBe(0);
    const ignored = selectTennisDecidingSide(journal, "right", {
      id: "invalid-mixed-side",
      createdAt: "2026-10-12T01:01:00.000Z",
    });
    expect(ignored.events).toHaveLength(journal.events.length);
    journal = selectTennisDecidingSide(journal, "left", {
      id: "valid-mixed-side",
      createdAt: "2026-10-12T01:02:00.000Z",
    });
    expect(state(journal).tennis?.noAdReceivingSide).toBe("left");
  });

  it("changes ends after odd games, standard tie-break sets, and match tie-break intervals", () => {
    let regular = makeJournal();
    regular = winGame(regular, "A");
    expect(state(regular).tennis?.courtEndsSwapped).toBe(true);
    regular = winGame(regular, "A");
    expect(state(regular).tennis?.courtEndsSwapped).toBe(true);
    regular = winGame(regular, "A");
    expect(state(regular).tennis?.courtEndsSwapped).toBe(false);

    let standardTieBreak = reachSixAll(makeJournal());
    const initialTieBreakEnds =
      state(standardTieBreak).tennis!.courtEndsSwapped;
    standardTieBreak = points(standardTieBreak, "A", 5);
    expect(state(standardTieBreak).tennis?.courtEndsSwapped).toBe(
      initialTieBreakEnds,
    );
    standardTieBreak = point(standardTieBreak, "B");
    expect(state(standardTieBreak).tennis?.courtEndsSwapped).toBe(
      !initialTieBreakEnds,
    );

    let matchTieBreak = makeJournal({
      rules: { finalSetScoring: "match_tiebreak" },
    });
    matchTieBreak = winGames(matchTieBreak, "A", 6);
    matchTieBreak = winGames(matchTieBreak, "B", 6);
    expect(state(matchTieBreak).tennis?.phase).toBe("match_tiebreak");
    const startingEnds = state(matchTieBreak).tennis!.courtEndsSwapped;
    matchTieBreak = point(matchTieBreak, "A");
    expect(state(matchTieBreak).tennis?.courtEndsSwapped).toBe(!startingEnds);
    matchTieBreak = points(matchTieBreak, "A", 3);
    expect(state(matchTieBreak).tennis?.courtEndsSwapped).toBe(!startingEnds);
    matchTieBreak = point(matchTieBreak, "A");
    expect(state(matchTieBreak).tennis?.courtEndsSwapped).toBe(startingEnds);
  });

  it("replays correction, undo, and redo as scoring events", () => {
    let journal = makeJournal();
    journal = points(journal, "A", 2);
    journal = point(journal, "B");
    const corrected = overrideTennisScore(
      journal,
      {
        pointScore: { A: 3, B: 2 },
        advantage: null,
        tieBreakScore: null,
        gamePointCount: 3,
      },
      { id: "correction", createdAt: "2026-10-12T00:01:00.000Z" },
    );
    expect(state(corrected).tennis?.pointScore).toEqual({ A: 3, B: 2 });
    const undone = undo(corrected, {
      id: "undo",
      createdAt: "2026-10-12T00:02:00.000Z",
    });
    expect(state(undone).tennis?.pointScore).toEqual({ A: 2, B: 1 });
    const redone = redo(undone, {
      id: "redo",
      createdAt: "2026-10-12T00:03:00.000Z",
    });
    expect(state(redone).tennis?.pointScore).toEqual({ A: 3, B: 2 });
  });
});
