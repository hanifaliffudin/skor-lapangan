import { describe, expect, it } from "vitest";
import { awardRally, type MatchJournal } from "@skor-lapangan/scoring-core";
import { serializeJournalForSync } from "./sync";

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

describe("Supabase sync serialization", () => {
  it("preserves browser-generated match and event UUIDs", () => {
    const next = awardRally(journal(), "A", {
      id: eventId,
      createdAt: "2026-10-08T00:01:00.000Z",
    });

    const payload = serializeJournalForSync(next, "user-1");

    expect(payload.match.id).toBe(matchId);
    expect(payload.match.last_client_sequence).toBe(1);
    expect(payload.match.current_state).toMatchObject({
      matchId,
      points: { A: 1, B: 0 },
    });
    expect(payload.events).toEqual([
      expect.objectContaining({
        id: eventId,
        match_id: matchId,
        owner_id: "user-1",
        client_sequence: 1,
        event_type: "rally_awarded",
        payload: { team: "A" },
      }),
    ]);
  });
});
