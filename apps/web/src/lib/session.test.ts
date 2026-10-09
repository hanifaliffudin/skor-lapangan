import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.useRealTimers());

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
    expect(
      JSON.parse(
        window.localStorage.getItem(
          `skor-lapangan:match:${journal.definition.id}`,
        )!,
      ),
    ).toMatchObject({ journal, expiresAt: expect.any(String) });
    expect(loadMatch(journal.definition.id)).toEqual(journal);
    removeMatch(journal.definition.id);
    expect(loadMatch(journal.definition.id)).toBeNull();
  });

  it("restores a same-browser match until its 12-hour expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00.000Z"));
    const journal: MatchJournal = {
      definition: {
        id: "resume-match",
        sport: "badminton",
        rulesetId: "bwf-doubles-3x21-2025",
        mode: "casual",
        createdAt: "2026-10-09T10:00:00.000Z",
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
    vi.setSystemTime(new Date("2026-10-09T21:59:59.000Z"));
    expect(loadMatch(journal.definition.id)).toEqual(journal);

    vi.setSystemTime(new Date("2026-10-09T22:00:00.000Z"));
    expect(loadMatch(journal.definition.id)).toBeNull();
    expect(
      window.localStorage.getItem(
        `skor-lapangan:match:${journal.definition.id}`,
      ),
    ).toBeNull();
  });
});
