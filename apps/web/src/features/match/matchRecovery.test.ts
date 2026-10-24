import { describe, expect, it } from "vitest";
import {
  awardRally,
  deriveJournal,
  undo,
  type MatchJournal,
} from "@skor-lapangan/scoring-core";
import { forkMatchAsNew } from "./matchRecovery";

const matchId = "7550e45b-28c8-4be7-8127-810454a45c64";

function journal(): MatchJournal {
  return {
    definition: {
      id: matchId,
      sport: "badminton",
      format: "singles",
      rulesetId: "bwf-singles-3x21-2025",
      mode: "casual",
      createdAt: "2026-10-08T00:00:00.000Z",
      initialServingTeam: "A",
      initialServingPlayer: 0,
      teams: {
        A: { name: "Team A", players: [{ id: "a-1", name: "A1" }] },
        B: { name: "Team B", players: [{ id: "b-1", name: "B1" }] },
      },
    },
    events: [],
  };
}

describe("Match conflict recovery", () => {
  it("forks the local journal with new identity while preserving its score timeline", () => {
    const withPoint = awardRally(journal(), "A", {
      id: "event-1",
      createdAt: "2026-10-08T00:01:00.000Z",
    });
    const local = undo(withPoint, {
      id: "undo-1",
      createdAt: "2026-10-08T00:02:00.000Z",
    });
    let nextId = 0;

    const fork = forkMatchAsNew(local, {
      createId: () => `new-id-${++nextId}`,
      now: () => "2026-10-09T00:00:00.000Z",
    });

    expect(fork.definition.id).toBe("new-id-1");
    expect(fork.definition.createdAt).toBe("2026-10-09T00:00:00.000Z");
    expect(fork.definition.id).not.toBe(local.definition.id);
    expect(fork.events.map((event) => event.id)).toEqual([
      "new-id-2",
      "new-id-3",
    ]);
    expect(fork.events.every((event) => event.matchId === "new-id-1")).toBe(
      true,
    );
    expect(fork.events[1]).toMatchObject({
      type: "undo_applied",
      targetEventId: "new-id-2",
    });
    const { matchId: _forkMatchId, ...forkState } = deriveJournal(fork).state;
    const { matchId: _localMatchId, ...localState } =
      deriveJournal(local).state;
    expect(forkState).toEqual(localState);
    expect(fork.events.map((event) => event.id)).not.toContain("event-1");
    expect(fork.events.map((event) => event.id)).not.toContain("undo-1");
  });
});
