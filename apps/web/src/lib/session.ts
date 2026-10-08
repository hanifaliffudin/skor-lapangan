import type {
  MatchJournal,
  MatchMode,
  Sport,
} from "@skor-lapangan/scoring-core";

const draftKey = "skor-lapangan:setup-draft";
const matchPrefix = "skor-lapangan:match:";

export interface SetupDraft {
  sport: Sport;
  mode: MatchMode;
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
      (parsed.mode === "casual" || parsed.mode === "referee")
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveMatch(journal: MatchJournal): void {
  window.sessionStorage.setItem(
    `${matchPrefix}${journal.definition.id}`,
    JSON.stringify(journal),
  );
}

export function loadMatch(matchId: string): MatchJournal | null {
  const value = window.sessionStorage.getItem(`${matchPrefix}${matchId}`);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as MatchJournal;
    return parsed.definition?.id === matchId && Array.isArray(parsed.events)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function removeMatch(matchId: string): void {
  window.sessionStorage.removeItem(`${matchPrefix}${matchId}`);
}
