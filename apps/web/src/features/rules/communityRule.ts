import {
  officialRulesetFor,
  type CommunityRuleConfiguration,
  type MatchFormat,
  type RulesetSnapshot,
  type ScoringRules,
  type Sport,
  type TennisRules,
  type PadelRules,
  type TableTennisRules,
  type SquashRules,
} from "@skor-lapangan/scoring-core";

export interface CommunityRuleRecord {
  id: string;
  sport: Sport;
  title: string;
  description: string;
  current_version: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
}

export function isCommunitySport(value: string): value is Sport {
  return (
    value === "badminton" ||
    value === "pickleball" ||
    value === "tennis" ||
    value === "padel" ||
    value === "table_tennis" ||
    value === "squash"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isScoringRules(value: unknown): value is ScoringRules {
  if (!isRecord(value)) return false;
  const rules = value as Partial<ScoringRules>;
  return (
    Number.isInteger(rules.pointsToWin) &&
    Number(rules.pointsToWin) >= 1 &&
    Number(rules.pointsToWin) <= 101 &&
    Number.isInteger(rules.winBy) &&
    Number(rules.winBy) >= 1 &&
    Number(rules.winBy) <= 10 &&
    (rules.maxPoints === null ||
      (Number.isInteger(rules.maxPoints) &&
        Number(rules.maxPoints) >= Number(rules.pointsToWin) &&
        Number(rules.maxPoints) <= 101)) &&
    (rules.bestOf === 1 || rules.bestOf === 3 || rules.bestOf === 5) &&
    (rules.scoringMode === "rally" || rules.scoringMode === "side_out") &&
    (rules.serversPerTurn === 1 || rules.serversPerTurn === 2) &&
    (rules.openingServerNumber === 1 || rules.openingServerNumber === 2)
  );
}

function isTennisRules(value: unknown): value is TennisRules {
  if (!isRecord(value)) return false;
  const rules = value as Partial<TennisRules>;
  return (
    (rules.bestOf === 3 || rules.bestOf === 5) &&
    (rules.gameScoring === "advantage" || rules.gameScoring === "no_ad") &&
    (rules.setScoring === "tiebreak" || rules.setScoring === "advantage") &&
    (rules.finalSetScoring === "tiebreak" ||
      rules.finalSetScoring === "advantage" ||
      rules.finalSetScoring === "match_tiebreak") &&
    (rules.matchTieBreakPoints === 7 || rules.matchTieBreakPoints === 10)
  );
}

function isPadelRules(value: unknown): value is PadelRules {
  if (!isRecord(value)) return false;
  const rules = value as Partial<PadelRules>;
  return (
    (rules.gameScoring === "advantage" ||
      rules.gameScoring === "star_point" ||
      rules.gameScoring === "golden_point") &&
    (rules.setScoring === "standard" || rules.setScoring === "mini") &&
    (rules.finalSetScoring === "standard" ||
      rules.finalSetScoring === "advantage" ||
      rules.finalSetScoring === "match_tiebreak") &&
    (rules.matchTieBreakPoints === 7 || rules.matchTieBreakPoints === 10)
  );
}

function isTableTennisRules(value: unknown): value is TableTennisRules {
  if (!isRecord(value)) return false;
  return value.bestOf === 3 || value.bestOf === 5;
}

function isSquashRules(value: unknown): value is SquashRules {
  if (!isRecord(value)) return false;
  return value.bestOf === 3 || value.bestOf === 5;
}

export function decodeCommunityRuleConfiguration(
  value: unknown,
  sport: Sport,
): CommunityRuleConfiguration | null {
  if (!isRecord(value)) return null;

  if (value.schemaVersion === 2 && isScoringRules(value.scoring)) {
    if (sport === "tennis" && !isTennisRules(value.tennis)) return null;
    if (sport === "padel" && !isPadelRules(value.padel)) return null;
    if (sport === "table_tennis" && !isTableTennisRules(value.tableTennis))
      return null;
    if (sport === "squash" && !isSquashRules(value.squash)) return null;

    return {
      schemaVersion: 2,
      scoring: value.scoring,
      ...(sport === "tennis" ? { tennis: value.tennis } : {}),
      ...(sport === "padel" ? { padel: value.padel } : {}),
      ...(sport === "table_tennis" ? { tableTennis: value.tableTennis } : {}),
      ...(sport === "squash" ? { squash: value.squash } : {}),
    } as CommunityRuleConfiguration;
  }

  if (isScoringRules(value)) {
    const defaults = defaultCommunityRuleConfiguration(sport);
    return {
      ...defaults,
      scoring: value,
    };
  }

  return null;
}

export function defaultCommunityRuleConfiguration(
  sport: Sport,
): CommunityRuleConfiguration {
  const official = officialRulesetFor(sport, "doubles") as RulesetSnapshot;
  return {
    schemaVersion: 2,
    scoring: { ...official.configuration! },
    ...(official.tennisConfiguration
      ? { tennis: { ...official.tennisConfiguration } }
      : {}),
    ...(official.padelConfiguration
      ? { padel: { ...official.padelConfiguration } }
      : {}),
    ...(official.tableTennisConfiguration
      ? { tableTennis: { ...official.tableTennisConfiguration } }
      : {}),
    ...(official.squashConfiguration
      ? { squash: { ...official.squashConfiguration } }
      : {}),
  };
}

export function snapshotForCommunityRule(
  rule: Pick<CommunityRuleRecord, "id" | "title" | "sport" | "current_version">,
  configuration: CommunityRuleConfiguration,
  format: MatchFormat,
): RulesetSnapshot {
  const scoring = { ...configuration.scoring };
  if (format === "singles") {
    scoring.serversPerTurn = 1;
    scoring.openingServerNumber = 1;
  }

  return {
    id: rule.id,
    name: rule.title,
    sport: rule.sport,
    format,
    source: "community",
    version: rule.current_version,
    configuration: scoring,
    ...(configuration.tennis
      ? { tennisConfiguration: { ...configuration.tennis } }
      : {}),
    ...(configuration.padel
      ? { padelConfiguration: { ...configuration.padel } }
      : {}),
    ...(configuration.tableTennis
      ? { tableTennisConfiguration: { ...configuration.tableTennis } }
      : {}),
    ...(configuration.squash
      ? { squashConfiguration: { ...configuration.squash } }
      : {}),
  };
}
