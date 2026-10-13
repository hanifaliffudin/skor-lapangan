import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchJournal } from "@skor-lapangan/scoring-core";
import {
  loadDraft,
  loadMatch,
  removeMatch,
  removeAllStoredMatches,
  saveDraft,
  saveMatch,
} from "./session";

describe("guest session storage", () => {
  beforeEach(() => window.sessionStorage.clear());
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it("round-trips a setup draft in the current tab", () => {
    saveDraft({ sport: "badminton", format: "doubles", mode: "casual" });
    expect(loadDraft()).toEqual({
      sport: "badminton",
      format: "doubles",
      mode: "casual",
    });
  });

  it("normalizes a legacy Referee setup draft to the single V1 mode", () => {
    window.sessionStorage.setItem(
      "skor-lapangan:setup-draft",
      JSON.stringify({ sport: "pickleball", mode: "referee" }),
    );

    expect(loadDraft()).toEqual({
      sport: "pickleball",
      format: "doubles",
      mode: "casual",
    });
  });

  it("keeps a selected singles format in the setup draft", () => {
    saveDraft({ sport: "badminton", format: "singles", mode: "casual" });
    expect(loadDraft()?.format).toBe("singles");
  });

  it("keeps Padel mixed doubles in the setup draft", () => {
    saveDraft({ sport: "padel", format: "mixed_doubles", mode: "casual" });
    expect(loadDraft()).toEqual({
      sport: "padel",
      format: "mixed_doubles",
      mode: "casual",
    });
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

  it("rejects malformed journal data before it reaches the scoring engine", () => {
    const matchId = "malformed-match";
    window.localStorage.setItem(
      `skor-lapangan:match:${matchId}`,
      JSON.stringify({
        schemaVersion: 1,
        expiresAt: "2026-10-10T00:00:00.000Z",
        journal: {
          definition: { id: matchId },
          events: "not-an-array",
        },
      }),
    );

    expect(loadMatch(matchId)).toBeNull();
    expect(window.localStorage.getItem(`skor-lapangan:match:${matchId}`)).toBe(
      null,
    );
  });

  it("does not crash the scorer when local storage is full", () => {
    const setItem = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Storage is full", "QuotaExceededError");
      });

    expect(
      saveMatch({
        definition: { id: "quota-match" },
        events: [],
      } as unknown as MatchJournal),
    ).toBe(false);
    setItem.mockRestore();
  });

  it("clears every stored match from both browser storage areas", () => {
    window.localStorage.setItem("skor-lapangan:match:one", "one");
    window.localStorage.setItem("skor-lapangan:setup-draft", "keep");
    window.sessionStorage.setItem("skor-lapangan:match:two", "two");

    removeAllStoredMatches();

    expect(window.localStorage.getItem("skor-lapangan:match:one")).toBeNull();
    expect(window.sessionStorage.getItem("skor-lapangan:match:two")).toBeNull();
    expect(window.localStorage.getItem("skor-lapangan:setup-draft")).toBe(
      "keep",
    );
  });
});
