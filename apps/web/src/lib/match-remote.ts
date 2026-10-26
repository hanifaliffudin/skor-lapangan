import {
  deriveJournal,
  type MatchEvent,
  type MatchDefinition,
  type MatchJournal,
} from "@skor-lapangan/scoring-core";
import type { Json } from "./database.types";
import { isMatchJournal } from "./session";
import { supabase } from "./supabase";

const matchEventTypes = new Set<MatchEvent["type"]>([
  "rally_awarded",
  "state_overridden",
  "tennis_set_orders_confirmed",
  "tennis_deciding_side_selected",
  "tennis_score_overridden",
  "padel_set_orders_confirmed",
  "padel_deciding_side_selected",
  "padel_score_overridden",
  "table_tennis_game_orders_confirmed",
  "squash_game_orders_confirmed",
  "squash_service_box_selected",
  "undo_applied",
  "redo_applied",
]);

export type RemoteMatchErrorCode =
  "REMOTE_UNAVAILABLE" | "MATCH_NOT_FOUND" | "INVALID_REMOTE_MATCH";

interface RemoteRpcError {
  code?: string;
  message?: string;
  status?: number;
}

function classifyRemoteRpcError(
  error: RemoteRpcError | null,
): RemoteMatchErrorCode {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "REMOTE_UNAVAILABLE";
  }

  const message = error?.message?.toLowerCase() ?? "";
  if (
    (typeof error?.status === "number" && error.status >= 500) ||
    error?.code === "PGRST003" ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("connection")
  ) {
    return "REMOTE_UNAVAILABLE";
  }

  return "MATCH_NOT_FOUND";
}

export interface RemoteMatchSnapshot {
  journal: MatchJournal;
  sequence: number;
  status: "active" | "complete";
  updatedAt: string;
}

export interface RemoteMatchHead {
  status: "active" | "complete";
  currentState: Json;
  sequence: number;
  updatedAt: string;
}

const MAX_REMOTE_EVENTS = 50_000;

export type RemoteMatchResult =
  | { status: "loaded"; snapshot: RemoteMatchSnapshot }
  | { status: "error"; error: RemoteMatchErrorCode };

export type RemoteMatchHeadResult =
  | { status: "loaded"; head: RemoteMatchHead }
  | { status: "error"; error: RemoteMatchErrorCode };

export type RemoteMatchEventsResult =
  | { status: "loaded"; events: MatchEvent[] }
  | { status: "error"; error: RemoteMatchErrorCode };

export type RemoteMatchDefinitionResult =
  | { status: "loaded"; definition: MatchDefinition }
  | { status: "error"; error: RemoteMatchErrorCode };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMatchEventType(value: unknown): value is MatchEvent["type"] {
  return (
    typeof value === "string" &&
    matchEventTypes.has(value as MatchEvent["type"])
  );
}

function isTeamId(value: unknown): value is "A" | "B" {
  return value === "A" || value === "B";
}

function isCourtSide(value: unknown): value is "left" | "right" {
  return value === "left" || value === "right";
}

function isPlayerIndex(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isTeamDefinition(value: unknown): boolean {
  if (!isRecord(value) || typeof value.name !== "string") return false;
  return (
    Array.isArray(value.players) &&
    (value.players.length === 1 || value.players.length === 2) &&
    value.players.every(
      (player) =>
        isRecord(player) &&
        typeof player.id === "string" &&
        player.id.length > 0 &&
        typeof player.name === "string",
    )
  );
}

function isScoreRecord(value: unknown): value is { A: number; B: number } {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.A) &&
    isNonNegativeInteger(value.B)
  );
}

function isPlayerPair(value: unknown): value is [0 | 1, 0 | 1] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isPlayerIndex(value[0]) &&
    isPlayerIndex(value[1])
  );
}

function isPlayerRef(
  value: unknown,
): value is { team: "A" | "B"; player: 0 | 1 } {
  return isRecord(value) && isTeamId(value.team) && isPlayerIndex(value.player);
}

