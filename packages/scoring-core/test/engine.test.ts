import { describe, expect, it } from "vitest";
import {
  awardRally,
  createInitialState,
  deriveJournal,
  officialRulesetFor,
  overrideState,
  redo,
  servingSide,
  undo,
  type MatchDefinition,
  type MatchFormat,
  type MatchJournal,
  type ScoringMode,
  type TeamId,
} from "../src";

const definition = (
  sport: "badminton" | "pickleball",
  format: MatchFormat = "doubles",
  scoringMode?: ScoringMode,
): MatchDefinition => {
  const official = officialRulesetFor(sport, format, scoringMode);
  const players = (team: string) =>
    format === "singles"
      ? ([{ id: `${team}0`, name: `${team}1` }] as const)
      : ([
          { id: `${team}0`, name: `${team}1` },
          { id: `${team}1`, name: `${team}2` },
        ] as const);

  return {
    id: `${sport}-${format}-match`,
    sport,
    format,
    rulesetId: official.id,
    ruleset: {
      id: official.id,
      name: official.name,
      sport,
      format,
      source: "official",
      version: official.version,
      configuration: { ...official.configuration },
    },
    mode: "casual",
    createdAt: "2026-10-08T00:00:00.000Z",
    initialServingTeam: "A",
    initialServingPlayer: 0,
    teams: {
      A: { name: "Team A", players: players("A") },
      B: { name: "Team B", players: players("B") },
    },
  };
};

const journal = (
  sport: "badminton" | "pickleball",
  format: MatchFormat = "doubles",
  scoringMode?: ScoringMode,
): MatchJournal => ({
  definition: definition(sport, format, scoringMode),
  events: [],
});

let id = 0;
const metadata = () => ({
  id: `event-${++id}`,
  createdAt: `2026-10-08T00:00:${String(id).padStart(2, "0")}.000Z`,
});

function rallies(source: MatchJournal, winners: TeamId[]): MatchJournal {
  return winners.reduce(
    (current, team) => awardRally(current, team, metadata()),
    source,
  );
}

describe("badminton doubles", () => {
  it("treats a legacy definition without a format as doubles", () => {
    const legacy = definition("badminton");
    delete legacy.format;

    const state = createInitialState(legacy);
    expect(state.format).toBe("doubles");
    expect(state.positions.A).toEqual({ left: 1, right: 0 });
  });

  it("moves a serving player after a point and transfers service without moving receivers", () => {
    const afterServe = rallies(journal("badminton"), ["A"]);
    const first = deriveJournal(afterServe).state;
    expect(first.points).toEqual({ A: 1, B: 0 });
    expect(first.positions.A).toEqual({ left: 0, right: 1 });
    expect(first.currentServer).toBe(0);
    expect(servingSide(first)).toBe("left");

    const afterTransfer = awardRally(afterServe, "B", metadata());
    const second = deriveJournal(afterTransfer).state;
    expect(second.points).toEqual({ A: 1, B: 1 });
    expect(second.servingTeam).toBe("B");
    expect(second.currentServer).toBe(1);
    expect(servingSide(second)).toBe("left");
  });

  it("requires a two point lead but caps a game at 30", () => {
    let game = journal("badminton");
    game = rallies(
      game,
      Array.from({ length: 20 }, () => "A" as const),
    );
    game = rallies(
      game,
      Array.from({ length: 20 }, () => "B" as const),
    );
    game = rallies(game, ["A", "B", "A", "B"]);
    expect(deriveJournal(game).state.gameNumber).toBe(1);

    for (let round = 0; round < 7; round += 1) {
      game = rallies(game, ["A", "B"]);
    }
    game = rallies(game, ["A"]);
    expect(deriveJournal(game).state.gameNumber).toBe(2);
    expect(deriveJournal(game).state.completedGames[0]?.score).toEqual({
      A: 30,
      B: 29,
    });
  });

  it("finishes a best-of-three match after two games", () => {
    let game = journal("badminton");
    game = rallies(
      game,
      Array.from({ length: 42 }, () => "A" as const),
    );
    const state = deriveJournal(game).state;
    expect(state.status).toBe("complete");
    expect(state.winner).toBe("A");
    expect(state.gamesWon).toEqual({ A: 2, B: 0 });
  });
});

