import type {
  MatchJournal,
  MatchFormat,
  MatchMode,
  Sport,
} from "@skor-lapangan/scoring-core";
import {
  matchStore,
  matchStoreSchemaVersion,
  type MatchSyncMetadata,
  type StoredMatchRecord,
} from "./matchStore";

const draftKey = "skor-lapangan:setup-draft";
const matchPrefix = "skor-lapangan:match:";
export const guestMatchRetentionMs = 12 * 60 * 60 * 1000;

type StoredMatch = Omit<StoredMatchRecord, "matchId">;

const currentMatchSchemaVersion = matchStoreSchemaVersion;

const cachedMatches = new Map<string, StoredMatchRecord>();

export interface StoredMatchInfo {
  persistent: boolean;
  ownerId: string | null;
  sync: MatchSyncMetadata;
}

export interface SaveMatchOptions {
  ownerId?: string;
  persistent?: boolean;
  sync?: MatchSyncMetadata;
}

function defaultSyncMetadata(): MatchSyncMetadata {
  return {
    status: "local",
    lastServerSequence: 0,
    pendingFromSequence: null,
    updatedAt: new Date().toISOString(),
  };
}

function isMatchSyncMetadata(value: unknown): value is MatchSyncMetadata {
  if (!isRecord(value)) return false;
  return (
    (value.status === "local" || value.status === "pending") &&
    typeof value.lastServerSequence === "number" &&
    Number.isSafeInteger(value.lastServerSequence) &&
    value.lastServerSequence >= 0 &&
    (value.pendingFromSequence === null ||
      (typeof value.pendingFromSequence === "number" &&
        Number.isSafeInteger(value.pendingFromSequence) &&
        value.pendingFromSequence > 0)) &&
    typeof value.updatedAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isMatchJournal(
  value: unknown,
  matchId: string,
): value is MatchJournal {
  if (!isRecord(value)) return false;
  const definition = value.definition;
  const events = value.events;
  if (!isRecord(definition) || !Array.isArray(events)) return false;
  if (
    definition.id !== matchId ||
    typeof definition.sport !== "string" ||
    typeof definition.rulesetId !== "string" ||
    (definition.mode !== "casual" && definition.mode !== "referee") ||
    typeof definition.createdAt !== "string" ||
    (definition.initialServingTeam !== "A" &&
      definition.initialServingTeam !== "B") ||
    (definition.initialServingPlayer !== 0 &&
      definition.initialServingPlayer !== 1) ||
    !isRecord(definition.teams) ||
    !isRecord(definition.teams.A) ||
    !isRecord(definition.teams.B)
  ) {
    return false;
  }

  return events.every((event) => {
    if (!isRecord(event)) return false;
    return (
      typeof event.id === "string" &&
      event.matchId === matchId &&
      typeof event.clientSequence === "number" &&
      Number.isSafeInteger(event.clientSequence) &&
      event.clientSequence > 0 &&
      typeof event.type === "string" &&
      typeof event.createdAt === "string"
    );
  });
}

export interface SetupDraft {
  sport: Sport;
  format: MatchFormat;
  mode: MatchMode;
  communityRuleId?: string;
}

export function saveDraft(draft: SetupDraft): void {
  window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
}

export function loadDraft(): SetupDraft | null {
  const value = window.sessionStorage.getItem(draftKey);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as SetupDraft;
    const format = parsed.format === undefined ? "doubles" : parsed.format;
    if (
      (parsed.sport === "badminton" ||
        parsed.sport === "pickleball" ||
        parsed.sport === "tennis" ||
        parsed.sport === "padel" ||
        parsed.sport === "table_tennis" ||
        parsed.sport === "squash") &&
      (format === "singles" ||
        format === "doubles" ||
        ((parsed.sport === "tennis" || parsed.sport === "padel") &&
          format === "mixed_doubles")) &&
      (parsed.mode === "casual" || parsed.mode === "referee") &&
      (parsed.communityRuleId === undefined ||
        typeof parsed.communityRuleId === "string")
    ) {
      return { ...parsed, format, mode: "casual" };
    }
  } catch {
    return null;
  }
  return null;
}

export function saveMatch(
  journal: MatchJournal,
  options: SaveMatchOptions = {},
): boolean {
  const stored: StoredMatch = {
    schemaVersion: currentMatchSchemaVersion,
    journal,
    ...(options.persistent
      ? {}
      : {
          expiresAt: new Date(Date.now() + guestMatchRetentionMs).toISOString(),
        }),
    ...(options.ownerId ? { ownerId: options.ownerId } : {}),
    sync: options.sync ?? defaultSyncMetadata(),
  };
  try {
    window.localStorage.setItem(
      `${matchPrefix}${journal.definition.id}`,
      JSON.stringify(stored),
    );
    return true;
  } catch {
    return false;
  }
}

function storedRecord(
  journal: MatchJournal,
  options: SaveMatchOptions = {},
): StoredMatchRecord {
  return {
    matchId: journal.definition.id,
    schemaVersion: currentMatchSchemaVersion,
    journal,
    ...(options.persistent
      ? {}
      : {
          expiresAt: new Date(Date.now() + guestMatchRetentionMs).toISOString(),
        }),
    ...(options.ownerId ? { ownerId: options.ownerId } : {}),
    sync: options.sync ?? defaultSyncMetadata(),
  };
}

function legacyKey(matchId: string): string {
  return `${matchPrefix}${matchId}`;
}

function removeLegacyMatch(matchId: string): void {
  window.localStorage.removeItem(legacyKey(matchId));
  window.sessionStorage.removeItem(legacyKey(matchId));
}

function readLegacyRecord(matchId: string): StoredMatchRecord | null {
  const value =
    window.localStorage.getItem(legacyKey(matchId)) ??
    window.sessionStorage.getItem(legacyKey(matchId));
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    const stored =
      isRecord(parsed) && "journal" in parsed
        ? (parsed as Partial<StoredMatch>)
        : null;
    const journal = stored?.journal ?? parsed;
    if (
      stored &&
      typeof stored.schemaVersion === "number" &&
      stored.schemaVersion > currentMatchSchemaVersion
    ) {
      return null;
    }
    return {
      matchId,
      schemaVersion:
        typeof stored?.schemaVersion === "number"
          ? stored.schemaVersion
          : currentMatchSchemaVersion,
      journal: journal as MatchJournal,
      ...(typeof stored?.expiresAt === "string"
        ? { expiresAt: stored.expiresAt }
        : {}),
      ...(typeof stored?.ownerId === "string"
        ? { ownerId: stored.ownerId }
        : {}),
      ...(isMatchSyncMetadata(stored?.sync) ? { sync: stored.sync } : {}),
    };
  } catch {
    return null;
  }
}

