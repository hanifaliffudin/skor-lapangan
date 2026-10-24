import { describe, expect, it, vi } from "vitest";
import { awardRally, type MatchJournal } from "@skor-lapangan/scoring-core";
import { syncPendingMatches } from "./sync";

const rpc = vi.hoisted(() => vi.fn());
const listPendingMatchesAsync = vi.hoisted(() => vi.fn());
const canSyncStoredMatch = vi.hoisted(() => vi.fn());
const saveMatchAsync = vi.hoisted(() => vi.fn());

vi.mock("./supabase", () => ({ supabase: { rpc } }));
vi.mock("./session", () => ({
  canSyncStoredMatch,
  listPendingMatchesAsync,
  saveMatchAsync,
}));

const matchId = "7550e45b-28c8-4be7-8127-810454a45f71";

function journal(): MatchJournal {
  return {
    definition: {
      id: matchId,
      sport: "badminton",
      rulesetId: "bwf-doubles-3x21-2025",
      mode: "casual",
      createdAt: "2026-10-15T00:00:00.000Z",
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

describe("pending match sync", () => {
  it("retries pending journals and clears their pending marker", async () => {
    const pendingJournal = awardRally(journal(), "A", {
      id: "42e0b088-1678-4c64-9bf0-d978ba68b472",
      createdAt: "2026-10-15T00:00:01.000Z",
    });
    listPendingMatchesAsync.mockResolvedValue([
      {
        journal: pendingJournal,
        info: {
          ownerId: "account-user",
          persistent: true,
          sync: {
            status: "pending",
            lastServerSequence: 0,
            pendingFromSequence: 1,
            updatedAt: "2026-10-15T00:00:02.000Z",
          },
        },
      },
    ]);
    canSyncStoredMatch.mockReturnValue(true);
    saveMatchAsync.mockResolvedValue(true);
    rpc.mockResolvedValue({ data: "applied", error: null });

    await expect(syncPendingMatches("account-user", false)).resolves.toBe(1);
    expect(rpc).toHaveBeenCalledWith(
      "sync_match_journal",
      expect.objectContaining({
        p_match_id: matchId,
        p_last_client_sequence: 1,
      }),
    );
    expect(saveMatchAsync).toHaveBeenCalledWith(
      pendingJournal,
      expect.objectContaining({
        ownerId: "account-user",
        persistent: true,
        sync: expect.objectContaining({
          status: "local",
          lastServerSequence: 1,
          pendingFromSequence: null,
        }),
      }),
    );
  });
});
