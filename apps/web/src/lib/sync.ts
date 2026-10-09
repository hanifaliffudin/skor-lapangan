import {
  deriveJournal,
  officialRulesetFor,
  type MatchEvent,
  type MatchJournal,
} from "@skor-lapangan/scoring-core";
import type { Database, Json } from "./database.types";
import { supabase } from "./supabase";

type MatchInsert = Database["public"]["Tables"]["matches"]["Insert"];
type EventInsert = Database["public"]["Tables"]["match_events"]["Insert"];

export interface SyncPayload {
  match: MatchInsert;
  events: EventInsert[];
}

export type SyncResult =
  | { status: "synced" }
  | { status: "skipped"; reason: "not_configured" | "not_signed_in" }
  | { status: "failed"; error: string };

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function eventPayload(event: MatchEvent): Json {
  const {
    id: _id,
    matchId: _matchId,
    clientSequence: _clientSequence,
    createdAt: _createdAt,
    type: _type,
    ...payload
  } = event;
  return toJson(payload);
}

export function serializeJournalForSync(
  journal: MatchJournal,
  userId: string,
  isGuest = false,
): SyncPayload {
  const { definition, events } = journal;
  const { state } = deriveJournal(journal);
  const lastSequence = events.at(-1)?.clientSequence ?? 0;

  return {
    match: {
      id: definition.id,
      owner_id: userId,
      sport: definition.sport,
      ruleset_id:
        isGuest && definition.ruleset?.source === "guest_custom"
          ? "guest-custom-local"
          : definition.rulesetId,
      mode: definition.mode,
      definition: toJson({
        id: definition.id,
        sport: definition.sport,
        rulesetId:
          isGuest && definition.ruleset?.source === "guest_custom"
            ? officialRulesetFor(definition.sport).id
            : definition.rulesetId,
        mode: definition.mode,
        createdAt: definition.createdAt,
        initialServingTeam: definition.initialServingTeam,
        initialServingPlayer: definition.initialServingPlayer,
      }),
      status: state.status,
      winner: state.winner,
      current_state: toJson(state),
      last_client_sequence: lastSequence,
      created_at: definition.createdAt,
      is_guest: isGuest,
    },
    events: events.map((event) => ({
      id: event.id,
      match_id: event.matchId,
      owner_id: userId,
      client_sequence: event.clientSequence,
      event_type: event.type,
      payload: eventPayload(event),
      created_at: event.createdAt,
    })),
  };
}

export async function syncJournal(
  journal: MatchJournal,
  userId: string | null,
  isGuest = false,
): Promise<SyncResult> {
  if (!supabase) return { status: "skipped", reason: "not_configured" };
  if (!userId) return { status: "skipped", reason: "not_signed_in" };

  try {
    const payload = serializeJournalForSync(journal, userId, isGuest);
    const { error: matchError } = await supabase
      .from("matches")
      .upsert(payload.match, { onConflict: "id" });

    if (matchError) return { status: "failed", error: matchError.message };
    if (payload.events.length === 0) return { status: "synced" };

    const { error: eventsError } = await supabase
      .from("match_events")
      .upsert(payload.events, { ignoreDuplicates: true, onConflict: "id" });

    return eventsError
      ? { status: "failed", error: eventsError.message }
      : { status: "synced" };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown sync error",
    };
  }
}