describe("badminton singles", () => {
  it("moves the single player by score parity and changes server after a lost rally", () => {
    let game = journal("badminton", "singles");
    expect(servingSide(deriveJournal(game).state)).toBe("right");

    game = awardRally(game, "A", metadata());
    let state = deriveJournal(game).state;
    expect(state.points).toEqual({ A: 1, B: 0 });
    expect(state.servingTeam).toBe("A");
    expect(state.currentServer).toBe(0);
    expect(servingSide(state)).toBe("left");

    game = awardRally(game, "B", metadata());
    state = deriveJournal(game).state;
    expect(state.points).toEqual({ A: 1, B: 1 });
    expect(state.servingTeam).toBe("B");
    expect(state.currentServer).toBe(0);
    expect(servingSide(state)).toBe("left");
  });

  it("uses the badminton game score and best-of-three match rules", () => {
    let game = rallies(
      journal("badminton", "singles"),
      Array.from({ length: 21 }, () => "A" as const),
    );
    const nextGame = deriveJournal(game).state;
    expect(nextGame.gameNumber).toBe(2);
    expect(nextGame.points).toEqual({ A: 0, B: 0 });
    expect(nextGame.gamesWon).toEqual({ A: 1, B: 0 });
    expect(nextGame.servingTeam).toBe("A");
    expect(servingSide(nextGame)).toBe("right");

    game = rallies(
      game,
      Array.from({ length: 21 }, () => "A" as const),
    );
    const state = deriveJournal(game).state;

    expect(state.status).toBe("complete");
    expect(state.winner).toBe("A");
    expect(state.gamesWon).toEqual({ A: 2, B: 0 });
  });
});

describe("pickleball doubles", () => {
  it("starts with the one-server exception at 0-0-2", () => {
    const state = createInitialState(definition("pickleball"));
    expect(state.points).toEqual({ A: 0, B: 0 });
    expect(state.serverNumber).toBe(2);
    expect(servingSide(state)).toBe("right");
  });

  it("keeps the opening server on the right after a zero score override", () => {
    const game = overrideState(
      journal("pickleball"),
      { A: 0, B: 0 },
      metadata(),
    );
    expect(servingSide(deriveJournal(game).state)).toBe("right");
  });

  it("scores only on serve, then moves through server two and side out", () => {
    let game = rallies(journal("pickleball"), ["A"]);
    let state = deriveJournal(game).state;
    expect(state.points).toEqual({ A: 1, B: 0 });
    expect(state.positions.A).toEqual({ left: 0, right: 1 });

    game = awardRally(game, "B", metadata());
    state = deriveJournal(game).state;
    expect(state.points).toEqual({ A: 1, B: 0 });
    expect(state.servingTeam).toBe("B");
    expect(state.serverNumber).toBe(1);

    game = awardRally(game, "A", metadata());
    state = deriveJournal(game).state;
    expect(state.servingTeam).toBe("B");
    expect(state.serverNumber).toBe(2);
    expect(state.currentServer).toBe(1);

    game = awardRally(game, "A", metadata());
    state = deriveJournal(game).state;
    expect(state.servingTeam).toBe("A");
    expect(state.serverNumber).toBe(1);
  });

  it("starts an odd-score service turn with the player physically on the left", () => {
    let game = rallies(journal("pickleball"), [
      "B",
      "A",
      "A",
      "A",
      "B",
      "B",
      "B",
      "A",
      "A",
    ]);
    const state = deriveJournal(game).state;

    expect(state.points).toEqual({ A: 1, B: 1 });
    expect(state.servingTeam).toBe("A");
    expect(state.serverNumber).toBe(1);
    expect(state.positions.A).toEqual({ left: 0, right: 1 });
    expect(state.currentServer).toBe(0);
    expect(servingSide(state)).toBe("left");

    game = awardRally(game, "B", metadata());
    const secondServer = deriveJournal(game).state;
    expect(secondServer.servingTeam).toBe("A");
    expect(secondServer.serverNumber).toBe(2);
    expect(secondServer.currentServer).toBe(1);
    expect(servingSide(secondServer)).toBe("right");
  });

  it("starts an odd-score side-out from the left service court", () => {
    let game = rallies(journal("pickleball"), ["A"]);
    game = rallies(game, ["B"]);
    game = rallies(game, ["A"]);
    game = awardRally(game, "A", metadata());

    const state = deriveJournal(game).state;
    expect(state.servingTeam).toBe("A");
    expect(state.points.A).toBe(1);
    expect(servingSide(state)).toBe("left");
  });
});

