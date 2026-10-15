import { describe, expect, it, vi } from "vitest";
import { awardRally, type MatchJournal } from "@skor-lapangan/scoring-core";
import { syncJournal } from "./sync";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("./supabase", () => ({
  supabase: { rpc },
}));

const matchId = "7550e45b-28c8-4be7-8127-810454a45f70";

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

describe("match sync queue", () => {
  it("serializes writes for the same match", async () => {
    let releaseFirst!: (value: { data: string; error: null }) => void;
    rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
    );
    rpc.mockResolvedValueOnce({ data: "applied", error: null });

    const first = awardRally(journal(), "A", {
      id: "42e0b088-1678-4c64-9bf0-d978ba68b470",
      createdAt: "2026-10-15T00:00:01.000Z",
    });
    const second = awardRally(first, "B", {
      id: "42e0b088-1678-4c64-9bf0-d978ba68b471",
      createdAt: "2026-10-15T00:00:02.000Z",
    });

    const firstSync = syncJournal(first, "account-user", false, "token-1");
    const secondSync = syncJournal(second, "account-user", false, "token-1");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rpc).toHaveBeenCalledTimes(1);

    releaseFirst({ data: "applied", error: null });
    await expect(firstSync).resolves.toEqual({ status: "synced" });
    await expect(secondSync).resolves.toEqual({ status: "synced" });
    expect(rpc).toHaveBeenCalledTimes(2);
    const calls = rpc.mock.calls as Array<
      [string, { p_last_client_sequence: number }]
    >;
    expect(calls[0]?.[1].p_last_client_sequence).toBe(1);
    expect(calls[1]?.[1].p_last_client_sequence).toBe(2);
  });
});
