import {
  deriveJournal,
  getMatchFormat,
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
  | { status: "control_held"; error: "CONTROL_HELD" }
  | { status: "control_lost"; error: "CONTROL_LOST" }
  | { status: "conflict"; error: "SYNC_CONFLICT" }
  | { status: "match_not_found"; error: "MATCH_NOT_FOUND" }
  | { status: "invalid_remote_match"; error: "INVALID_REMOTE_MATCH" }
  | { status: "failed"; error: string };

export type MatchControlAcquireResult =
  "acquired" | "held" | "not_found" | "complete" | "failed";

export type MatchControlRenewResult = "renewed" | "offline" | "lost" | "failed";

const syncQueues = new Map<string, Promise<SyncResult>>();

function enqueueMatchSync(
  matchId: string,
  task: () => Promise<SyncResult>,
): Promise<SyncResult> {
  const previous = syncQueues.get(matchId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  syncQueues.set(matchId, current);

  const cleanup = () => {
    if (syncQueues.get(matchId) === current) syncQueues.delete(matchId);
  };
  void current.then(cleanup, cleanup);
  return current;
}

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
  afterSequence = 0,
): SyncPayload {
  const { definition, events } = journal;
  const { state } = deriveJournal(journal);
  const lastSequence = events.at(-1)?.clientSequence ?? 0;
  const syncedRuleset =
    definition.ruleset?.source === "guest_custom"
      ? undefined
      : definition.ruleset
        ? {
            id: definition.ruleset.id,
            name: definition.ruleset.name,
            sport: definition.ruleset.sport,
            format: definition.ruleset.format,
            source: definition.ruleset.source,
            version: definition.ruleset.version,
            configuration: definition.ruleset.configuration,
            tennisConfiguration: definition.ruleset.tennisConfiguration,
            padelConfiguration: definition.ruleset.padelConfiguration,
            tableTennisConfiguration:
              definition.ruleset.tableTennisConfiguration,
            squashConfiguration: definition.ruleset.squashConfiguration,
          }
        : undefined;

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
        format: getMatchFormat(definition),
        rulesetId:
          isGuest && definition.ruleset?.source === "guest_custom"
            ? officialRulesetFor(
                definition.sport,
                getMatchFormat(definition),
                definition.ruleset.configuration?.scoringMode,
              ).id
            : definition.rulesetId,
        mode: definition.mode,
        createdAt: definition.createdAt,
        initialServingTeam: definition.initialServingTeam,
        initialServingPlayer: definition.initialServingPlayer,
        ...(isGuest ? {} : { teams: definition.teams }),
        ruleset: syncedRuleset,
        ...(definition.sport === "tennis"
          ? {
              tennisSetOrders: definition.tennisSetOrders,
            }
          : definition.sport === "padel"
            ? {
                padelSetOrders: definition.padelSetOrders,
              }
            : definition.sport === "table_tennis"
              ? {
                  tableTennisOrders: definition.tableTennisOrders,
                }
              : definition.sport === "squash"
                ? {
                    squashGameOrders: definition.squashGameOrders,
                  }
                : {}),
      }),
      status: state.status,
      winner: state.winner,
      current_state: toJson(state),
      last_client_sequence: lastSequence,
      created_at: definition.createdAt,
      is_guest: isGuest,
    },
    events: events
      .filter((event) => event.clientSequence > afterSequence)
      .map((event) => ({
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

async function syncJournalNow(
  journal: MatchJournal,
  userId: string | null,
  isGuest = false,
  controlToken: string | null = null,
  afterSequence = 0,
): Promise<SyncResult> {
  if (!supabase) return { status: "skipped", reason: "not_configured" };
  if (!userId) return { status: "skipped", reason: "not_signed_in" };

  try {
    const payload = serializeJournalForSync(
      journal,
      userId,
      isGuest,
      afterSequence,
    );
    const { data, error } = await supabase.rpc("sync_match_journal", {
      p_match_id: payload.match.id,
      p_owner_id: payload.match.owner_id,
      p_sport: payload.match.sport,
      p_ruleset_id: payload.match.ruleset_id,
      p_mode: payload.match.mode,
      p_definition: payload.match.definition,
      p_status: payload.match.status,
      p_winner: payload.match.winner ?? null,
      p_current_state: payload.match.current_state,
      p_last_client_sequence: payload.match.last_client_sequence,
      p_created_at: payload.match.created_at,
      p_is_guest: payload.match.is_guest,
      p_control_token: controlToken ?? "",
      p_events: toJson(payload.events),
    });

    if (error) {
      if (error.message.includes("CONTROL_HELD")) {
        return { status: "control_held", error: "CONTROL_HELD" };
      }
      if (error.message.includes("CONTROL_LOST")) {
        return { status: "control_lost", error: "CONTROL_LOST" };
      }
      return { status: "failed", error: error.message };
    }
    if (data === "stale" || data === "conflict") {
      return { status: "conflict", error: "SYNC_CONFLICT" };
    }
    if (data !== "applied" && data !== "already_synced") {
      return { status: "failed", error: "Unexpected sync response." };
    }
    return { status: "synced" };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown sync error",
    };
  }
}

export function syncJournal(
  journal: MatchJournal,
  userId: string | null,
  isGuest = false,
  controlToken: string | null = null,
  afterSequence = 0,
): Promise<SyncResult> {
  return enqueueMatchSync(journal.definition.id, () =>
    syncJournalNow(journal, userId, isGuest, controlToken, afterSequence),
  );
}

export async function acquireMatchControl(
  matchId: string,
  controlToken: string,
  force = false,
): Promise<MatchControlAcquireResult> {
  if (!supabase) return "failed";
  const { data, error } = await supabase.rpc("acquire_match_control", {
    p_match_id: matchId,
    p_control_token: controlToken,
    p_force: force,
  });
  if (error) return "failed";
  if (
    data === "acquired" ||
    data === "held" ||
    data === "not_found" ||
    data === "complete"
  ) {
    return data;
  }
  return "failed";
}

export async function renewMatchControl(
  matchId: string,
  controlToken: string,
): Promise<MatchControlRenewResult> {
  if (!supabase) return "failed";
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "offline";
  }
  try {
    const { data, error } = await supabase.rpc("renew_match_control", {
      p_match_id: matchId,
      p_control_token: controlToken,
    });
    if (error) return "failed";
    return data ? "renewed" : "lost";
  } catch {
    return typeof navigator !== "undefined" && !navigator.onLine
      ? "offline"
      : "failed";
  }
}

export async function releaseMatchControl(
  matchId: string,
  controlToken: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.rpc("release_match_control", {
    p_match_id: matchId,
    p_control_token: controlToken,
  });
  return Boolean(data);
}