describe("pickleball singles", () => {
  it("uses one side-out server and changes service without awarding a point to the receiver", () => {
    let game = journal("pickleball", "singles");
    let state = deriveJournal(game).state;
    expect(state.serverNumber).toBeNull();
    expect(servingSide(state)).toBe("right");

    game = awardRally(game, "B", metadata());
    state = deriveJournal(game).state;
    expect(state.points).toEqual({ A: 0, B: 0 });
    expect(state.servingTeam).toBe("B");
    expect(state.currentServer).toBe(0);
    expect(state.serverNumber).toBeNull();
    expect(servingSide(state)).toBe("right");

    game = awardRally(game, "B", metadata());
    state = deriveJournal(game).state;
    expect(state.points).toEqual({ A: 0, B: 1 });
    expect(servingSide(state)).toBe("left");

    game = awardRally(game, "A", metadata());
    state = deriveJournal(game).state;
    expect(state.points).toEqual({ A: 0, B: 1 });
    expect(state.servingTeam).toBe("A");
    expect(servingSide(state)).toBe("right");
  });

  it("uses rally scoring when selected and assigns service to the rally winner", () => {
    let game = journal("pickleball", "singles", "rally");
    game = awardRally(game, "B", metadata());
    let state = deriveJournal(game).state;
    expect(state.points).toEqual({ A: 0, B: 1 });
    expect(state.servingTeam).toBe("B");
    expect(state.currentServer).toBe(0);
    expect(servingSide(state)).toBe("left");

    game = awardRally(game, "A", metadata());
    state = deriveJournal(game).state;
    expect(state.points).toEqual({ A: 1, B: 1 });
    expect(state.servingTeam).toBe("A");
    expect(servingSide(state)).toBe("left");
  });

  it("recalculates the service court after a score correction", () => {
    const game = overrideState(
      journal("pickleball", "singles"),
      { A: 1, B: 0 },
      metadata(),
    );

    expect(servingSide(deriveJournal(game).state)).toBe("left");
  });
});

describe("journal corrections", () => {
  it("supports undo, redo, and score correction in singles", () => {
    let game = rallies(journal("pickleball", "singles", "rally"), ["A", "B"]);
    game = undo(game, metadata());
    expect(deriveJournal(game).state.points).toEqual({ A: 1, B: 0 });
    expect(deriveJournal(game).state.servingTeam).toBe("A");

    game = redo(game, metadata());
    expect(deriveJournal(game).state.points).toEqual({ A: 1, B: 1 });
    expect(deriveJournal(game).state.servingTeam).toBe("B");

    game = overrideState(game, { A: 4, B: 3 }, metadata());
    const corrected = deriveJournal(game).state;
    expect(corrected.points).toEqual({ A: 4, B: 3 });
    expect(corrected.servingTeam).toBe("B");
    expect(servingSide(corrected)).toBe("left");
  });

  it("keeps undo and redo as append-only audit events", () => {
    let game = rallies(journal("badminton"), ["A", "B"]);
    game = undo(game, metadata());
    expect(deriveJournal(game).state.points).toEqual({ A: 1, B: 0 });
    expect(game.events.at(-1)?.type).toBe("undo_applied");

    game = redo(game, metadata());
    expect(deriveJournal(game).state.points).toEqual({ A: 1, B: 1 });
    expect(game.events.at(-1)?.type).toBe("redo_applied");
  });

  it("clears the redo path when a new rally is added", () => {
    let game = rallies(journal("badminton"), ["A", "B"]);
    game = undo(game, metadata());
    game = awardRally(game, "A", metadata());
    expect(deriveJournal(game).canRedo).toBe(false);
    expect(deriveJournal(game).state.points).toEqual({ A: 2, B: 0 });
  });

  it("stores a complete score override as one event", () => {
    const game = overrideState(
      journal("badminton"),
      { A: 12, B: 8 },
      metadata(),
    );
    expect(deriveJournal(game).state.points).toEqual({ A: 12, B: 8 });
    expect(game.events).toHaveLength(1);
    expect(game.events[0]?.type).toBe("state_overridden");
  });

  it.each([
    ["badminton", { A: 21, B: 8 }],
    ["pickleball", { A: 11, B: 3 }],
  ] as const)(
    "advances to the next game when a %s override is a winning score",
    (sport, points) => {
      const game = overrideState(journal(sport), points, metadata());
      const state = deriveJournal(game).state;

      expect(state.gameNumber).toBe(2);
      expect(state.gamesWon).toEqual({ A: 1, B: 0 });
      expect(state.points).toEqual({ A: 0, B: 0 });
      expect(state.completedGames).toEqual([{ winner: "A", score: points }]);
    },
  );

  it("finishes a match from winning overrides and ignores later corrections", () => {
    let game = overrideState(journal("badminton"), { A: 21, B: 8 }, metadata());
    game = overrideState(game, { A: 22, B: 20 }, metadata());

    const completed = deriveJournal(game).state;
    expect(completed.status).toBe("complete");
    expect(completed.winner).toBe("A");
    expect(completed.gamesWon).toEqual({ A: 2, B: 0 });

    const ignored = overrideState(game, { A: 0, B: 0 }, metadata());
    expect(ignored).toBe(game);
  });

  it("rejects negative and fractional overrides", () => {
    expect(() =>
      overrideState(journal("badminton"), { A: -1, B: 0 }, metadata()),
    ).toThrow();
    expect(() =>
      overrideState(journal("badminton"), { A: 1.5, B: 0 }, metadata()),
    ).toThrow();
  });

  it("treats a duplicated client event UUID idempotently", () => {
    const game = awardRally(journal("badminton"), "A", metadata());
    const duplicated = { ...game, events: [...game.events, game.events[0]!] };
    expect(deriveJournal(duplicated).state.points).toEqual({ A: 1, B: 0 });
  });
});

