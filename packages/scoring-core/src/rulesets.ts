import { OFFICIAL_RULESETS, officialRulesetFor } from "./engine";
import type {
  MatchDefinition,
  MatchFormat,
  RulesetSnapshot,
  ScoringMode,
} from "./types";

export interface RulesetCatalogEntry extends RulesetSnapshot {
  sourceUrl: string;
  checkedAt: string;
}

const federationByRulesetId: Record<string, string> = {
  "bwf-doubles-3x21-2025": "BWF",
  "bwf-singles-3x21-2025": "BWF",
  "usap-doubles-sideout-2026": "USA Pickleball",
  "usap-singles-sideout-2026": "USA Pickleball",
  "usap-singles-rally-2026": "USA Pickleball",
  "itf-tennis-2026": "ITF",
  "fip-padel-2026": "FIP",
  "club-padel-singles-2026": "FIP-derived local variant",
  "ittf-table-tennis-2022": "ITTF",
  "wsf-squash-singles-2025": "WSF",
  "wsf-squash-doubles-2022": "WSF",
};

function toCatalogEntry(
  ruleset: (typeof OFFICIAL_RULESETS)[keyof typeof OFFICIAL_RULESETS],
): RulesetCatalogEntry {
  const federation = federationByRulesetId[ruleset.id];
  if (!federation) {
    throw new Error(`Missing federation metadata for ruleset ${ruleset.id}`);
  }

  return {
    ...ruleset,
    federation,
    sourceUrl: ruleset.sourceUrl,
    checkedAt: ruleset.checkedAt,
  };
}

export const RULESET_CATALOG = Object.values(OFFICIAL_RULESETS).map(
  toCatalogEntry,
) as readonly RulesetCatalogEntry[];

export function listRulesetCatalog(): readonly RulesetCatalogEntry[] {
  return RULESET_CATALOG;
}

export function listOfficialRulesets(): readonly RulesetCatalogEntry[] {
  return RULESET_CATALOG.filter((ruleset) => ruleset.source === "official");
}

export function findRulesetById(id: string): RulesetCatalogEntry | undefined {
  return RULESET_CATALOG.find((ruleset) => ruleset.id === id);
}

export function toRulesetSnapshot(
  ruleset: ReturnType<typeof officialRulesetFor>,
): RulesetSnapshot {
  const catalogEntry = findRulesetById(ruleset.id);
  return catalogEntry ? { ...catalogEntry } : { ...ruleset };
}

export function officialRulesetSnapshotFor(
  sport: MatchDefinition["sport"],
  format: MatchFormat = "doubles",
  scoringMode?: ScoringMode,
): RulesetSnapshot {
  return toRulesetSnapshot(officialRulesetFor(sport, format, scoringMode));
}