function isSetOrders(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const serviceOrder = value.serviceOrder;
  const deuceReceiver = value.deuceReceiver;
  return (
    isRecord(serviceOrder) &&
    isPlayerPair(serviceOrder.A) &&
    isPlayerPair(serviceOrder.B) &&
    isRecord(deuceReceiver) &&
    isPlayerIndex(deuceReceiver.A) &&
    isPlayerIndex(deuceReceiver.B)
  );
}

function isTableTennisOrders(value: unknown): boolean {
  return (
    isRecord(value) &&
    isPlayerRef(value.firstServer) &&
    isPlayerRef(value.firstReceiver)
  );
}

function isSquashOrders(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const serviceOrder = value.serviceOrder;
  const receiverBySide = value.receiverBySide;
  return (
    isRecord(serviceOrder) &&
    isPlayerPair(serviceOrder.A) &&
    isPlayerPair(serviceOrder.B) &&
    isRecord(receiverBySide) &&
    isRecord(receiverBySide.A) &&
    isPlayerIndex(receiverBySide.A.left) &&
    isPlayerIndex(receiverBySide.A.right) &&
    isRecord(receiverBySide.B) &&
    isPlayerIndex(receiverBySide.B.left) &&
    isPlayerIndex(receiverBySide.B.right) &&
    isCourtSide(value.openingServiceBox)
  );
}

function isRemoteEvent(value: unknown): value is MatchEvent {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "rally_awarded":
      return isTeamId(value.team);
    case "state_overridden":
      return isScoreRecord(value.points);
    case "tennis_set_orders_confirmed":
    case "padel_set_orders_confirmed":
      return isSetOrders(value.orders);
    case "tennis_deciding_side_selected":
    case "padel_deciding_side_selected":
    case "squash_service_box_selected":
      return isCourtSide(value.side);
    case "tennis_score_overridden":
      return (
        isScoreRecord(value.pointScore) &&
        (value.advantage === null || isTeamId(value.advantage)) &&
        (value.tieBreakScore === null || isScoreRecord(value.tieBreakScore)) &&
        isNonNegativeInteger(value.gamePointCount)
      );
    case "padel_score_overridden":
      return (
        isScoreRecord(value.pointScore) &&
        (value.advantage === null || isTeamId(value.advantage)) &&
        isNonNegativeInteger(value.starDeuces) &&
        (value.tieBreakScore === null || isScoreRecord(value.tieBreakScore)) &&
        isNonNegativeInteger(value.gamePointCount)
      );
    case "table_tennis_game_orders_confirmed":
      return isTableTennisOrders(value.orders);
    case "squash_game_orders_confirmed":
      return isSquashOrders(value.orders);
    case "undo_applied":
    case "redo_applied":
      return (
        typeof value.targetEventId === "string" &&
        value.targetEventId.length > 0
      );
    default:
      return false;
  }
}

function eventFromRemote(value: unknown, matchId: string): MatchEvent | null {
  if (!isRecord(value)) return null;
  const payload = value.payload;
  if (
    typeof value.id !== "string" ||
    value.match_id !== matchId ||
    !Number.isSafeInteger(value.client_sequence) ||
    (value.client_sequence as number) < 1 ||
    !isMatchEventType(value.event_type) ||
    !isTimestamp(value.created_at) ||
    !isRecord(payload)
  ) {
    return null;
  }

  const event = {
    ...payload,
    id: value.id,
    matchId,
    clientSequence: value.client_sequence as number,
    type: value.event_type,
    createdAt: value.created_at,
  };
  return isRemoteEvent(event) ? event : null;
}

function journalFromDefinitionAndEvents(
  definition: unknown,
  events: MatchEvent[],
  matchId: string,
): MatchJournal | null {
  const teams = isRecord(definition) ? definition.teams : null;
  if (
    !isRecord(teams) ||
    !isTeamDefinition(teams.A) ||
    !isTeamDefinition(teams.B)
  ) {
    return null;
  }
  if (events.some((event, index) => event.clientSequence !== index + 1)) {
    return null;
  }

  const journal = {
    definition,
    events,
  } as unknown as MatchJournal;

  if (!isMatchJournal(journal, matchId)) return null;
  try {
    deriveJournal(journal);
  } catch {
    return null;
  }
  return journal;
}

