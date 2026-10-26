import { describe, expect, it } from "vitest";
import { setupDraftFromDefinition } from "./rematch";
import type { MatchDefinition } from "@skor-lapangan/scoring-core";

const definition: MatchDefinition = {
  id: "old-match",
  sport: "badminton",
  format: "doubles",
  rulesetId: "bwf-doubles-3x21-2025",
  mode: "casual",
  createdAt: "2026-10-26T00:00:00.000Z",
  initialServingTeam: "A",
  initialServingPlayer: 1,
  teams: {
    A: {
      name: "A",
      players: [
        { id: "a", name: "A1" },
        { id: "a2", name: "A2" },
      ],
    },
    B: {
      name: "B",
      players: [
        { id: "b", name: "B1" },
        { id: "b2", name: "B2" },
      ],
    },
  },
};

describe("rematch preparation", () => {
  it("keeps the full definition as a setup snapshot", () => {
    expect(setupDraftFromDefinition(definition)).toMatchObject({
      sport: "badminton",
      format: "doubles",
      mode: "casual",
      rematch: { sourceMatchId: "old-match", definition },
    });
  });
});
