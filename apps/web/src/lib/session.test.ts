import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchJournal } from "@skor-lapangan/scoring-core";
import {
  canSyncStoredMatch,
  clearDraft,
  loadDraft,
  loadMatch,
  loadMatchAsync,
  getStoredMatchInfo,
  getStoredMatchInfoAsync,
  hasActiveOrPendingMatches,
  listPendingMatchesAsync,
  removeMatch,
  removeMatchAsync,
  removeAllStoredMatches,
  saveDraft,
  saveMatch,
  saveMatchAsync,
} from "./session";
import { matchStore } from "./matchStore";

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

  it("round-trips and clears a rematch snapshot", () => {
    const definition = {
      id: "source-match",
      sport: "badminton" as const,
      format: "doubles" as const,
      rulesetId: "bwf-doubles-3x21-2025",
      mode: "casual" as const,
      createdAt: "2026-10-26T00:00:00.000Z",
      initialServingTeam: "A" as const,
      initialServingPlayer: 0 as const,
      teams: {
        A: {
          name: "A",
          players: [
            { id: "a", name: "A1" },
            { id: "a2", name: "A2" },
          ] as const,
        },
        B: {
          name: "B",
          players: [
            { id: "b", name: "B1" },
            { id: "b2", name: "B2" },
          ] as const,
        },
      },
    };
    saveDraft({
      sport: "badminton",
      format: "doubles",
      mode: "casual",
      rematch: { sourceMatchId: definition.id, definition },
    });
    expect(loadDraft()?.rematch?.sourceMatchId).toBe(definition.id);
    clearDraft();
    expect(loadDraft()).toBeNull();
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
    saveMatch(journal, { ownerId: "account-id", persistent: true });
    expect(getStoredMatchInfo(journal.definition.id)).toMatchObject({
      ownerId: "account-id",
      persistent: true,
      sync: {
        status: "local",
        lastServerSequence: 0,
        pendingFromSequence: null,
      },
    });
    expect(canSyncStoredMatch(journal.definition.id, "guest-id", true)).toBe(
      false,
    );
    expect(canSyncStoredMatch(journal.definition.id, "account-id", false)).toBe(
      true,
    );
    expect(canSyncStoredMatch(journal.definition.id, "other-id", false)).toBe(
      false,
    );
    removeMatch(journal.definition.id);
    expect(loadMatch(journal.definition.id)).toBeNull();
  });

  it("migrates a legacy Match without changing its UUID or event UUIDs", async () => {
    const journal: MatchJournal = {
      definition: {
        id: "legacy-match",
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
      events: [
        {
          id: "legacy-event",
          matchId: "legacy-match",
          clientSequence: 1,
          type: "rally_awarded",
          team: "A",
          createdAt: "2026-10-09T10:01:00.000Z",
        },
      ],
    };
    window.localStorage.setItem(
      "skor-lapangan:match:legacy-match",
      JSON.stringify({
        schemaVersion: 1,
        journal,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );

    await expect(loadMatchAsync("legacy-match")).resolves.toEqual(journal);
    expect(loadMatch("legacy-match")).toEqual(journal);
    if (typeof indexedDB === "undefined") {
      expect(
        window.localStorage.getItem("skor-lapangan:match:legacy-match"),
      ).toEqual(expect.any(String));
    } else {
      expect(
        window.localStorage.getItem("skor-lapangan:match:legacy-match"),
      ).toBeNull();
    }
    await expect(matchStore.get("legacy-match")).resolves.toMatchObject({
      matchId: "legacy-match",
      journal,
    });
  });

  it("keeps a legacy Match when durable migration fails", async () => {
    const legacyKey = "skor-lapangan:match:migration-failure";
    const journal = {
      definition: {
        id: "migration-failure",
        sport: "badminton",
        rulesetId: "bwf-doubles-3x21-2025",
        mode: "casual",
        createdAt: "2026-10-09T10:00:00.000Z",
        initialServingTeam: "A",
        initialServingPlayer: 0,
        teams: {
          A: { name: "Team A", players: [{ id: "a-1", name: "A1" }] },
          B: { name: "Team B", players: [{ id: "b-1", name: "B1" }] },
        },
      },
      events: [],
    } as unknown as MatchJournal;
    const legacyValue = JSON.stringify({ schemaVersion: 1, journal });
    window.localStorage.setItem(legacyKey, legacyValue);
    const put = vi
      .spyOn(matchStore, "put")
      .mockRejectedValue(new Error("quota"));

    await expect(loadMatchAsync("migration-failure")).rejects.toThrow("quota");
    expect(window.localStorage.getItem(legacyKey)).toBe(legacyValue);
    put.mockRestore();
  });

  it("does not expose a Match until an async save succeeds", async () => {
    const journal = {
      definition: {
        id: "async-save",
        sport: "badminton",
        rulesetId: "bwf-doubles-3x21-2025",
        mode: "casual",
        createdAt: "2026-10-09T10:00:00.000Z",
        initialServingTeam: "A",
        initialServingPlayer: 0,
        teams: {
          A: { name: "Team A", players: [{ id: "a-1", name: "A1" }] },
          B: { name: "Team B", players: [{ id: "b-1", name: "B1" }] },
        },
      },
      events: [],
    } as unknown as MatchJournal;

    await expect(saveMatchAsync(journal)).resolves.toBe(true);
    await expect(loadMatchAsync("async-save")).resolves.toEqual(journal);
  });

  it("persists pending sync metadata across an async reload", async () => {
    const journal = {
      definition: {
        id: "pending-sync",
        sport: "badminton",
        rulesetId: "bwf-doubles-3x21-2025",
        mode: "casual",
        createdAt: "2026-10-09T10:00:00.000Z",
        initialServingTeam: "A",
        initialServingPlayer: 0,
        teams: {
          A: { name: "Team A", players: [{ id: "a-1", name: "A1" }] },
          B: { name: "Team B", players: [{ id: "b-1", name: "B1" }] },
        },
      },
      events: [],
    } as unknown as MatchJournal;

    await expect(
      saveMatchAsync(journal, {
        sync: {
          status: "pending",
          lastServerSequence: 3,
          pendingFromSequence: 4,
          updatedAt: "2026-10-09T10:01:00.000Z",
        },
      }),
    ).resolves.toBe(true);

    expect(await getStoredMatchInfoAsync("pending-sync")).toMatchObject({
      sync: {
        status: "pending",
        lastServerSequence: 3,
        pendingFromSequence: 4,
      },
    });
  });

  it("lists pending matches for an automatic reconnect retry", async () => {
    const journal = {
      definition: {
        id: "pending-retry",
        sport: "badminton",
        rulesetId: "bwf-doubles-3x21-2025",
        mode: "casual",
        createdAt: "2026-10-09T10:00:00.000Z",
        initialServingTeam: "A",
        initialServingPlayer: 0,
        teams: {
          A: { name: "Team A", players: [{ id: "a-1", name: "A1" }] },
          B: { name: "Team B", players: [{ id: "b-1", name: "B1" }] },
        },
      },
      events: [],
    } as unknown as MatchJournal;

    await saveMatchAsync(journal, {
      ownerId: "account-user",
      persistent: true,
      sync: {
        status: "pending",
        lastServerSequence: 2,
        pendingFromSequence: 3,
        updatedAt: "2026-10-09T10:01:00.000Z",
      },
    });

    await expect(listPendingMatchesAsync()).resolves.toEqual([
      {
        journal,
        info: expect.objectContaining({
          ownerId: "account-user",
          persistent: true,
          sync: expect.objectContaining({ status: "pending" }),
        }),
      },
    ]);
  });

  it("blocks a PWA update while a local Match is still active", async () => {
    const journal = {
      definition: {
        id: "pwa-active-match",
        sport: "badminton",
        rulesetId: "bwf-doubles-3x21-2025",
        mode: "casual",
        createdAt: "2026-10-09T10:00:00.000Z",
        initialServingTeam: "A",
        initialServingPlayer: 0,
        teams: {
          A: { name: "Team A", players: [{ id: "a-1", name: "A1" }] },
          B: { name: "Team B", players: [{ id: "b-1", name: "B1" }] },
        },
      },
      events: [],
    } as unknown as MatchJournal;

    await expect(saveMatchAsync(journal)).resolves.toBe(true);
    await expect(hasActiveOrPendingMatches()).resolves.toBe(true);
    await expect(removeMatchAsync(journal.definition.id)).resolves.toBe(true);
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
