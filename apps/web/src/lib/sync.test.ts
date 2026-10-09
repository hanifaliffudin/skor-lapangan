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

    const retryPayload = serializeJournalForSync(next, "user-1");
    expect(retryPayload.match.id).toBe(payload.match.id);
    expect(retryPayload.events.map((event) => event.id)).toEqual(
      payload.events.map((event) => event.id),
    );
  });

  it("keeps guest names and custom rule configuration out of server payloads", () => {
    const guestJournal = journal();
    guestJournal.definition.teams.A.players[0].name = "Private Player Name";
    guestJournal.definition.ruleset = {
      id: "guest-custom-rules-1",
      name: "Club night",
      sport: "badminton",
      source: "guest_custom",
      version: 1,
      configuration: {
        pointsToWin: 15,
        winBy: 2,
        maxPoints: 21,
        bestOf: 3,
        scoringMode: "rally",
        serversPerTurn: 1,
        openingServerNumber: 1,
      },
    };

    const payload = serializeJournalForSync(guestJournal, "guest-user", true);

    expect(payload.match.is_guest).toBe(true);
    expect(payload.match.ruleset_id).toBe("guest-custom-local");
    expect(payload.match.definition).not.toHaveProperty("teams");
    expect(payload.match.definition).not.toHaveProperty("ruleset");
    expect(JSON.stringify(payload.match)).not.toContain("Private Player Name");
    expect(JSON.stringify(payload.match)).not.toContain("pointsToWin");
  });
});