function journalFromRemote(
  value: unknown,
  matchId: string,
): MatchJournal | null {
  if (!isRecord(value) || !Array.isArray(value.events)) return null;
  const events = value.events.map((event) => eventFromRemote(event, matchId));
  if (events.some((event): event is null => event === null)) return null;
  return journalFromDefinitionAndEvents(
    value.definition,
    events as MatchEvent[],
    matchId,
  );
}

function jsonEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => jsonEqual(value, right[index]))
    );
  }
  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] && jsonEqual(left[key], right[key]),
      )
    );
  }
  return false;
}

export function journalsHaveSameState(
  left: MatchJournal,
  right: MatchJournal,
): boolean {
  try {
    return jsonEqual(deriveJournal(left).state, deriveJournal(right).state);
  } catch {
    return false;
  }
}

export function matchHeadHasSameState(
  journal: MatchJournal,
  head: RemoteMatchHead,
): boolean {
  try {
    return jsonEqual(deriveJournal(journal).state, head.currentState);
  } catch {
    return false;
  }
}

export function journalSequence(journal: MatchJournal): number {
  return journal.events.at(-1)?.clientSequence ?? 0;
}

function isRemoteStatus(value: unknown): value is "active" | "complete" {
  return value === "active" || value === "complete";
}

export async function readRemoteMatchHead(
  matchId: string,
): Promise<RemoteMatchHeadResult> {
  if (!supabase) return { status: "error", error: "REMOTE_UNAVAILABLE" };

  const { data, error } = await supabase.rpc("read_match_head", {
    p_match_id: matchId,
  });
  if (error) {
    return { status: "error", error: classifyRemoteRpcError(error) };
  }

  const row = data?.[0];
  if (!row || row.id !== matchId) {
    return { status: "error", error: "MATCH_NOT_FOUND" };
  }
  if (
    !isRemoteStatus(row.status) ||
    !isRecord(row.current_state) ||
    row.current_state.status !== row.status ||
    !Number.isSafeInteger(row.last_client_sequence) ||
    row.last_client_sequence < 0 ||
    !isTimestamp(row.updated_at)
  ) {
    return { status: "error", error: "INVALID_REMOTE_MATCH" };
  }

  return {
    status: "loaded",
    head: {
      status: row.status,
      currentState: row.current_state,
      sequence: row.last_client_sequence,
      updatedAt: row.updated_at,
    },
  };
}

export async function readRemoteMatchEventsSince(
  matchId: string,
  afterSequence: number,
): Promise<RemoteMatchEventsResult> {
  if (!supabase) return { status: "error", error: "REMOTE_UNAVAILABLE" };

  const { data, error } = await supabase.rpc("read_match_events_since", {
    p_match_id: matchId,
    p_after_sequence: afterSequence,
    p_limit: 2000,
  });
  if (error) {
    return { status: "error", error: classifyRemoteRpcError(error) };
  }

  const events = (data ?? []).map((event) => eventFromRemote(event, matchId));
  if (events.some((event): event is null => event === null)) {
    return { status: "error", error: "INVALID_REMOTE_MATCH" };
  }

  return {
    status: "loaded",
    events: events as MatchEvent[],
  };
}

export function appendRemoteEvents(
  journal: MatchJournal,
  events: MatchEvent[],
): MatchJournal | null {
  let expectedSequence = journalSequence(journal) + 1;
  for (const event of events) {
    if (event.clientSequence !== expectedSequence) return null;
    expectedSequence += 1;
  }
  if (events.length === 0) return journal;

  const nextJournal = {
    ...journal,
    events: [...journal.events, ...events],
  };
  if (!isMatchJournal(nextJournal, journal.definition.id)) return null;
  try {
    deriveJournal(nextJournal);
  } catch {
    return null;
  }
  return nextJournal;
}

function isMissingBoundedReader(error: RemoteRpcError | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "PGRST202" ||
    (message.includes("read_match_definition") &&
      message.includes("does not exist"))
  );
}

interface RemoteSnapshotBase {
  id: string;
  status: string;
  updated_at: string;
  last_client_sequence: number;
  current_state: Json;
  definition: Json;
}

interface RemoteSnapshotRow extends RemoteSnapshotBase {
  events: Json;
}

