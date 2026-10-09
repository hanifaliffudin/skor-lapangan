import type {
  MatchJournal,
  MatchMode,
  Sport,
} from "@skor-lapangan/scoring-core";

const draftKey = "skor-lapangan:setup-draft";
const matchPrefix = "skor-lapangan:match:";
export const guestMatchRetentionMs = 12 * 60 * 60 * 1000;

interface StoredMatch {
  journal: MatchJournal;
  expiresAt: string;
}

export interface SetupDraft {
  sport: Sport;
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
    if (
      (parsed.sport === "badminton" || parsed.sport === "pickleball") &&
      (parsed.mode === "casual" || parsed.mode === "referee") &&
      (parsed.communityRuleId === undefined ||
        typeof parsed.communityRuleId === "string")
    ) {
      return { ...parsed, mode: "casual" };
    }
  } catch {
    return null;
  }
  return null;
}

export function saveMatch(journal: MatchJournal): void {
  const stored: StoredMatch = {
    journal,
    expiresAt: new Date(Date.now() + guestMatchRetentionMs).toISOString(),
  };
  window.localStorage.setItem(
    `${matchPrefix}${journal.definition.id}`,
    JSON.stringify(stored),
  );
}

export function loadMatch(matchId: string): MatchJournal | null {
  const key = `${matchPrefix}${matchId}`;
  const value =
    window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as MatchJournal | StoredMatch;
    const stored = "journal" in parsed ? parsed : null;
    if (stored && Date.parse(stored.expiresAt) <= Date.now()) {
      removeMatch(matchId);
      return null;
    }
    const journal = stored?.journal ?? (parsed as MatchJournal);
    return journal.definition?.id === matchId && Array.isArray(journal.events)
      ? journal
      : null;
  } catch {
    return null;
  }
}

export function listGuestMatches(): MatchJournal[] {
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

export function removeMatch(matchId: string): void {
  window.localStorage.removeItem(`${matchPrefix}${matchId}`);
  window.sessionStorage.removeItem(`${matchPrefix}${matchId}`);
}
