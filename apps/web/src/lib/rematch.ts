import type { MatchDefinition } from "@skor-lapangan/scoring-core";
import type { SetupDraft } from "./session";

export type RematchPrefill = NonNullable<SetupDraft["rematch"]>;

export function setupDraftFromDefinition(
  definition: MatchDefinition,
  sourceMatchId = definition.id,
): SetupDraft {
  return {
    sport: definition.sport,
    format: definition.format ?? "doubles",
    mode: "casual",
    rematch: { sourceMatchId, definition },
  };
}
