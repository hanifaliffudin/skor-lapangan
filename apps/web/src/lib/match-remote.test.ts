import { describe, expect, it, vi } from "vitest";
import { awardRally, type MatchJournal } from "@skor-lapangan/scoring-core";
import { serializeJournalForSync } from "./sync";
import {
  appendRemoteEvents,
  readRemoteMatch,
  readRemoteMatchEventsSince,
  readRemoteMatchHead,
} from "./match-remote";

const remote = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("./supabase", () => ({ supabase: remote }));

const matchId = "7550e45b-28c8-4be7-8127-810454a45c64";
const eventId = "42e0b088-1678-4c64-9bf0-d978ba68b458";

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

function remoteRow(next: MatchJournal) {
  const payload = serializeJournalForSync(next, "account-user", false);
  return {
    id: matchId,
    owner_id: "account-user",
    sport: "badminton",
    status: "active",
    winner: null,
    definition: payload.match.definition,
    current_state: payload.match.current_state,
    last_client_sequence: payload.match.last_client_sequence,
    created_at: payload.match.created_at,
    updated_at: "2026-10-08T00:01:00.000Z",
    events: payload.events,
  };
}

describe("remote match hydration", () => {
  it("rebuilds an account match journal from the server snapshot", async () => {
    const next = awardRally(journal(), "A", {
      id: "42e0b088-1678-4c64-9bf0-d978ba68b458",
      createdAt: "2026-10-08T00:01:00.000Z",
    });
    remote.rpc.mockResolvedValueOnce({ data: [remoteRow(next)], error: null });

    const result = await readRemoteMatch(matchId);

    expect(result.status).toBe("loaded");
    if (result.status === "loaded") {
      expect(result.snapshot.sequence).toBe(1);
      expect(result.snapshot.journal.definition.teams.A.name).toBe("Team A");
      expect(result.snapshot.journal.events[0]).toMatchObject({
        type: "rally_awarded",
        team: "A",
      });
    }
  });

  it("hydrates through the bounded definition and event readers", async () => {
    const next = awardRally(journal(), "A", {
      id: eventId,
      createdAt: "2026-10-08T00:01:00.000Z",
    });
    const payload = serializeJournalForSync(next, "account-user", false);
    remote.rpc.mockReset();
    remote.rpc
      .mockResolvedValueOnce({
        data: [
          {
            id: matchId,
            owner_id: "account-user",
            sport: "badminton",
            status: "active",
            winner: null,
            definition: payload.match.definition,
            current_state: payload.match.current_state,
            last_client_sequence: 1,
            created_at: payload.match.created_at,
            updated_at: "2026-10-08T00:01:00.000Z",
            event_count: 1,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: payload.events, error: null });

    const result = await readRemoteMatch(matchId);

    expect(result.status).toBe("loaded");
    expect(remote.rpc).toHaveBeenNthCalledWith(1, "read_match_definition", {
      p_match_id: matchId,
    });
    expect(remote.rpc).toHaveBeenNthCalledWith(2, "read_match_events_since", {
      p_match_id: matchId,
      p_after_sequence: 0,
      p_limit: 2000,
    });
  });

  it("rejects malformed event payloads before the scoring engine sees them", async () => {
    const row = remoteRow(journal());
    row.events = [
      {
        id: "42e0b088-1678-4c64-9bf0-d978ba68b458",
        match_id: matchId,
        owner_id: "account-user",
        client_sequence: 1,
        event_type: "unsupported_event",
        payload: {},
        created_at: "2026-10-08T00:01:00.000Z",
      },
    ];
    remote.rpc.mockResolvedValueOnce({ data: [row], error: null });

    await expect(readRemoteMatch(matchId)).resolves.toEqual({
      status: "error",
      error: "INVALID_REMOTE_MATCH",
    });
  });

  it("reports a missing account match", async () => {
    remote.rpc.mockResolvedValueOnce({ data: [], error: null });

    await expect(readRemoteMatch(matchId)).resolves.toEqual({
      status: "error",
      error: "MATCH_NOT_FOUND",
    });
  });

  it("loads a lightweight head and only the event delta", async () => {
    const next = awardRally(journal(), "A", {
      id: eventId,
      createdAt: "2026-10-08T00:01:00.000Z",
    });
    const payload = serializeJournalForSync(next, "account-user", false);
    remote.rpc.mockResolvedValueOnce({
      data: [
        {
          id: matchId,
          sport: "badminton",
          status: "active",
          winner: null,
          current_state: payload.match.current_state,
          last_client_sequence: 1,
          updated_at: "2026-10-08T00:01:00.000Z",
        },
      ],
      error: null,
    });

    const headResult = await readRemoteMatchHead(matchId);

    expect(headResult.status).toBe("loaded");
    expect(remote.rpc).toHaveBeenCalledWith("read_match_head", {
      p_match_id: matchId,
    });

    remote.rpc.mockResolvedValueOnce({ data: payload.events, error: null });
    const deltaResult = await readRemoteMatchEventsSince(matchId, 0);

    expect(deltaResult.status).toBe("loaded");
    if (deltaResult.status === "loaded") {
      const hydrated = appendRemoteEvents(journal(), deltaResult.events);
      expect(hydrated?.events).toHaveLength(1);
      expect(hydrated?.events[0]).toMatchObject({
        clientSequence: 1,
        type: "rally_awarded",
      });
    }
    expect(remote.rpc).toHaveBeenLastCalledWith("read_match_events_since", {
      p_match_id: matchId,
      p_after_sequence: 0,
      p_limit: 2000,
    });
  });
});