describe("match-scoped custom rules", () => {
  it("uses the stored target, win-by rule, and best-of configuration", () => {
    const base = definition("badminton");
    const custom: MatchDefinition = {
      ...base,
      rulesetId: "guest-rules-1",
      ruleset: {
        id: "guest-rules-1",
        name: "Short game",
        sport: "badminton",
        source: "guest_custom",
        version: 1,
        configuration: {
          pointsToWin: 3,
          winBy: 1,
          maxPoints: null,
          bestOf: 1,
          scoringMode: "rally",
          serversPerTurn: 1,
          openingServerNumber: 1,
        },
      },
    };

    const game = rallies({ definition: custom, events: [] }, [
      "A",
      "B",
      "A",
      "B",
      "A",
    ]);
    const state = deriveJournal(game).state;

    expect(state.status).toBe("complete");
    expect(state.winner).toBe("A");
    expect(state.completedGames).toEqual([
      { winner: "A", score: { A: 3, B: 2 } },
    ]);
  });

  it("supports a single-server side-out turn for a guest match", () => {
    const base = definition("pickleball");
    const custom: MatchDefinition = {
      ...base,
      rulesetId: "guest-one-server",
      ruleset: {
        id: "guest-one-server",
        name: "One server",
        sport: "pickleball",
        source: "guest_custom",
        version: 1,
        configuration: {
          pointsToWin: 11,
          winBy: 2,
          maxPoints: null,
          bestOf: 3,
          scoringMode: "side_out",
          serversPerTurn: 1,
          openingServerNumber: 2,
        },
      },
    };

    const afterInitialServe = awardRally(
      { definition: custom, events: [] },
      "B",
      metadata(),
    );
    const state = deriveJournal(afterInitialServe).state;

    expect(state.points).toEqual({ A: 0, B: 0 });
    expect(state.servingTeam).toBe("B");
    expect(state.serverNumber).toBe(1);
    expect(servingSide(state)).toBe("right");
  });

  it("forces singles custom rules to one server even when the snapshot says two", () => {
    const base = definition("pickleball", "singles");
    const custom: MatchDefinition = {
      ...base,
      rulesetId: "guest-singles-rules",
      ruleset: {
        id: "guest-singles-rules",
        name: "Singles custom",
        sport: "pickleball",
        format: "singles",
        source: "guest_custom",
        version: 1,
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
    };

    const game = awardRally(
      { definition: custom, events: [] },
      "B",
      metadata(),
    );
    const state = deriveJournal(game).state;

    expect(state.servingTeam).toBe("B");
    expect(state.serverNumber).toBeNull();
    expect(state.points).toEqual({ A: 0, B: 0 });
  });
});
