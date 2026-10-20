import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  officialRulesetFor,
  type CommunityRuleConfiguration,
  type MatchFormat,
  type MatchDefinition,
  type MatchJournal,
  type ScoringRules,
  type ScoringMode,
  type RulesetSnapshot,
  type PlayerIndex,
  type TeamId,
  type TennisGender,
  type TennisRules,
  type TennisSetOrders,
  type PadelGender,
  type PadelRules,
  type PadelSetOrders,
  type TableTennisRules,
  type TableTennisGameOrders,
  type SquashRules,
  type SquashGameOrders,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../lib/auth";
import { localizedPath, useLocale } from "../../lib/i18n";
import { normalizeIntegerInput } from "../../lib/numberInput";
import {
  loadDraft,
  saveDraft,
  saveMatch,
  type SetupDraft,
} from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { createClubSessionManagement } from "../club-sessions/clubSessionManagement";
import { createClubSessionSupabaseAdapter } from "../club-sessions/clubSessionSupabaseAdapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectControl } from "@/components/ui/select-control";
import {
  decodeCommunityRuleConfiguration,
  isCommunitySport,
  snapshotForCommunityRule,
  type CommunityRuleRecord,
} from "../rules/communityRule";
import styles from "../../styles/App.module.css";

const defaultTennisRules: TennisRules = {
  bestOf: 3,
  gameScoring: "advantage",
  setScoring: "tiebreak",
  finalSetScoring: "tiebreak",
  matchTieBreakPoints: 7,
};

const defaultPadelRules: PadelRules = {
  gameScoring: "advantage",
  setScoring: "standard",
  finalSetScoring: "standard",
  matchTieBreakPoints: 7,
};

const defaultTableTennisRules: TableTennisRules = {
  bestOf: 3,
};

const defaultSquashRules: SquashRules = {
  bestOf: 5,
};

function hasValidCustomRules(rules: ScoringRules): boolean {
  const validInteger = (value: number, min: number, max: number) =>
    Number.isInteger(value) && value >= min && value <= max;

  return (
    validInteger(rules.pointsToWin, 1, 101) &&
    validInteger(rules.winBy, 1, 10) &&
    (rules.maxPoints === null ||
      (validInteger(rules.maxPoints, 1, 101) &&
        rules.maxPoints >= rules.pointsToWin))
  );
}