function validRecord(record: StoredMatchRecord, matchId: string): boolean {
  return (
    record.matchId === matchId &&
    record.schemaVersion <= currentMatchSchemaVersion &&
    isMatchJournal(record.journal, matchId) &&
    (!record.sync || isMatchSyncMetadata(record.sync))
  );
}

export async function saveMatchAsync(
  journal: MatchJournal,
  options: SaveMatchOptions = {},
): Promise<boolean> {
  const record = storedRecord(journal, options);
  const usesLegacyFallback = typeof indexedDB === "undefined";
  if (usesLegacyFallback && !saveMatch(journal, options)) return false;
  try {
    await matchStore.put(record);
    cachedMatches.set(record.matchId, record);
    if (usesLegacyFallback) {
      return true;
    } else {
      removeLegacyMatch(record.matchId);
    }
    return true;
  } catch {
    return false;
  }
}

export async function loadMatchAsync(
  matchId: string,
): Promise<MatchJournal | null> {
  const durable = await matchStore.get(matchId);
  if (durable) {
    if (!validRecord(durable, matchId)) {
      await matchStore.remove(matchId);
      cachedMatches.delete(matchId);
      return null;
    }
    if (durable.expiresAt && Date.parse(durable.expiresAt) <= Date.now()) {
      await matchStore.remove(matchId);
      cachedMatches.delete(matchId);
      return null;
    }
    cachedMatches.set(matchId, durable);
    return durable.journal;
  }

  const legacy = readLegacyRecord(matchId);
  if (!legacy) return null;
  if (!validRecord(legacy, matchId)) {
    removeLegacyMatch(matchId);
    return null;
  }
  if (legacy.expiresAt && Date.parse(legacy.expiresAt) <= Date.now()) {
    removeLegacyMatch(matchId);
    return null;
  }

  await matchStore.put(legacy);
  cachedMatches.set(matchId, legacy);
  if (typeof indexedDB !== "undefined") removeLegacyMatch(matchId);
  return legacy.journal;
}

