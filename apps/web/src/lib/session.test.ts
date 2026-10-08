import { beforeEach, describe, expect, it } from "vitest";
import type { MatchJournal } from "@skor-lapangan/scoring-core";
import {
  loadDraft,
  loadMatch,
  removeMatch,
  saveDraft,
  saveMatch,
} from "./session";

describe("guest session storage", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("round-trips a setup draft in the current tab", () => {
    saveDraft({ sport: "badminton", mode: "casual" });
    expect(loadDraft()).toEqual({ sport: "badminton", mode: "casual" });
  });

  it("uses the client UUID as the match storage identity", () => {
    const journal: MatchJournal = {
      definition: {
        id: "7550e45b-28c8-4be7-8127-810454a45c64",
        sport: "pickleball",
        rulesetId: "usap-doubles-sideout-2026",
        mode: "referee",
        createdAt: "2026-10-08T00:00:00.000Z",
        initialServingTeam: "A",
        initialServingPlayer: 0,
        teams: {
          A: {
            name: "Team A",
            players: [
              { id: "a-1", name: "A1" },
              { id: "a-2", name: "A2" },
            ],
          },
          B: {
            name: "Team B",
            players: [
              { id: "b-1", name: "B1" },
              { id: "b-2", name: "B2" },
            ],
          },
        },
      },
      events: [],
    };

    saveMatch(journal);
    expect(loadMatch(journal.definition.id)).toEqual(journal);
    removeMatch(journal.definition.id);
    expect(loadMatch(journal.definition.id)).toBeNull();
  });
});