export function SetupPage() {
  const [searchParams] = useSearchParams();
  const clubSessionId = searchParams.get("clubSessionId");
  const clubMatchId = searchParams.get("clubMatchId");
  const draft: SetupDraft | null =
    clubSessionId && clubMatchId
      ? ({ sport: "badminton", format: "doubles", mode: "casual" } as const)
      : loadDraft();
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const { isAnonymous, user } = useAuth();
  const clubSessionManagement = useMemo(
    () =>
      createClubSessionManagement(
        createClubSessionSupabaseAdapter(user?.id ?? null),
      ),
    [user?.id],
  );

  useEffect(() => {
    document.title = t("setupPageTitle");
  }, [t]);

  const [names, setNames] = useState(["", "", "", ""]);
  const [clubSetupLoading, setClubSetupLoading] = useState(
    Boolean(clubMatchId),
  );
  const [clubSetupReady, setClubSetupReady] = useState(!clubMatchId);
  const [format, setFormat] = useState<MatchFormat>(draft?.format ?? "doubles");
  const [firstServer, setFirstServer] = useState("A-0");
  const [officialScoringMode, setOfficialScoringMode] =
    useState<ScoringMode>("side_out");
  const [ruleSource, setRuleSource] = useState<
    "official" | "community" | "guest_custom"
  >(draft?.communityRuleId ? "community" : "official");
  const [ruleError, setRuleError] = useState("");
  const [communityRules, setCommunityRules] = useState<CommunityRuleRecord[]>(
    [],
  );
  const [communityRulesLoading, setCommunityRulesLoading] = useState(true);
  const [communityRulesError, setCommunityRulesError] = useState("");
  const [communityRule, setCommunityRule] =
    useState<CommunityRuleRecord | null>(null);
  const [communityConfiguration, setCommunityConfiguration] =
    useState<CommunityRuleConfiguration | null>(null);
  const [communityLoading, setCommunityLoading] = useState(
    Boolean(draft?.communityRuleId),
  );
  const [tennisRules, setTennisRules] =
    useState<TennisRules>(defaultTennisRules);
  const [padelRules, setPadelRules] = useState<PadelRules>(defaultPadelRules);
  const [tableTennisRules, setTableTennisRules] = useState<TableTennisRules>(
    defaultTableTennisRules,
  );
  const [squashRules, setSquashRules] =
    useState<SquashRules>(defaultSquashRules);
  const [tableTennisFirstReceiver, setTableTennisFirstReceiver] =
    useState<PlayerIndex>(0);
  const [firstServingTeam, setFirstServingTeam] = useState<TeamId>("A");
  const [firstServerByTeam, setFirstServerByTeam] = useState<
    Record<TeamId, PlayerIndex>
  >({ A: 0, B: 0 });
  const [deuceReceiverByTeam, setDeuceReceiverByTeam] = useState<
    Record<TeamId, PlayerIndex>
  >({ A: 0, B: 0 });
  const [squashReceiverBySide, setSquashReceiverBySide] = useState<
    Record<TeamId, { left: PlayerIndex; right: PlayerIndex }>
  >({
    A: { left: 1, right: 0 },
    B: { left: 1, right: 0 },
  });
  const [squashOpeningServiceBox, setSquashOpeningServiceBox] = useState<
    "left" | "right"
  >("right");
  const [mixedRoles, setMixedRoles] = useState<
    Record<TeamId, [PadelGender, PadelGender]>
  >({
    A: ["woman", "man"],
    B: ["woman", "man"],
  });
  const [customRules, setCustomRules] = useState<ScoringRules>(() => ({
    ...officialRulesetFor(
      draft?.sport ?? "badminton",
      draft?.format ?? "doubles",
    ).configuration,
  }));

  useEffect(() => {
    if (!clubMatchId || !clubSessionId) {
      setClubSetupLoading(false);
      setClubSetupReady(true);
      return;
    }
    let active = true;
    void (async () => {
      if (!supabase) {
        if (active) {
          setRuleError(t("backendNotConfigured"));
          setClubSetupLoading(false);
        }
        return;
      }
      const { data: assignment, error: assignmentError } = await supabase
        .from("club_session_matches")
        .select(
          "match_id,team_a_player_1,team_a_player_2,team_b_player_1,team_b_player_2",
        )
        .eq("match_id", clubMatchId)
        .eq("session_id", clubSessionId)
        .maybeSingle();
      if (assignmentError || !assignment) {
        if (active) {
          setRuleError(t("clubSessionLoadError"));
          setClubSetupLoading(false);
        }
        return;
      }
      const ids = [
        assignment.team_a_player_1,
        assignment.team_a_player_2,
        assignment.team_b_player_1,
        assignment.team_b_player_2,
      ];
      const { data: roster, error: rosterError } = await supabase
        .from("club_session_players")
        .select("id,display_name")
        .eq("session_id", clubSessionId)
        .in("id", ids);
      if (rosterError || !roster) {
        if (active) {
          setRuleError(t("clubSessionLoadError"));
          setClubSetupLoading(false);
        }
        return;
      }
      const namesById = new Map(
        roster.map((player) => [player.id, player.display_name]),
      );
      if (active) {
        setNames(ids.map((id) => namesById.get(id) ?? ""));
        setClubSetupReady(true);
        setClubSetupLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clubMatchId, clubSessionId, t]);

  useEffect(() => {
    if (!draft || !supabase) {
      setCommunityRulesLoading(false);
      setCommunityRulesError(draft ? t("backendNotConfigured") : "");
      return;
    }
    let active = true;
    void (async () => {
      setCommunityRulesLoading(true);
      setCommunityRulesError("");
      const { data, error } = await supabase.rpc("list_community_rules_page", {
        p_sport: draft.sport,
        p_limit: 100,
        p_before_updated_at: null,
        p_before_id: null,
      });
      if (!active) return;
      if (error) {
        setCommunityRules([]);
        setCommunityRulesError(t("communityRulesLoadError"));
        setCommunityRulesLoading(false);
        return;
      }
      setCommunityRules(
        (data ?? []).filter(
          (rule): rule is CommunityRuleRecord =>
            isCommunitySport(rule.sport) && rule.is_published,
        ),
      );
      setCommunityRulesLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [draft?.sport, t]);

  useEffect(() => {
    if (!draft?.communityRuleId) {
      setCommunityLoading(false);
      return;
    }
    const communityRuleId = draft.communityRuleId;
    let active = true;
    void (async () => {
      setCommunityLoading(true);
      if (!supabase) {
        if (active) {
          setCommunityLoading(false);
          setRuleError(t("backendNotConfigured"));
        }
        return;
      }
      const { data: rows, error } = await supabase.rpc("read_community_rule", {
        p_rule_id: communityRuleId,
      });
      const row = rows?.[0];
      if (
        !active ||
        error ||
        !row ||
        !isCommunitySport(row.sport) ||
        row.sport !== draft.sport ||
        !row.is_published
      ) {
        if (active) {
          setCommunityRule(null);
          setCommunityConfiguration(null);
          setCommunityLoading(false);
          setRuleError(t("loadRuleError"));
        }
        return;
      }
      const { data: versions, error: versionError } = await supabase.rpc(
        "read_community_rule_version",
        { p_rule_id: row.id, p_version: row.current_version },
      );
      const configuration = versions?.[0]
        ? decodeCommunityRuleConfiguration(versions[0].configuration, row.sport)
        : null;
      if (!active) return;
      if (versionError || !configuration) {
        setCommunityRule(null);
        setCommunityConfiguration(null);
        setCommunityLoading(false);
        setRuleError(t("loadRuleError"));
        return;
      }
      const typedRule = { ...row, sport: row.sport } as CommunityRuleRecord;
      setCommunityRule(typedRule);
      setCommunityConfiguration(configuration);
      setCommunityLoading(false);
      setRuleError("");
    })();
    return () => {
      active = false;
    };
  }, [draft?.communityRuleId, draft?.sport, t]);

  if (!draft) return <Navigate to={localizedPath("/", locale)} replace />;

  const playerCount = format === "singles" ? 1 : 2;
  const serverChoices: Array<[TeamId, PlayerIndex]> =
    format === "singles"
      ? [
          ["A", 0],
          ["B", 0],
        ]
      : [
          ["A", 0],
          ["A", 1],
          ["B", 0],
          ["B", 1],
        ];

  function updateName(index: number, value: string) {
    setNames((current) =>
      current.map((name, itemIndex) => (itemIndex === index ? value : name)),
    );
  }

  function updateRules<Key extends keyof ScoringRules>(
    key: Key,
    value: ScoringRules[Key],
  ) {
    setCustomRules((current) => ({ ...current, [key]: value }));
  }

  function updateTennisRules<Key extends keyof TennisRules>(
    key: Key,
    value: TennisRules[Key],
  ) {
    setTennisRules((current) => ({ ...current, [key]: value }));
  }

  function updatePadelRules<Key extends keyof PadelRules>(
    key: Key,
    value: PadelRules[Key],
  ) {
    setPadelRules((current) => ({ ...current, [key]: value }));
  }

  function updateTableTennisRules<Key extends keyof TableTennisRules>(
    key: Key,
    value: TableTennisRules[Key],
  ) {
    setTableTennisRules((current) => ({ ...current, [key]: value }));
  }

  function updateSquashRules<Key extends keyof SquashRules>(
    key: Key,
    value: SquashRules[Key],
  ) {
    setSquashRules((current) => ({ ...current, [key]: value }));
  }

  async function loadCommunityRule(ruleId: string) {
    if (!draft || !supabase) {
      setRuleError(t("backendNotConfigured"));
      return;
    }
    setCommunityLoading(true);
    setRuleError("");
    const { data: rows, error } = await supabase.rpc("read_community_rule", {
      p_rule_id: ruleId,
    });
    const row = rows?.[0];
    if (
      error ||
      !row ||
      !isCommunitySport(row.sport) ||
      row.sport !== draft.sport ||
      !row.is_published
    ) {
      setCommunityLoading(false);
      setCommunityRule(null);
      setCommunityConfiguration(null);
      setRuleError(t("loadRuleError"));
      return;
    }
    const { data: versions, error: versionError } = await supabase.rpc(
      "read_community_rule_version",
      { p_rule_id: row.id, p_version: row.current_version },
    );
    const configuration = versions?.[0]
      ? decodeCommunityRuleConfiguration(versions[0].configuration, row.sport)
      : null;
    if (versionError || !configuration) {
      setCommunityLoading(false);
      setCommunityRule(null);
      setCommunityConfiguration(null);
      setRuleError(t("loadRuleError"));
      return;
    }
    const typedRule = { ...row, sport: row.sport } as CommunityRuleRecord;
    setCommunityRule(typedRule);
    setCommunityConfiguration(configuration);
    setCommunityLoading(false);
    saveDraft({ ...draft, format, communityRuleId: ruleId });
  }

  function changeFormat(nextFormat: MatchFormat) {
    if (
      !draft ||
      (nextFormat === "mixed_doubles" &&
        draft.sport !== "tennis" &&
        draft.sport !== "padel")
    ) {
      return;
    }
    setFormat(nextFormat);
    saveDraft({ ...draft, format: nextFormat });
    setRuleError("");
  }

  function changeRuleSource(source: "official" | "community" | "guest_custom") {
    setRuleSource(source);
    setRuleError(
      source === "community" && !supabase ? t("backendNotConfigured") : "",
    );
    if (draft) {
      if (source === "community" && communityRule) {
        saveDraft({ ...draft, format, communityRuleId: communityRule.id });
      } else {
        const { communityRuleId: _communityRuleId, ...draftWithoutRule } =
          draft;
        saveDraft({ ...draftWithoutRule, format });
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || clubSetupLoading || !clubSetupReady) return;

    if (ruleSource === "guest_custom" && !hasValidCustomRules(customRules)) {
      setRuleError(
        customRules.maxPoints !== null &&
          customRules.maxPoints < customRules.pointsToWin
          ? t("capMustBeAtLeastTarget")
          : t("customRulesInvalid"),
      );
      return;
    }
    if (
      ruleSource === "community" &&
      (!communityRule || !communityConfiguration || communityLoading)
    ) {
      setRuleError(t("loadRuleError"));
      return;
    }
    if (
      format === "mixed_doubles" &&
      (mixedRoles.A[0] === mixedRoles.A[1] ||
        mixedRoles.B[0] === mixedRoles.B[1])
    ) {
      setRuleError(t("mixedRolesRequired"));
      return;
    }
    setRuleError("");

    const [team, player] = firstServer.split("-") as [TeamId, `${PlayerIndex}`];
    const fallback = (teamId: TeamId, playerIndex: number) =>
      locale === "id"
        ? `Pemain ${teamId}${playerIndex + 1}`
        : `Player ${teamId}${playerIndex + 1}`;
    const cleanName = (index: number, teamId: TeamId, playerIndex: number) =>
      names[index]?.trim() || fallback(teamId, playerIndex);
    const id = clubMatchId ?? crypto.randomUUID();
    const official = officialRulesetFor(
      draft.sport,
      format,
      officialScoringMode,
    );
    const localRulesetId =
      ruleSource === "guest_custom"
        ? `guest-${crypto.randomUUID()}`
        : official.id;
    const localRulesetName =
      ruleSource === "guest_custom" ? t("customRules") : official.name;
    const localRulesetVersion =
      ruleSource === "guest_custom" ? 1 : official.version;
    const selectedSetOrders: TennisSetOrders = {
      serviceOrder: {
        A:
          format === "singles"
            ? [0, 0]
            : [firstServerByTeam.A, (1 - firstServerByTeam.A) as PlayerIndex],
        B:
          format === "singles"
            ? [0, 0]
            : [firstServerByTeam.B, (1 - firstServerByTeam.B) as PlayerIndex],
      },
      deuceReceiver: { ...deuceReceiverByTeam },
    };
    const tableTennisOrders: TableTennisGameOrders = {
      firstServer: {
        team: firstServingTeam,
        player: format === "singles" ? 0 : firstServerByTeam[firstServingTeam],
      },
      firstReceiver: {
        team: firstServingTeam === "A" ? "B" : "A",
        player: format === "singles" ? 0 : tableTennisFirstReceiver,
      },
    };
    const squashOrders: SquashGameOrders = {
      serviceOrder: {
        A:
          format === "singles"
            ? [0, 0]
            : [firstServerByTeam.A, (1 - firstServerByTeam.A) as PlayerIndex],
        B:
          format === "singles"
            ? [0, 0]
            : [firstServerByTeam.B, (1 - firstServerByTeam.B) as PlayerIndex],
      },
      receiverBySide:
        format === "singles"
          ? {
              A: { left: 0, right: 0 },
              B: { left: 0, right: 0 },
            }
          : {
              A: { ...squashReceiverBySide.A },
              B: { ...squashReceiverBySide.B },
            },
      openingServiceBox: squashOpeningServiceBox,
    };
    const customConfiguration: ScoringRules = {
      ...customRules,
      ...(format === "singles"
        ? { serversPerTurn: 1, openingServerNumber: 1 }
        : {}),
    };
    const ruleset: RulesetSnapshot =
      ruleSource === "community" && communityRule && communityConfiguration
        ? snapshotForCommunityRule(
            communityRule,
            communityConfiguration,
            format,
          )
        : draft.sport === "squash"
          ? {
              id: localRulesetId,
              name: localRulesetName,
              sport: "squash",
              format,
              source: ruleSource,
              version: localRulesetVersion,
              configuration: {
                ...(ruleSource === "official"
                  ? official.configuration
                  : customConfiguration),
                bestOf: squashRules.bestOf,
              },
              squashConfiguration: { ...squashRules },
            }
          : draft.sport === "table_tennis"
            ? {
                id: localRulesetId,
                name: localRulesetName,
                sport: "table_tennis",
                format,
                source: ruleSource,
                version: localRulesetVersion,
                configuration: {
                  ...(ruleSource === "official"
                    ? official.configuration
                    : customConfiguration),
                  bestOf: tableTennisRules.bestOf,
                },
                tableTennisConfiguration: { ...tableTennisRules },
              }
            : draft.sport === "tennis"
              ? {
                  id: localRulesetId,
                  name: localRulesetName,
                  sport: "tennis",
                  format,
                  source: ruleSource,
                  version: localRulesetVersion,
                  configuration:
                    ruleSource === "official"
                      ? { ...official.configuration! }
                      : customConfiguration,
                  tennisConfiguration: { ...tennisRules },
                }
              : draft.sport === "padel"
                ? {
                    id: localRulesetId,
                    name: localRulesetName,
                    sport: "padel",
                    format,
                    source:
                      ruleSource === "official" ? official.source : ruleSource,
                    version: localRulesetVersion,
                    configuration:
                      ruleSource === "official"
                        ? { ...official.configuration! }
                        : customConfiguration,
                    padelConfiguration: { ...padelRules },
                  }
                : ruleSource === "official"
                  ? {
                      id: localRulesetId,
                      name: localRulesetName,
                      sport: draft.sport,
                      format,
                      source: "official",
                      version: localRulesetVersion,
                      configuration: { ...official.configuration },
                    }
                  : {
                      id: localRulesetId,
                      name: localRulesetName,
                      sport: draft.sport,
                      format,
                      source: "guest_custom",
                      version: localRulesetVersion,
                      configuration: customConfiguration,
                    };
    const makePlayer = (
      index: number,
      teamId: TeamId,
      playerIndex: number,
    ) => ({
      id: crypto.randomUUID(),
      name: cleanName(index, teamId, playerIndex),
    });
    const makePlayers = (teamId: TeamId, startIndex: number) =>
      format === "singles"
        ? ([makePlayer(startIndex, teamId, 0)] as const)
        : ([
            makePlayer(startIndex, teamId, 0),
            makePlayer(startIndex + 1, teamId, 1),
          ] as const);
    const definition: MatchDefinition = {
      id,
      sport: draft.sport,
      format,
      rulesetId: ruleset.id,
      ruleset,
      mode: draft.mode,
      createdAt: new Date().toISOString(),
      initialServingTeam:
        draft.sport === "tennis" ||
        draft.sport === "padel" ||
        draft.sport === "table_tennis" ||
        draft.sport === "squash"
          ? firstServingTeam
          : team,
      initialServingPlayer:
        format === "singles"
          ? 0
          : draft.sport === "tennis" || draft.sport === "padel"
            ? selectedSetOrders.serviceOrder[firstServingTeam][0]
            : draft.sport === "table_tennis"
              ? tableTennisOrders.firstServer.player
              : draft.sport === "squash"
                ? squashOrders.serviceOrder[firstServingTeam][0]
                : (Number(player) as PlayerIndex),
      ...(draft.sport === "tennis"
        ? {
            tennisSetOrders: selectedSetOrders,
            ...(format === "mixed_doubles"
              ? {
                  tennisLocalRoles: {
                    A: [...mixedRoles.A],
                    B: [...mixedRoles.B],
                  } as const,
                }
              : {}),
          }
        : draft.sport === "padel"
          ? {
              padelSetOrders: selectedSetOrders as PadelSetOrders,
              ...(format === "mixed_doubles"
                ? {
                    padelLocalRoles: {
                      A: [...mixedRoles.A],
                      B: [...mixedRoles.B],
                    } as const,
                  }
                : {}),
            }
          : draft.sport === "table_tennis"
            ? { tableTennisOrders }
            : draft.sport === "squash"
              ? { squashGameOrders: squashOrders }
              : {}),
      teams: {
        A: {
          name: t("teamA"),
          players: makePlayers("A", 0),
        },
        B: {
          name: t("teamB"),
          players: makePlayers("B", 2),
        },
      },
    };
    if (clubMatchId && clubSessionId) {
      if (!supabase || !user || isAnonymous) {
        setRuleError(t("clubSessionSignInBody"));
        return;
      }
      try {
        await clubSessionManagement.markMatchStarted({
          matchId: clubMatchId,
          sessionId: clubSessionId,
        });
      } catch {
        setRuleError(t("clubSessionSaveError"));
        return;
      }
    }
    const journal: MatchJournal = { definition, events: [] };
    saveMatch(journal, {
      persistent:
        ruleSource !== "guest_custom" && Boolean(user && !isAnonymous),
      ...(user?.id ? { ownerId: user.id } : {}),
    });
    navigate(
      localizedPath(
        `/match/${id}${clubSessionId ? `?clubSessionId=${clubSessionId}` : ""}`,
        locale,
      ),
    );
  }

  return (
    <div className="min-h-screen min-h-dvh bg-paper pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <AppHeader compact />
      <main className="mx-auto w-full max-w-[720px] px-[clamp(18px,5vw,40px)] pt-8 pb-16">
        <Button
          variant="outline"
          className={styles.textButton}
          type="button"
          onClick={() =>
            navigate(
              localizedPath(
                clubSessionId ? `/sessions/${clubSessionId}` : "/",
                locale,
              ),
            )
          }
        >
          <span aria-hidden="true">←</span> {t("back")}
        </Button>

        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>
            {t(draft.sport)} ·{" "}
            {draft.sport === "padel" && format === "singles"
              ? t("padelLocalVariant")
              : t(format)}{" "}
            · {t(draft.mode)}
          </p>
          <h1>{t("setupTitle")}</h1>
          <p>{clubSessionId ? t("clubSessionDetailIntro") : t("setupIntro")}</p>
        </div>

        {clubSessionId ? (
          <div
            className="mb-5 grid gap-1 rounded-lg border border-line-strong bg-surface p-3 text-sm font-semibold leading-6 text-text-muted"
            role="status"
          >
            <span>
              {clubSetupLoading ? t("loading") : t("clubSessionPrivacyNote")}
            </span>
            {!clubSetupLoading ? (
              <span>{t("clubSessionNamesLocked")}</span>
            ) : null}
          </div>
        ) : null}

        {draft.communityRuleId ? (
          <Label className={styles.selectField}>
            <span>{t("chooseFormat")}</span>
            <SelectControl
              name="community-match-format"
              value={format}
              onChange={(event) =>
                changeFormat(event.target.value as MatchFormat)
              }
            >
              <option value="singles">
                {t(draft.sport === "padel" ? "padelSingles" : "singles")}
              </option>
              <option value="doubles">{t("doubles")}</option>
              {draft.sport === "tennis" || draft.sport === "padel" ? (
                <option value="mixed_doubles">{t("mixedDoubles")}</option>
              ) : null}
            </SelectControl>
          </Label>
        ) : null}

        <form
          className={styles.setupForm}
          onSubmit={(event) => void submit(event)}
        >
          <RulesSelector
            customRules={customRules}
            format={format}
            officialScoringMode={officialScoringMode}
            tennisRules={tennisRules}
            padelRules={padelRules}
            tableTennisRules={tableTennisRules}
            squashRules={squashRules}
            onRuleSourceChange={changeRuleSource}
            onOfficialScoringModeChange={setOfficialScoringMode}
            onRulesChange={updateRules}
            onTennisRulesChange={updateTennisRules}
            onPadelRulesChange={updatePadelRules}
            onTableTennisRulesChange={updateTableTennisRules}
            onSquashRulesChange={updateSquashRules}
            ruleSource={ruleSource}
            sport={draft.sport}
            communityRules={communityRules}
            communityRule={communityRule}
            communityLoading={communityLoading || communityRulesLoading}
            communityRulesAvailable={
              communityRulesLoading ||
              communityRules.length > 0 ||
              Boolean(communityRule)
            }
            communityRulesError={communityRulesError}
            onCommunityRuleChange={(ruleId) => void loadCommunityRule(ruleId)}
          />

          <TeamFields
            label={t("teamA")}
            teamKey="a"
            readOnly={Boolean(clubMatchId)}
            names={Array.from(
              { length: playerCount },
              (_, index) => names[index] ?? "",
            )}
            playerLabels={Array.from({ length: playerCount }, (_, index) =>
              index === 0 ? t("player1") : t("player2"),
            )}
            onChange={(index, value) => updateName(index, value)}
          />
          <TeamFields
            label={t("teamB")}
            teamKey="b"
            readOnly={Boolean(clubMatchId)}
            names={Array.from(
              { length: playerCount },
              (_, index) => names[index + 2] ?? "",
            )}
            playerLabels={Array.from({ length: playerCount }, (_, index) =>
              index === 0 ? t("player1") : t("player2"),
            )}
            onChange={(index, value) => updateName(index + 2, value)}
          />
          {format === "mixed_doubles" ? (
            <>
              <TeamRoleFields
                label={t("teamA")}
                teamKey="a"
                roles={mixedRoles.A}
                localOnlyKey={
                  draft.sport === "padel"
                    ? "padelMixedRolesLocalOnly"
                    : "mixedRolesLocalOnly"
                }
                onChange={(index, role) =>
                  setMixedRoles((current) => ({
                    ...current,
                    A: current.A.map((value, itemIndex) =>
                      itemIndex === index ? role : value,
                    ) as [TennisGender, TennisGender],
                  }))
                }
              />
              <TeamRoleFields
                label={t("teamB")}
                teamKey="b"
                roles={mixedRoles.B}
                localOnlyKey={
                  draft.sport === "padel"
                    ? "padelMixedRolesLocalOnly"
                    : "mixedRolesLocalOnly"
                }
                onChange={(index, role) =>
                  setMixedRoles((current) => ({
                    ...current,
                    B: current.B.map((value, itemIndex) =>
                      itemIndex === index ? role : value,
                    ) as [TennisGender, TennisGender],
                  }))
                }
              />
            </>
          ) : null}

          {draft.sport === "tennis" || draft.sport === "padel" ? (
            draft.sport === "tennis" ? (
              <TennisOrderFields
                format={format}
                firstServingTeam={firstServingTeam}
                firstServerByTeam={firstServerByTeam}
                deuceReceiverByTeam={deuceReceiverByTeam}
                onFirstServingTeamChange={setFirstServingTeam}
                onFirstServerChange={(teamId, player) =>
                  setFirstServerByTeam((current) => ({
                    ...current,
                    [teamId]: player,
                  }))
                }
                onDeuceReceiverChange={(teamId, player) =>
                  setDeuceReceiverByTeam((current) => ({
                    ...current,
                    [teamId]: player,
                  }))
                }
              />
            ) : (
              <PadelOrderFields
                format={format}
                firstServingTeam={firstServingTeam}
                firstServerByTeam={firstServerByTeam}
                deuceReceiverByTeam={deuceReceiverByTeam}
                onFirstServingTeamChange={setFirstServingTeam}
                onFirstServerChange={(teamId, player) =>
                  setFirstServerByTeam((current) => ({
                    ...current,
                    [teamId]: player,
                  }))
                }
                onDeuceReceiverChange={(teamId, player) =>
                  setDeuceReceiverByTeam((current) => ({
                    ...current,
                    [teamId]: player,
                  }))
                }
              />
            )
          ) : draft.sport === "table_tennis" ? (
            <TableTennisOrderFields
              format={format}
              firstServingTeam={firstServingTeam}
              firstServerByTeam={firstServerByTeam}
              firstReceiver={tableTennisFirstReceiver}
              onFirstServingTeamChange={setFirstServingTeam}
              onFirstServerChange={(teamId, player) =>
                setFirstServerByTeam((current) => ({
                  ...current,
                  [teamId]: player,
                }))
              }
              onFirstReceiverChange={setTableTennisFirstReceiver}
            />
          ) : draft.sport === "squash" ? (
            <SquashOrderFields
              format={format}
              firstServingTeam={firstServingTeam}
              firstServerByTeam={firstServerByTeam}
              receiverBySide={squashReceiverBySide}
              openingServiceBox={squashOpeningServiceBox}
              onFirstServingTeamChange={setFirstServingTeam}
              onFirstServerChange={(teamId, player) =>
                setFirstServerByTeam((current) => ({
                  ...current,
                  [teamId]: player,
                }))
              }
              onReceiverChange={(teamId, side, player) =>
                setSquashReceiverBySide((current) => ({
                  ...current,
                  [teamId]: { ...current[teamId], [side]: player },
                }))
              }
              onOpeningServiceBoxChange={setSquashOpeningServiceBox}
            />
          ) : (
            <Label className={styles.selectField}>
              <span>{t("firstServer")}</span>
              <SelectControl
                name="first-server"
                value={firstServer}
                onChange={(event) => setFirstServer(event.target.value)}
              >
                {serverChoices.map(([teamId, playerIndex]) => {
                  const nameIndex = (teamId === "A" ? 0 : 2) + playerIndex;
                  const playerLabel =
                    playerIndex === 0 ? t("player1") : t("player2");
                  return (
                    <option
                      key={`${teamId}-${playerIndex}`}
                      value={`${teamId}-${playerIndex}`}
                    >
                      {names[nameIndex]?.trim() ||
                        `${t(teamId === "A" ? "teamA" : "teamB")} · ${playerLabel}`}
                    </option>
                  );
                })}
              </SelectControl>
            </Label>
          )}

          <Button
            className={styles.primaryButton}
            type="submit"
            disabled={clubSetupLoading || !clubSetupReady}
          >
            {t("startMatch")} <span aria-hidden="true">→</span>
          </Button>
          {ruleError ? (
            <p className={styles.formError} role="alert">
              {ruleError}
            </p>
          ) : null}
        </form>
      </main>
    </div>
  );
}

function RulesSelector({
  customRules,
  format,
  officialScoringMode,
  tennisRules,
  padelRules,
  tableTennisRules,
  squashRules,
  onRuleSourceChange,
  onOfficialScoringModeChange,
  onRulesChange,
  onTennisRulesChange,
  onPadelRulesChange,
  onTableTennisRulesChange,
  onSquashRulesChange,
  ruleSource,
  sport,
  communityRules,
  communityRule,
  communityLoading,
  communityRulesAvailable,
  communityRulesError,
  onCommunityRuleChange,
}: {
  customRules: ScoringRules;
  format: MatchFormat;
  officialScoringMode: ScoringMode;
  tennisRules: TennisRules;
  padelRules: PadelRules;
  tableTennisRules: TableTennisRules;
  squashRules: SquashRules;
  onRuleSourceChange: (
    source: "official" | "community" | "guest_custom",
  ) => void;
  onOfficialScoringModeChange: (mode: ScoringMode) => void;
  onRulesChange: <Key extends keyof ScoringRules>(
    key: Key,
    value: ScoringRules[Key],
  ) => void;
  onTennisRulesChange: <Key extends keyof TennisRules>(
    key: Key,
    value: TennisRules[Key],
  ) => void;
  onPadelRulesChange: <Key extends keyof PadelRules>(
    key: Key,
    value: PadelRules[Key],
  ) => void;
  onTableTennisRulesChange: <Key extends keyof TableTennisRules>(
    key: Key,
    value: TableTennisRules[Key],
  ) => void;
  onSquashRulesChange: <Key extends keyof SquashRules>(
    key: Key,
    value: SquashRules[Key],
  ) => void;
  ruleSource: "official" | "community" | "guest_custom";
  sport: MatchDefinition["sport"];
  communityRules: CommunityRuleRecord[];
  communityRule: CommunityRuleRecord | null;
  communityLoading: boolean;
  communityRulesAvailable: boolean;
  communityRulesError: string;
  onCommunityRuleChange: (ruleId: string) => void;
}) {
  const { locale, t } = useLocale();
  const [customNumberDrafts, setCustomNumberDrafts] = useState({
    pointsToWin: String(customRules.pointsToWin),
    winBy: String(customRules.winBy),
    maxPoints:
      customRules.maxPoints === null ? "" : String(customRules.maxPoints),
  });
  const communityUnavailable =
    !communityLoading &&
    !communityRulesAvailable &&
    communityRules.length === 0;
  const communityStatus = communityRulesError || t("communityRulesUnavailable");

  useEffect(() => {
    setCustomNumberDrafts({
      pointsToWin: String(customRules.pointsToWin),
      winBy: String(customRules.winBy),
      maxPoints:
        customRules.maxPoints === null ? "" : String(customRules.maxPoints),
    });
  }, [customRules.maxPoints, customRules.pointsToWin, customRules.winBy]);

  function updateCustomNumberDraft(
    field: "pointsToWin" | "winBy" | "maxPoints",
    value: string,
  ) {
    if (!/^\d*$/.test(value)) return;
    const normalized = normalizeIntegerInput(value);
    setCustomNumberDrafts((current) => ({
      ...current,
      [field]: normalized,
    }));

    if (normalized === "") {
      if (field === "maxPoints") onRulesChange("maxPoints", null);
      return;
    }

    const numericValue = Number(normalized);
    if (Number.isInteger(numericValue)) {
      onRulesChange(field, numericValue);
    }
  }

  function commitCustomNumberDraft(
    field: "pointsToWin" | "winBy" | "maxPoints",
  ) {
    const rawValue = customNumberDrafts[field];
    if (field === "maxPoints" && rawValue === "") {
      onRulesChange("maxPoints", null);
      return;
    }

    if (rawValue === "") {
      setCustomNumberDrafts((current) => ({
        ...current,
        [field]: String(customRules[field]),
      }));
      return;
    }

    const value = Number(rawValue);
    if (Number.isInteger(value)) {
      onRulesChange(field, value);
    }
  }

  return (
    <fieldset className={styles.rulesGroup}>
      <legend>{t("rulesTitle")}</legend>
      <p className={styles.rulesIntro}>{t("rulesIntro")}</p>
      <RadioGroup
        className={styles.rulesChoices}
        name="rules-source"
        value={ruleSource}
        onValueChange={(value) =>
          onRuleSourceChange(value as "official" | "community" | "guest_custom")
        }
      >
        <RadioGroupItem
          className={styles.ruleChoice}
          data-selected={ruleSource === "official"}
          value="official"
        >
          <span>
            <strong>{t("officialRules")}</strong>
            <small>{t("officialRulesBody")}</small>
          </span>
        </RadioGroupItem>
        <RadioGroupItem
          className={styles.ruleChoice}
          data-selected={ruleSource === "community"}
          data-unavailable={communityUnavailable}
          disabled={communityUnavailable}
          value="community"
        >
          <span>
            <strong>{t("communityRules")}</strong>
            <small>
              {communityUnavailable ? communityStatus : t("communityRulesBody")}
            </small>
          </span>
        </RadioGroupItem>
        <RadioGroupItem
          className={styles.ruleChoice}
          data-selected={ruleSource === "guest_custom"}
          value="guest_custom"
        >
          <span>
            <strong>{t("customRules")}</strong>
            <small>{t("customRulesBody")}</small>
          </span>
        </RadioGroupItem>
      </RadioGroup>

      {ruleSource === "community" ? (
        <div className={styles.ruleEditor}>
          <p className={styles.ruleEditorIntro}>
            {t("communityRuleSetupNote")}
          </p>
          {communityLoading ? <p role="status">{t("loading")}</p> : null}
          {!communityLoading && communityRules.length === 0 ? (
            <div
              className={styles.communityRuleEmpty}
              role={communityRulesError ? "alert" : "status"}
            >
              <strong>{communityStatus}</strong>
              <p>
                {communityRulesError
                  ? t("communityRulesLoadErrorBody")
                  : t("communityRulesEmptyBody")}
              </p>
              <Link to={localizedPath("/rules", locale)}>
                {t("browseCommunityRules")}
              </Link>
            </div>
          ) : null}
          {communityRules.length > 0 ? (
            <Label>
              <span>{t("selectCommunityRules")}</span>
              <SelectControl
                name="community-rule"
                value={communityRule?.id ?? ""}
                onChange={(event) => onCommunityRuleChange(event.target.value)}
                disabled={communityLoading || communityRules.length === 0}
                required
              >
                <option value="">{t("communityRuleSelectPlaceholder")}</option>
                {communityRules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.title} · {t("version")} {rule.current_version}
                  </option>
                ))}
              </SelectControl>
            </Label>
          ) : null}
          {communityRules.length > 0 ? (
            <Link
              className={styles.communityRulesBrowseLink}
              to={localizedPath("/rules", locale)}
            >
              {t("browseCommunityRules")}
            </Link>
          ) : null}
        </div>
      ) : null}

      {ruleSource !== "community" && sport === "tennis" ? (
        <TennisRulesFields
          isCustom={ruleSource === "guest_custom"}
          rules={tennisRules}
          onChange={onTennisRulesChange}
        />
      ) : null}
      {ruleSource !== "community" && sport === "padel" ? (
        <PadelRulesFields
          format={format}
          isCustom={ruleSource === "guest_custom"}
          rules={padelRules}
          onChange={onPadelRulesChange}
        />
      ) : null}
      {ruleSource !== "community" && sport === "table_tennis" ? (
        <TableTennisRulesFields
          isCustom={ruleSource === "guest_custom"}
          rules={tableTennisRules}
          onChange={onTableTennisRulesChange}
        />
      ) : null}
      {ruleSource !== "community" && sport === "squash" ? (
        <SquashRulesFields
          isCustom={ruleSource === "guest_custom"}
          rules={squashRules}
          onChange={onSquashRulesChange}
        />
      ) : null}

      {ruleSource === "official" &&
      sport === "pickleball" &&
      format === "singles" ? (
        <Label className={styles.selectField}>
          <span>{t("scoringMode")}</span>
          <SelectControl
            name="pickleball-singles-scoring-mode"
            value={officialScoringMode}
            onChange={(event) =>
              onOfficialScoringModeChange(event.target.value as ScoringMode)
            }
          >
            <option value="side_out">{t("sideOutStandard")}</option>
            <option value="rally">{t("rallyScoring")}</option>
          </SelectControl>
        </Label>
      ) : null}

      {ruleSource === "guest_custom" ? (
        <div className={styles.ruleEditor}>
          <p>{t("customRulesNotice")}</p>
          <div className={styles.ruleFields}>
            <Label>
              <span>{t("pointsToWin")}</span>
              <Input
                name="custom-points-to-win"
                type="text"
                min="1"
                max="101"
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customNumberDrafts.pointsToWin}
                onChange={(event) =>
                  updateCustomNumberDraft("pointsToWin", event.target.value)
                }
                onBlur={() => commitCustomNumberDraft("pointsToWin")}
                required
              />
            </Label>
            <Label>
              <span>{t("winBy")}</span>
              <Input
                name="custom-win-by"
                type="text"
                min="1"
                max="10"
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customNumberDrafts.winBy}
                onChange={(event) =>
                  updateCustomNumberDraft("winBy", event.target.value)
                }
                onBlur={() => commitCustomNumberDraft("winBy")}
                required
              />
            </Label>
            <Label>
              <span>{t("maxPoints")}</span>
              <Input
                name="custom-max-points"
                type="text"
                min={customRules.pointsToWin}
                max="101"
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customNumberDrafts.maxPoints}
                onChange={(event) =>
                  updateCustomNumberDraft("maxPoints", event.target.value)
                }
                onBlur={() => commitCustomNumberDraft("maxPoints")}
              />
            </Label>
            <Label>
              <span>{t("bestOf")}</span>
              <SelectControl
                name="custom-best-of"
                value={customRules.bestOf}
                onChange={(event) =>
                  onRulesChange(
                    "bestOf",
                    Number(event.target.value) as 1 | 3 | 5,
                  )
                }
              >
                <option value="1">{t("bestOfOne")}</option>
                <option value="3">{t("bestOfThree")}</option>
                <option value="5">{t("bestOfFive")}</option>
              </SelectControl>
            </Label>
            <Label>
              <span>{t("scoringMode")}</span>
              <SelectControl
                name="custom-scoring-mode"
                value={customRules.scoringMode}
                onChange={(event) =>
                  onRulesChange(
                    "scoringMode",
                    event.target.value as ScoringRules["scoringMode"],
                  )
                }
              >
                <option value="rally">{t("rallyScoring")}</option>
                <option value="side_out">{t("sideOutScoring")}</option>
              </SelectControl>
            </Label>
            {customRules.scoringMode === "side_out" && format !== "singles" ? (
              <>
                <Label>
                  <span>{t("serversPerTurn")}</span>
                  <SelectControl
                    name="custom-servers-per-turn"
                    value={customRules.serversPerTurn}
                    onChange={(event) =>
                      onRulesChange(
                        "serversPerTurn",
                        Number(event.target.value) as 1 | 2,
                      )
                    }
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </SelectControl>
                </Label>
                <Label>
                  <span>{t("openingServerNumber")}</span>
                  <SelectControl
                    name="custom-opening-server-number"
                    value={customRules.openingServerNumber}
                    onChange={(event) =>
                      onRulesChange(
                        "openingServerNumber",
                        Number(event.target.value) as 1 | 2,
                      )
                    }
                  >
                    <option value="1">{t("serverOne")}</option>
                    <option value="2">{t("serverTwo")}</option>
                  </SelectControl>
                </Label>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

function TennisRulesFields({
  isCustom,
  rules,
  onChange,
}: {
  isCustom: boolean;
  rules: TennisRules;
  onChange: <Key extends keyof TennisRules>(
    key: Key,
    value: TennisRules[Key],
  ) => void;
}) {
  const { t } = useLocale();
  return (
    <fieldset className={styles.rulesGroup}>
      <legend>
        {t(isCustom ? "customTennisFormatTitle" : "tennisFormatTitle")}
      </legend>
      <p className={styles.fieldHint}>
        {t(isCustom ? "customTennisRulesSource" : "tennisRulesSource")}
      </p>
      <div className={styles.ruleFields}>
        <Label>
          <span>{t("bestOf")}</span>
          <SelectControl
            name="tennis-best-of"
            value={rules.bestOf}
            onChange={(event) =>
              onChange("bestOf", Number(event.target.value) as 3 | 5)
            }
          >
            <option value="3">{t("bestOfThree")}</option>
            <option value="5">{t("bestOfFive")}</option>
          </SelectControl>
        </Label>
        <Label>
          <span>{t("tennisGameScoring")}</span>
          <SelectControl
            name="tennis-game-scoring"
            value={rules.gameScoring}
            onChange={(event) =>
              onChange(
                "gameScoring",
                event.target.value as TennisRules["gameScoring"],
              )
            }
          >
            <option value="advantage">{t("tennisAdvantage")}</option>
            <option value="no_ad">{t("tennisNoAd")}</option>
          </SelectControl>
        </Label>
        <Label>
          <span>{t("tennisSetScoring")}</span>
          <SelectControl
            name="tennis-set-scoring"
            value={rules.setScoring}
            onChange={(event) =>
              onChange(
                "setScoring",
                event.target.value as TennisRules["setScoring"],
              )
            }
          >
            <option value="tiebreak">{t("tennisTiebreakSet")}</option>
            <option value="advantage">{t("tennisAdvantageSet")}</option>
          </SelectControl>
        </Label>
        <Label>
          <span>{t("tennisFinalSet")}</span>
          <SelectControl
            name="tennis-final-set-scoring"
            value={rules.finalSetScoring}
            onChange={(event) =>
              onChange(
                "finalSetScoring",
                event.target.value as TennisRules["finalSetScoring"],
              )
            }
          >
            <option value="tiebreak">{t("tennisTiebreakSet")}</option>
            <option value="advantage">{t("tennisAdvantageSet")}</option>
            <option value="match_tiebreak">{t("tennisMatchTiebreak")}</option>
          </SelectControl>
        </Label>
        {rules.finalSetScoring === "match_tiebreak" ? (
          <Label>
            <span>{t("tennisMatchTiebreakTarget")}</span>
            <SelectControl
              name="tennis-match-tiebreak-target"
              value={rules.matchTieBreakPoints}
              onChange={(event) =>
                onChange(
                  "matchTieBreakPoints",
                  Number(event.target.value) as 7 | 10,
                )
              }
            >
              <option value="7">7 {t("pointsByTwo")}</option>
              <option value="10">10 {t("pointsByTwo")}</option>
            </SelectControl>
          </Label>
        ) : null}
      </div>
    </fieldset>
  );
}

function PadelRulesFields({
  format,
  isCustom,
  rules,
  onChange,
}: {
  format: MatchFormat;
  isCustom: boolean;
  rules: PadelRules;
  onChange: <Key extends keyof PadelRules>(
    key: Key,
    value: PadelRules[Key],
  ) => void;
}) {
  const { t } = useLocale();
  return (
    <fieldset className={styles.rulesGroup}>
      <legend>
        {t(
          isCustom
            ? "customPadelFormatTitle"
            : format === "singles"
              ? "padelLocalFormatTitle"
              : "padelFormatTitle",
        )}
      </legend>
      <p className={styles.fieldHint}>
        {t(
          isCustom
            ? "customPadelRulesSource"
            : format === "singles"
              ? "padelLocalRulesSource"
              : "padelRulesSource",
        )}
      </p>
      <div className={styles.ruleFields}>
        <Label>
          <span>{t("padelGameScoring")}</span>
          <SelectControl
            name="padel-game-scoring"
            value={rules.gameScoring}
            onChange={(event) =>
              onChange(
                "gameScoring",
                event.target.value as PadelRules["gameScoring"],
              )
            }
          >
            <option value="advantage">{t("padelAdvantage")}</option>
            <option value="star_point">{t("padelStarPoint")}</option>
            <option value="golden_point">{t("padelGoldenPoint")}</option>
          </SelectControl>
        </Label>
        <Label>
          <span>{t("padelSetScoring")}</span>
          <SelectControl
            name="padel-set-scoring"
            value={rules.setScoring}
            onChange={(event) =>
              onChange(
                "setScoring",
                event.target.value as PadelRules["setScoring"],
              )
            }
          >
            <option value="standard">{t("padelStandardSet")}</option>
            <option value="mini">{t("padelMiniSet")}</option>
          </SelectControl>
        </Label>
        <Label>
          <span>{t("padelFinalSet")}</span>
          <SelectControl
            name="padel-final-set-scoring"
            value={rules.finalSetScoring}
            onChange={(event) =>
              onChange(
                "finalSetScoring",
                event.target.value as PadelRules["finalSetScoring"],
              )
            }
          >
            <option value="standard">{t("padelStandardSet")}</option>
            <option value="advantage">{t("padelAdvantageSet")}</option>
            <option value="match_tiebreak">{t("padelMatchTiebreak")}</option>
          </SelectControl>
        </Label>
        {rules.finalSetScoring === "match_tiebreak" ? (
          <Label>
            <span>{t("padelMatchTiebreakTarget")}</span>
            <SelectControl
              name="padel-match-tiebreak-target"
              value={rules.matchTieBreakPoints}
              onChange={(event) =>
                onChange(
                  "matchTieBreakPoints",
                  Number(event.target.value) as 7 | 10,
                )
              }
            >
              <option value="7">7 {t("pointsByTwo")}</option>
              <option value="10">10 {t("pointsByTwo")}</option>
            </SelectControl>
          </Label>
        ) : null}
      </div>
    </fieldset>
  );
}

function TableTennisRulesFields({
  isCustom,
  rules,
  onChange,
}: {
  isCustom: boolean;
  rules: TableTennisRules;
  onChange: <Key extends keyof TableTennisRules>(
    key: Key,
    value: TableTennisRules[Key],
  ) => void;
}) {
  const { t } = useLocale();
  return (
    <fieldset className={styles.rulesGroup}>
      <legend>
        {t(
          isCustom ? "customTableTennisFormatTitle" : "tableTennisFormatTitle",
        )}
      </legend>
      <p className={styles.fieldHint}>
        {t(
          isCustom ? "customTableTennisRulesSource" : "tableTennisRulesSource",
        )}
      </p>
      <Label className={styles.selectField}>
        <span>{t("bestOf")}</span>
        <SelectControl
          name="table-tennis-best-of"
          value={rules.bestOf}
          onChange={(event) =>
            onChange("bestOf", Number(event.target.value) as 3 | 5)
          }
        >
          <option value="3">{t("bestOfThree")}</option>
          <option value="5">{t("bestOfFive")}</option>
        </SelectControl>
      </Label>
    </fieldset>
  );
}

function SquashRulesFields({
  isCustom,
  rules,
  onChange,
}: {
  isCustom: boolean;
  rules: SquashRules;
  onChange: <Key extends keyof SquashRules>(
    key: Key,
    value: SquashRules[Key],
  ) => void;
}) {
  const { t } = useLocale();
  return (
    <fieldset className={styles.rulesGroup}>
      <legend>
        {t(isCustom ? "customSquashFormatTitle" : "squashFormatTitle")}
      </legend>
      <p className={styles.fieldHint}>
        {t(isCustom ? "customSquashRulesSource" : "squashRulesSource")}
      </p>
      <Label className={styles.selectField}>
        <span>{t("bestOf")}</span>
        <SelectControl
          name="squash-best-of"
          value={rules.bestOf}
          onChange={(event) =>
            onChange("bestOf", Number(event.target.value) as 3 | 5)
          }
        >
          <option value="3">{t("bestOfThree")}</option>
          <option value="5">{t("bestOfFive")}</option>
        </SelectControl>
      </Label>
    </fieldset>
  );
}

function TennisOrderFields({
  format,
  firstServingTeam,
  firstServerByTeam,
  deuceReceiverByTeam,
  onFirstServingTeamChange,
  onFirstServerChange,
  onDeuceReceiverChange,
}: {
  format: MatchFormat;
  firstServingTeam: TeamId;
  firstServerByTeam: Record<TeamId, PlayerIndex>;
  deuceReceiverByTeam: Record<TeamId, PlayerIndex>;
  onFirstServingTeamChange: (team: TeamId) => void;
  onFirstServerChange: (team: TeamId, player: PlayerIndex) => void;
  onDeuceReceiverChange: (team: TeamId, player: PlayerIndex) => void;
}) {
  const { t } = useLocale();
  return (
    <fieldset className={styles.rulesGroup}>
      <legend>{t("tennisOrdersTitle")}</legend>
      <p className={styles.fieldHint}>{t("tennisOrdersIntro")}</p>
      <Label className={styles.selectField}>
        <span>{t("tennisFirstServingTeam")}</span>
        <SelectControl
          name="tennis-first-serving-team"
          value={firstServingTeam}
          onChange={(event) =>
            onFirstServingTeamChange(event.target.value as TeamId)
          }
        >
          <option value="A">{t("teamA")}</option>
          <option value="B">{t("teamB")}</option>
        </SelectControl>
      </Label>
      {format !== "singles"
        ? (["A", "B"] as const).map((team) => (
            <div className={styles.tennisPairOrders} key={team}>
              <h3>{team === "A" ? t("teamA") : t("teamB")}</h3>
              <Label className={styles.selectField}>
                <span>{t("tennisPairFirstServer")}</span>
                <SelectControl
                  name={`tennis-first-server-team-${team.toLowerCase()}`}
                  value={firstServerByTeam[team]}
                  onChange={(event) =>
                    onFirstServerChange(
                      team,
                      Number(event.target.value) as PlayerIndex,
                    )
                  }
                >
                  <option value="0">{t("player1")}</option>
                  <option value="1">{t("player2")}</option>
                </SelectControl>
              </Label>
              <Label className={styles.selectField}>
                <span>{t("tennisDeuceReceiver")}</span>
                <SelectControl
                  name={`tennis-deuce-receiver-team-${team.toLowerCase()}`}
                  value={deuceReceiverByTeam[team]}
                  onChange={(event) =>
                    onDeuceReceiverChange(
                      team,
                      Number(event.target.value) as PlayerIndex,
                    )
                  }
                >
                  <option value="0">{t("player1")}</option>
                  <option value="1">{t("player2")}</option>
                </SelectControl>
              </Label>
            </div>
          ))
        : null}
    </fieldset>
  );
}

function PadelOrderFields({
  format,
  firstServingTeam,
  firstServerByTeam,
  deuceReceiverByTeam,
  onFirstServingTeamChange,
  onFirstServerChange,
  onDeuceReceiverChange,
}: {
  format: MatchFormat;
  firstServingTeam: TeamId;
  firstServerByTeam: Record<TeamId, PlayerIndex>;
  deuceReceiverByTeam: Record<TeamId, PlayerIndex>;
  onFirstServingTeamChange: (team: TeamId) => void;
  onFirstServerChange: (team: TeamId, player: PlayerIndex) => void;
  onDeuceReceiverChange: (team: TeamId, player: PlayerIndex) => void;
}) {
  const { t } = useLocale();
  return (
    <fieldset className={styles.rulesGroup}>
      <legend>{t("padelOrdersTitle")}</legend>
      <p className={styles.fieldHint}>{t("padelOrdersIntro")}</p>
      <Label className={styles.selectField}>
        <span>{t("padelFirstServingTeam")}</span>
        <SelectControl
          name="padel-first-serving-team"
          value={firstServingTeam}
          onChange={(event) =>
            onFirstServingTeamChange(event.target.value as TeamId)
          }
        >
          <option value="A">{t("teamA")}</option>
          <option value="B">{t("teamB")}</option>
        </SelectControl>
      </Label>
      {format !== "singles"
        ? (["A", "B"] as const).map((team) => (
            <div className={styles.tennisPairOrders} key={team}>
              <h3>{team === "A" ? t("teamA") : t("teamB")}</h3>
              <Label className={styles.selectField}>
                <span>{t("padelFirstServer")}</span>
                <SelectControl
                  name={`padel-first-server-team-${team.toLowerCase()}`}
                  value={firstServerByTeam[team]}
                  onChange={(event) =>
                    onFirstServerChange(
                      team,
                      Number(event.target.value) as PlayerIndex,
                    )
                  }
                >
                  <option value="0">{t("player1")}</option>
                  <option value="1">{t("player2")}</option>
                </SelectControl>
              </Label>
              <Label className={styles.selectField}>
                <span>{t("padelFirstReceiver")}</span>
                <SelectControl
                  name={`padel-first-receiver-team-${team.toLowerCase()}`}
                  value={deuceReceiverByTeam[team]}
                  onChange={(event) =>
                    onDeuceReceiverChange(
                      team,
                      Number(event.target.value) as PlayerIndex,
                    )
                  }
                >
                  <option value="0">{t("player1")}</option>
                  <option value="1">{t("player2")}</option>
                </SelectControl>
              </Label>
            </div>
          ))
        : null}
    </fieldset>
  );
}

function TableTennisOrderFields({
  format,
  firstServingTeam,
  firstServerByTeam,
  firstReceiver,
  onFirstServingTeamChange,
  onFirstServerChange,
  onFirstReceiverChange,
}: {
  format: MatchFormat;
  firstServingTeam: TeamId;
  firstServerByTeam: Record<TeamId, PlayerIndex>;
  firstReceiver: PlayerIndex;
  onFirstServingTeamChange: (team: TeamId) => void;
  onFirstServerChange: (team: TeamId, player: PlayerIndex) => void;
  onFirstReceiverChange: (player: PlayerIndex) => void;
}) {
  const { t } = useLocale();
  const receivingTeam = firstServingTeam === "A" ? "B" : "A";
  return (
    <fieldset className={styles.rulesGroup}>
      <legend>{t("tableTennisOrdersTitle")}</legend>
      <p className={styles.fieldHint}>{t("tableTennisOrdersIntro")}</p>
      <Label className={styles.selectField}>
        <span>{t("tableTennisFirstServingTeam")}</span>
        <SelectControl
          name="table-tennis-first-serving-team"
          value={firstServingTeam}
          onChange={(event) =>
            onFirstServingTeamChange(event.target.value as TeamId)
          }
        >
          <option value="A">{t("teamA")}</option>
          <option value="B">{t("teamB")}</option>
        </SelectControl>
      </Label>
      {format === "doubles" ? (
        <div className={styles.tennisPairOrders}>
          <h3>{t(firstServingTeam === "A" ? "teamA" : "teamB")}</h3>
          <Label className={styles.selectField}>
            <span>{t("tableTennisFirstServer")}</span>
            <SelectControl
              name="table-tennis-first-server"
              value={firstServerByTeam[firstServingTeam]}
              onChange={(event) =>
                onFirstServerChange(
                  firstServingTeam,
                  Number(event.target.value) as PlayerIndex,
                )
              }
            >
              <option value="0">{t("player1")}</option>
              <option value="1">{t("player2")}</option>
            </SelectControl>
          </Label>
          <p className={styles.fieldHint}>
            {t("tableTennisReceiverTeam")}:{" "}
            {t(receivingTeam === "A" ? "teamA" : "teamB")}
          </p>
          <Label className={styles.selectField}>
            <span>{t("tableTennisFirstReceiver")}</span>
            <SelectControl
              name="table-tennis-first-receiver"
              value={firstReceiver}
              onChange={(event) =>
                onFirstReceiverChange(Number(event.target.value) as PlayerIndex)
              }
            >
              <option value="0">{t("player1")}</option>
              <option value="1">{t("player2")}</option>
            </SelectControl>
          </Label>
        </div>
      ) : null}
    </fieldset>
  );
}

function SquashOrderFields({
  format,
  firstServingTeam,
  firstServerByTeam,
  receiverBySide,
  openingServiceBox,
  onFirstServingTeamChange,
  onFirstServerChange,
  onReceiverChange,
  onOpeningServiceBoxChange,
}: {
  format: MatchFormat;
  firstServingTeam: TeamId;
  firstServerByTeam: Record<TeamId, PlayerIndex>;
  receiverBySide: Record<TeamId, { left: PlayerIndex; right: PlayerIndex }>;
  openingServiceBox: "left" | "right";
  onFirstServingTeamChange: (team: TeamId) => void;
  onFirstServerChange: (team: TeamId, player: PlayerIndex) => void;
  onReceiverChange: (
    team: TeamId,
    side: "left" | "right",
    player: PlayerIndex,
  ) => void;
  onOpeningServiceBoxChange: (side: "left" | "right") => void;
}) {
  const { t } = useLocale();
  return (
    <fieldset className={styles.rulesGroup}>
      <legend>{t("squashOrdersTitle")}</legend>
      <p className={styles.fieldHint}>{t("squashOrdersIntro")}</p>
      <Label className={styles.selectField}>
        <span>{t("squashFirstServingTeam")}</span>
        <SelectControl
          name="squash-first-serving-team"
          value={firstServingTeam}
          onChange={(event) =>
            onFirstServingTeamChange(event.target.value as TeamId)
          }
        >
          <option value="A">{t("teamA")}</option>
          <option value="B">{t("teamB")}</option>
        </SelectControl>
      </Label>
      <Label className={styles.selectField}>
        <span>{t("squashFirstServiceBox")}</span>
        <SelectControl
          name="squash-first-service-box"
          value={openingServiceBox}
          onChange={(event) =>
            onOpeningServiceBoxChange(event.target.value as "left" | "right")
          }
        >
          <option value="right">{t("squashServiceBoxRight")}</option>
          <option value="left">{t("squashServiceBoxLeft")}</option>
        </SelectControl>
      </Label>
      {(format === "doubles" ? (["A", "B"] as const) : [firstServingTeam]).map(
        (team) => (
          <div className={styles.tennisPairOrders} key={team}>
            <h3>{t(team === "A" ? "teamA" : "teamB")}</h3>
            <Label className={styles.selectField}>
              <span>{t("squashFirstServer")}</span>
              <SelectControl
                name={`squash-first-server-${team.toLowerCase()}`}
                value={firstServerByTeam[team]}
                onChange={(event) =>
                  onFirstServerChange(
                    team,
                    Number(event.target.value) as PlayerIndex,
                  )
                }
              >
                <option value="0">{t("player1")}</option>
                {format === "doubles" ? (
                  <option value="1">{t("player2")}</option>
                ) : null}
              </SelectControl>
            </Label>
            {format === "doubles"
              ? (["left", "right"] as const).map((side) => (
                  <Label className={styles.selectField} key={side}>
                    <span>
                      {side === "left"
                        ? t("squashReceiverLeft")
                        : t("squashReceiverRight")}
                    </span>
                    <SelectControl
                      name={`squash-receiver-${team.toLowerCase()}-${side}`}
                      value={receiverBySide[team][side]}
                      onChange={(event) =>
                        onReceiverChange(
                          team,
                          side,
                          Number(event.target.value) as PlayerIndex,
                        )
                      }
                    >
                      <option value="0">{t("player1")}</option>
                      <option value="1">{t("player2")}</option>
                    </SelectControl>
                  </Label>
                ))
              : null}
          </div>
        ),
      )}
    </fieldset>
  );
}

function TeamRoleFields({
  label,
  teamKey,
  roles,
  localOnlyKey,
  onChange,
}: {
  label: string;
  teamKey: "a" | "b";
  roles: [TennisGender, TennisGender];
  localOnlyKey: "mixedRolesLocalOnly" | "padelMixedRolesLocalOnly";
  onChange: (index: number, role: TennisGender) => void;
}) {
  const { t } = useLocale();
  return (
    <fieldset className={styles.teamFields}>
      <legend>
        {label} · {t("mixedRolesTitle")}
      </legend>
      {roles.map((role, index) => (
        <Label key={index}>
          <span>{index === 0 ? t("player1") : t("player2")}</span>
          <SelectControl
            name={`${localOnlyKey}-${teamKey}-player-${index + 1}`}
            value={role}
            onChange={(event) =>
              onChange(index, event.target.value as TennisGender)
            }
          >
            <option value="woman">{t("woman")}</option>
            <option value="man">{t("man")}</option>
          </SelectControl>
        </Label>
      ))}
      <small className={styles.fieldHint}>{t(localOnlyKey)}</small>
    </fieldset>
  );
}

interface TeamFieldsProps {
  label: string;
  names: string[];
  playerLabels: string[];
  readOnly?: boolean;
  teamKey: "a" | "b";
  onChange: (index: number, value: string) => void;
}

function TeamFields({
  label,
  names,
  playerLabels,
  readOnly = false,
  teamKey,
  onChange,
}: TeamFieldsProps) {
  return (
    <fieldset className={styles.teamFields}>
      <legend>{label}</legend>
      {names.map((name, index) => (
        <Label key={playerLabels[index]}>
          <span>{playerLabels[index]}</span>
          <Input
            name={`team-${teamKey}-player-${index + 1}`}
            autoComplete="off"
            maxLength={30}
            placeholder={playerLabels[index]}
            value={name}
            readOnly={readOnly}
            onChange={(event) => onChange(index, event.target.value)}
          />
        </Label>
      ))}
    </fieldset>
  );
}