export async function listStoredMatchesAsync(): Promise<MatchJournal[]> {
  const durableRecords = await matchStore.list();
  const records = new Map(
    durableRecords.map((record) => [record.matchId, record]),
  );

  for (const matchId of legacyMatchIds()) {
    if (records.has(matchId)) continue;
    try {
      await loadMatchAsync(matchId);
      const migrated = cachedMatches.get(matchId);
      if (migrated) records.set(matchId, migrated);
    } catch {
      // Keep an un-migrated legacy record available for the next attempt.
    }
  }

  const journals = [...records.values()]
    .filter(
      (record) =>
        validRecord(record, record.matchId) &&
        (!record.expiresAt || Date.parse(record.expiresAt) > Date.now()),
    )
    .map((record) => {
      cachedMatches.set(record.matchId, record);
      return record.journal;
    });
  return journals.sort((left, right) =>
    right.definition.createdAt.localeCompare(left.definition.createdAt),
  );
}

export async function listPendingMatchesAsync(): Promise<
  Array<{ journal: MatchJournal; info: StoredMatchInfo }>
> {
  const journals = await listStoredMatchesAsync();
  return journals.flatMap((journal) => {
    const info = getStoredMatchInfo(journal.definition.id);
    return info?.sync.status === "pending" ? [{ journal, info }] : [];
  });
}

export async function hasActiveOrPendingMatches(): Promise<boolean> {
  const { deriveJournal } = await import("@skor-lapangan/scoring-core");
  const matches = await listStoredMatchesAsync();
  return matches.some((journal) => {
    const state = deriveJournal(journal).state;
    return (
      state.status === "active" ||
      getStoredMatchInfo(journal.definition.id)?.sync.status === "pending"
    );
  });
}

export function loadMatch(matchId: string): MatchJournal | null {
  if (typeof indexedDB !== "undefined") {
    const cached = cachedMatches.get(matchId);
    if (cached) {
      if (cached.expiresAt && Date.parse(cached.expiresAt) <= Date.now()) {
        cachedMatches.delete(matchId);
        void matchStore.remove(matchId).catch(() => undefined);
        return null;
      }
      return cached.journal;
    }
  }

  const legacy = readLegacyRecord(matchId);
  if (!legacy) return null;
  if (
    !validRecord(legacy, matchId) ||
    (legacy.expiresAt && Date.parse(legacy.expiresAt) <= Date.now())
  ) {
    removeLegacyMatch(matchId);
    return null;
  }
  return legacy.journal;
}

export function getStoredMatchInfo(matchId: string): StoredMatchInfo | null {
  const record = cachedMatches.get(matchId) ?? readLegacyRecord(matchId);
  if (!record || !loadMatch(matchId)) return null;
  return {
    persistent: typeof record.expiresAt !== "string",
    ownerId: typeof record.ownerId === "string" ? record.ownerId : null,
    sync: record.sync ?? defaultSyncMetadata(),
  };
}

export async function getStoredMatchInfoAsync(
  matchId: string,
): Promise<StoredMatchInfo | null> {
  await loadMatchAsync(matchId);
  return getStoredMatchInfo(matchId);
}

export function canSyncStoredMatch(
  matchId: string,
  userId: string,
  isAnonymous: boolean,
): boolean {
  const storedMatchInfo = getStoredMatchInfo(matchId);
  return !(
    storedMatchInfo?.persistent &&
    (isAnonymous ||
      (storedMatchInfo.ownerId !== null && storedMatchInfo.ownerId !== userId))
  );
}

export function listStoredMatches(): MatchJournal[] {
  return legacyMatchIds()
    .map(loadMatch)
    .filter((journal): journal is MatchJournal => journal !== null)
    .sort((left, right) =>
      right.definition.createdAt.localeCompare(left.definition.createdAt),
    );
}

function legacyMatchIds(): string[] {
  const ids = new Set<string>();
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(matchPrefix)) ids.add(key.slice(matchPrefix.length));
    }
  }
  return [...ids];
}

/** @deprecated Use listStoredMatches. Kept for older callers and local data. */
export const listGuestMatches = listStoredMatches;

export function removeMatch(matchId: string): void {
  cachedMatches.delete(matchId);
  removeLegacyMatch(matchId);
  void matchStore.remove(matchId).catch(() => undefined);
}

export async function removeMatchAsync(matchId: string): Promise<boolean> {
  try {
    await matchStore.remove(matchId);
    cachedMatches.delete(matchId);
    removeLegacyMatch(matchId);
    return true;
  } catch {
    return false;
  }
}

export function removeAllStoredMatches(): void {
  cachedMatches.clear();
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(matchPrefix)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) storage.removeItem(key);
  }
  void matchStore.clear().catch(() => undefined);
}

export async function removeAllStoredMatchesAsync(): Promise<boolean> {
  try {
    await matchStore.clear();
    cachedMatches.clear();
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const keysToRemove: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(matchPrefix)) keysToRemove.push(key);
      }
      for (const key of keysToRemove) storage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}