function validateRemoteSnapshot(
  row: RemoteSnapshotRow,
  matchId: string,
): RemoteMatchResult {
  if (!row) return { status: "error", error: "MATCH_NOT_FOUND" };

  const journal = journalFromRemote(
    {
      definition: row.definition,
      events: row.events,
    },
    matchId,
  );
  return validateHydratedSnapshot(row, journal, matchId);
}

function validateHydratedSnapshot(
  row: RemoteSnapshotBase,
  journal: MatchJournal | null,
  matchId: string,
): RemoteMatchResult {
  if (
    !journal ||
    row.id !== matchId ||
    (row.status !== "active" && row.status !== "complete") ||
    !isTimestamp(row.updated_at) ||
    Number.isSafeInteger(row.last_client_sequence) === false ||
    row.last_client_sequence < 0 ||
    row.last_client_sequence !== journalSequence(journal) ||
    !jsonEqual(deriveJournal(journal).state, row.current_state) ||
    deriveJournal(journal).state.status !== row.status
  ) {
    return { status: "error", error: "INVALID_REMOTE_MATCH" };
  }

  return {
    status: "loaded",
    snapshot: {
      journal,
      sequence: row.last_client_sequence,
      status: row.status,
      updatedAt: row.updated_at,
    },
  };
}

async function readLegacyRemoteMatch(
  matchId: string,
): Promise<RemoteMatchResult> {
  if (!supabase) return { status: "error", error: "REMOTE_UNAVAILABLE" };
  const { data, error } = await supabase.rpc("read_match_journal", {
    p_match_id: matchId,
  });
  if (error) {
    return { status: "error", error: classifyRemoteRpcError(error) };
  }
  const row = data?.[0];
  if (!row) return { status: "error", error: "MATCH_NOT_FOUND" };
  return validateRemoteSnapshot(row, matchId);
}

export async function readRemoteMatch(
  matchId: string,
): Promise<RemoteMatchResult> {
  if (!supabase) return { status: "error", error: "REMOTE_UNAVAILABLE" };

  const { data, error } = await supabase.rpc("read_match_definition", {
    p_match_id: matchId,
  });
  if (error) {
    if (isMissingBoundedReader(error)) return readLegacyRemoteMatch(matchId);
    return { status: "error", error: classifyRemoteRpcError(error) };
  }

  const row = data?.[0];
  if (!row) return { status: "error", error: "MATCH_NOT_FOUND" };
  if ("events" in row && !("event_count" in row)) {
    return validateRemoteSnapshot(row, matchId);
  }
  if (
    typeof row.event_count !== "number" ||
    row.event_count < 0 ||
    row.event_count > MAX_REMOTE_EVENTS ||
    row.event_count !== row.last_client_sequence
  ) {
    return { status: "error", error: "INVALID_REMOTE_MATCH" };
  }

  const events: MatchEvent[] = [];
  let afterSequence = 0;
  while (afterSequence < row.last_client_sequence) {
    const result = await readRemoteMatchEventsSince(matchId, afterSequence);
    if (result.status === "error") return result;
    if (result.events.length === 0) {
      return { status: "error", error: "INVALID_REMOTE_MATCH" };
    }
    events.push(...result.events);
    afterSequence = events.at(-1)?.clientSequence ?? afterSequence;
    if (events.length > MAX_REMOTE_EVENTS) {
      return { status: "error", error: "INVALID_REMOTE_MATCH" };
    }
  }

  return validateHydratedSnapshot(
    row,
    journalFromDefinitionAndEvents(row.definition, events, matchId),
    matchId,
  );
}

export async function readRemoteMatchDefinition(
  matchId: string,
): Promise<RemoteMatchDefinitionResult> {
  if (!supabase) return { status: "error", error: "REMOTE_UNAVAILABLE" };
  const { data, error } = await supabase.rpc("read_match_definition", {
    p_match_id: matchId,
  });
  if (error) return { status: "error", error: classifyRemoteRpcError(error) };
  const row = data?.[0];
  if (!row) return { status: "error", error: "MATCH_NOT_FOUND" };
  const journal = journalFromDefinitionAndEvents(row.definition, [], matchId);
  if (!journal) return { status: "error", error: "INVALID_REMOTE_MATCH" };
  return { status: "loaded", definition: journal.definition };
}
