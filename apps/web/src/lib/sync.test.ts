import { describe, expect, it } from "vitest";
import {
  awardRally,
  officialRulesetFor,
  type MatchJournal,
} from "@skor-lapangan/scoring-core";
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
      format: "doubles",
      points: { A: 1, B: 0 },
    });
    expect(payload.match.definition).toMatchObject({ format: "doubles" });
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
    guestJournal.definition.format = "singles";
    guestJournal.definition.teams = {
      A: {
        name: "Team A",
        players: [{ id: "a-1", name: "Private Player Name" }],
      },
      B: {
        name: "Team B",
        players: [{ id: "b-1", name: "Private Opponent Name" }],
      },
    };
    guestJournal.definition.ruleset = {
      id: "guest-custom-rules-1",
      name: "Club night",
      sport: "badminton",
      format: "singles",
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
    expect(payload.match.definition).toMatchObject({
      format: "singles",
      rulesetId: "bwf-singles-3x21-2025",
    });
    expect(payload.match.current_state).toMatchObject({ format: "singles" });
    expect(payload.match.definition).not.toHaveProperty("teams");
    expect(payload.match.definition).not.toHaveProperty("ruleset");
    expect(JSON.stringify(payload.match)).not.toContain("Private Player Name");
    expect(JSON.stringify(payload.match)).not.toContain(
      "Private Opponent Name",
    );
    expect(JSON.stringify(payload.match)).not.toContain("pointsToWin");
  });

  it("syncs Tennis rules and score state without mixed-doubles labels", () => {
    const official = officialRulesetFor("tennis");
    const tennisJournal: MatchJournal = {
      definition: {
        id: matchId,
        sport: "tennis",
        format: "mixed_doubles",
        rulesetId: official.id,
        ruleset: {
          id: official.id,
          name: official.name,
          sport: "tennis",
          format: "mixed_doubles",
          source: "official",
          version: official.version,
          tennisConfiguration: {
            bestOf: 3,
            gameScoring: "no_ad",
            setScoring: "tiebreak",
            finalSetScoring: "match_tiebreak",
            matchTieBreakPoints: 10,
          },
        },
        mode: "casual",
        createdAt: "2026-10-12T00:00:00.000Z",
        initialServingTeam: "A",
        initialServingPlayer: 0,
        tennisSetOrders: {
          serviceOrder: { A: [0, 1], B: [1, 0] },
          deuceReceiver: { A: 0, B: 1 },
        },
        tennisLocalRoles: {
          A: ["woman", "man"],
          B: ["man", "woman"],
        },
        teams: {
          A: {
            name: "Team A",
            players: [
              { id: "a1", name: "Private A" },
              { id: "a2", name: "Private A2" },
            ],
          },
          B: {
            name: "Team B",
            players: [
              { id: "b1", name: "Private B" },
              { id: "b2", name: "Private B2" },
            ],
          },
        },
      },
      events: [],
    };

    const payload = serializeJournalForSync(tennisJournal, "user-1", true);
    const serialized = JSON.stringify(payload);
    expect(payload.match.definition).toMatchObject({
      sport: "tennis",
      format: "mixed_doubles",
      ruleset: {
        id: "itf-tennis-2026",
        tennisConfiguration: {
          finalSetScoring: "match_tiebreak",
          matchTieBreakPoints: 10,
        },
      },
    });
    expect(payload.match.current_state).toMatchObject({
      sport: "tennis",
      tennis: {
        setNumber: 1,
        setOrders: { deuceReceiver: { A: 0, B: 1 } },
      },
    });
    expect(serialized).not.toContain("tennisLocalRoles");
    expect(serialized).not.toContain("woman");
    expect(serialized).not.toContain("Private A");
  });

  it("syncs the FIP Padel snapshot and strips mixed roles and player names", () => {
    const official = officialRulesetFor("padel", "mixed_doubles");
    const padelJournal: MatchJournal = {
      definition: {
        id: matchId,
        sport: "padel",
        format: "mixed_doubles",
        rulesetId: official.id,
        ruleset: {
          id: official.id,
          name: official.name,
          sport: "padel",
          format: "mixed_doubles",
          source: official.source,
          version: official.version,
          padelConfiguration: {
            gameScoring: "star_point",
            setScoring: "mini",
            finalSetScoring: "match_tiebreak",
            matchTieBreakPoints: 10,
          },
        },
        mode: "casual",
        createdAt: "2026-10-12T00:00:00.000Z",
        initialServingTeam: "A",
        initialServingPlayer: 0,
        padelSetOrders: {
          serviceOrder: { A: [0, 1], B: [1, 0] },
          deuceReceiver: { A: 0, B: 1 },
        },
        padelLocalRoles: {
          A: ["woman", "man"],
          B: ["man", "woman"],
        },
        teams: {
          A: {
            name: "Private Team A",
            players: [
              { id: "a1", name: "Private A" },
              { id: "a2", name: "Private A2" },
            ],
          },
          B: {
            name: "Private Team B",
            players: [
              { id: "b1", name: "Private B" },
              { id: "b2", name: "Private B2" },
            ],
          },
        },
      },
      events: [],
    };

    const payload = serializeJournalForSync(padelJournal, "guest-user", true);
    const serialized = JSON.stringify(payload);
    expect(payload.match.ruleset_id).toBe("fip-padel-2026");
    expect(payload.match.definition).toMatchObject({
      sport: "padel",
      format: "mixed_doubles",
      padelSetOrders: { deuceReceiver: { A: 0, B: 1 } },
      ruleset: {
        id: "fip-padel-2026",
        source: "official",
        padelConfiguration: {
          setScoring: "mini",
          finalSetScoring: "match_tiebreak",
          matchTieBreakPoints: 10,
        },
      },
    });
    expect(payload.match.current_state).toMatchObject({
      sport: "padel",
      padel: {
        gameScoring: "star_point",
        setOrders: { deuceReceiver: { A: 0, B: 1 } },
      },
    });
    expect(serialized).not.toContain("padelLocalRoles");
    expect(serialized).not.toContain("woman");
    expect(serialized).not.toContain("Private A");
  });
});
