import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchJournal } from "@skor-lapangan/scoring-core";
import { createStorageMatchStore, matchStoreSchemaVersion } from "./matchStore";

const matchId = "7550e45b-28c8-4be7-8127-810454a45c64";

function journal(): MatchJournal {
  return {
    definition: {
      id: matchId,
      sport: "badminton",
      rulesetId: "bwf-doubles-3x21-2025",
      mode: "casual",
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
}

describe("MatchStore", () => {
  const store = createStorageMatchStore(window.localStorage);

  beforeEach(async () => {
    await store.clear();
  });

  it("persists and reads a Match by its stable UUID", async () => {
    const record = {
      matchId,
      schemaVersion: matchStoreSchemaVersion,
      journal: journal(),
      expiresAt: "2026-10-09T00:00:00.000Z",
    };

    await store.put(record);

    await expect(store.get(matchId)).resolves.toEqual(record);
    await expect(store.list()).resolves.toEqual([record]);
  });

  it("updates and removes a Match without changing its identity", async () => {
    const record = {
      matchId,
      schemaVersion: matchStoreSchemaVersion,
      journal: journal(),
    };
    await store.put(record);

    await store.put({ ...record, ownerId: "account-user" });
    await expect(store.get(matchId)).resolves.toMatchObject({
      matchId,
      ownerId: "account-user",
    });

    await store.remove(matchId);
    await expect(store.get(matchId)).resolves.toBeNull();
  });

  it("reports a persistence failure instead of accepting an unsaved Match", async () => {
    const setItem = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Storage is full", "QuotaExceededError");
      });

    await expect(
      store.put({
        matchId,
        schemaVersion: matchStoreSchemaVersion,
        journal: journal(),
      }),
    ).rejects.toMatchObject({
      name: "MatchStoreError",
      code: "persistence_failed",
    });

    setItem.mockRestore();
  });
});
