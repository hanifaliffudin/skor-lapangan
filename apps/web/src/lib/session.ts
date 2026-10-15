import type {
  MatchJournal,
  MatchFormat,
  MatchMode,
  Sport,
} from "@skor-lapangan/scoring-core";

const draftKey = "skor-lapangan:setup-draft";
const matchPrefix = "skor-lapangan:match:";
export const guestMatchRetentionMs = 12 * 60 * 60 * 1000;

interface StoredMatch {
  schemaVersion: 1;
  journal: MatchJournal;
  expiresAt?: string;
  ownerId?: string;
}

const currentMatchSchemaVersion = 1;

export interface StoredMatchInfo {
  persistent: boolean;
  ownerId: string | null;
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
  options: { ownerId?: string; persistent?: boolean } = {},
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

export function loadMatch(matchId: string): MatchJournal | null {
  const key = `${matchPrefix}${matchId}`;
  const value =
    window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    const stored =
      isRecord(parsed) && "journal" in parsed
        ? (parsed as Partial<StoredMatch>)
        : null;
    if (
      stored &&
      typeof stored.schemaVersion === "number" &&
      stored.schemaVersion > currentMatchSchemaVersion
    ) {
      return null;
    }
    if (
      stored &&
      typeof stored.expiresAt === "string" &&
      Date.parse(stored.expiresAt) <= Date.now()
    ) {
      removeMatch(matchId);
      return null;
    }
    const journal = stored?.journal ?? parsed;
    if (!isMatchJournal(journal, matchId)) {
      removeMatch(matchId);
      return null;
    }
    return journal;
  } catch {
    return null;
  }
}

export function getStoredMatchInfo(matchId: string): StoredMatchInfo | null {
  if (!loadMatch(matchId)) return null;

  const key = `${matchPrefix}${matchId}`;
  const value =
    window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || !("journal" in parsed)) return null;
    return {
      persistent: typeof parsed.expiresAt !== "string",
      ownerId: typeof parsed.ownerId === "string" ? parsed.ownerId : null,
    };
  } catch {
    return null;
  }
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
  const ids = new Set<string>();
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(matchPrefix)) ids.add(key.slice(matchPrefix.length));
    }
  }
  return [...ids]
    .map(loadMatch)
    .filter((journal): journal is MatchJournal => journal !== null)
    .sort((left, right) =>
      right.definition.createdAt.localeCompare(left.definition.createdAt),
    );
}

/** @deprecated Use listStoredMatches. Kept for older callers and local data. */
export const listGuestMatches = listStoredMatches;

export function removeMatch(matchId: string): void {
  window.localStorage.removeItem(`${matchPrefix}${matchId}`);
  window.sessionStorage.removeItem(`${matchPrefix}${matchId}`);
}

export function removeAllStoredMatches(): void {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(matchPrefix)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) storage.removeItem(key);
  }
}
