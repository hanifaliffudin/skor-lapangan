import { describe, expect, it } from "vitest";
import {
  awardRally,
  createInitialState,
  deriveJournal,
  overrideState,
  redo,
  servingSide,
  undo,
  type MatchDefinition,
  type MatchJournal,
  type TeamId,
} from "../src";

const definition = (sport: "badminton" | "pickleball"): MatchDefinition => ({
  id: `${sport}-match`,
  sport,
  rulesetId:
    sport === "badminton"
      ? "bwf-doubles-3x21-2025"
      : "usap-doubles-sideout-2026",
  mode: "casual",
  createdAt: "2026-10-08T00:00:00.000Z",
  initialServingTeam: "A",
  initialServingPlayer: 0,
  teams: {
    A: {
      name: "Team A",
      players: [
        { id: "a0", name: "A1" },
        { id: "a1", name: "A2" },
      ],
    },
    B: {
      name: "Team B",
      players: [
        { id: "b0", name: "B1" },
        { id: "b1", name: "B2" },
      ],
    },
  },
});

const journal = (sport: "badminton" | "pickleball"): MatchJournal => ({
  definition: definition(sport),
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
});

describe("journal corrections", () => {
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
