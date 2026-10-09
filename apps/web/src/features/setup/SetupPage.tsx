import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  officialRulesetFor,
  type MatchDefinition,
  type MatchJournal,
  type ScoringRules,
  type RulesetSnapshot,
  type PlayerIndex,
  type TeamId,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../lib/auth";
import { useLocale } from "../../lib/i18n";
import { loadDraft, saveDraft, saveMatch } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import styles from "../../styles/App.module.css";

export function SetupPage() {
  const draft = loadDraft();
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const { user, isAnonymous } = useAuth();
  const allowGuestCustom = !user || isAnonymous;
  const [names, setNames] = useState(["", "", "", ""]);
  const [firstServer, setFirstServer] = useState("A-0");
  const [ruleSource, setRuleSource] = useState<
    "official" | "guest_custom" | "community"
  >("official");
  const [ruleError, setRuleError] = useState("");
  const [communityRules, setCommunityRules] = useState<
    Array<{
      id: string;
      title: string;
      sport: "badminton" | "pickleball";
      version: number;
    }>
  >([]);
  const [selectedCommunityRuleId, setSelectedCommunityRuleId] = useState("");
  const [selectedCommunityRuleset, setSelectedCommunityRuleset] =
    useState<RulesetSnapshot | null>(null);
  const [customRules, setCustomRules] = useState<ScoringRules>(() => ({
    ...officialRulesetFor(draft?.sport ?? "badminton").configuration,
  }));

  useEffect(() => {
    if (!draft || !supabase) return;
    let active = true;
    void supabase.rpc("list_community_rules").then(({ data }) => {
      if (!active || !data) return;
      const available = data.flatMap((rule) =>
        rule.is_published && rule.sport === draft.sport
          ? [
              {
                id: rule.id,
                title: rule.title,
                sport: rule.sport as "badminton" | "pickleball",
                version: rule.current_version,
              },
            ]
          : [],
      );
      setCommunityRules(available);
      if (
        draft.communityRuleId &&
        available.some((rule) => rule.id === draft.communityRuleId)
      ) {
        void chooseCommunityRule(draft.communityRuleId);
      }
    });
    return () => {
      active = false;
    };
  }, [draft?.sport, draft?.communityRuleId]);

  useEffect(() => {
    if (!allowGuestCustom && ruleSource === "guest_custom") {
      setRuleSource("official");
    }
  }, [allowGuestCustom, ruleSource]);

  if (!draft) return <Navigate to="/" replace />;

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

  async function chooseCommunityRule(ruleId: string) {
    if (!supabase) return;
    setRuleError("");
    setSelectedCommunityRuleId(ruleId);
    setSelectedCommunityRuleset(null);
    const { data: rules, error: ruleError } = await supabase.rpc(
      "read_community_rule",
      { p_rule_id: ruleId },
    );
    const rule = rules?.[0];
    if (
      ruleError ||
      !rule ||
      !rule.is_published ||
      (rule.sport !== "badminton" && rule.sport !== "pickleball")
    ) {
      setRuleError(t("loadRuleError"));
      return;
    }
    const { data: versions, error: versionError } = await supabase.rpc(
      "read_community_rule_version",
      { p_rule_id: rule.id, p_version: rule.current_version },
    );
    const version = versions?.[0];
    if (versionError || !version || !isScoringRules(version.configuration)) {
      setRuleError(t("loadRuleError"));
      return;
    }

    const ruleset: RulesetSnapshot = {
      id: rule.id,
      name: rule.title,
      sport: rule.sport,
      source: "community",
      version: rule.current_version,
      configuration: version.configuration,
    };
    setSelectedCommunityRuleId(rule.id);
    setSelectedCommunityRuleset(ruleset);
    setCustomRules(version.configuration);
    setRuleSource("community");
  }

  function changeRuleSource(source: "official" | "guest_custom" | "community") {
    if (source === "guest_custom" && !allowGuestCustom) return;
    setRuleSource(source);
    if (source !== "community" && draft) {
      saveDraft({ sport: draft.sport, mode: draft.mode });
    }
    if (
      source === "community" &&
      !selectedCommunityRuleId &&
      communityRules[0]
    ) {
      void chooseCommunityRule(communityRules[0].id);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;

    if (
      ruleSource !== "official" &&
      customRules.maxPoints !== null &&
      customRules.maxPoints < customRules.pointsToWin
    ) {
      setRuleError(t("capMustBeAtLeastTarget"));
      return;
    }
    if (ruleSource === "community" && !selectedCommunityRuleset) {
      setRuleError(t("loadRuleError"));
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
    const id = crypto.randomUUID();
    const official = officialRulesetFor(draft.sport);
    const ruleset: RulesetSnapshot =
      ruleSource === "official"
        ? {
            id: official.id,
            name: official.name,
            sport: draft.sport,
            source: "official",
            version: official.version,
            configuration: { ...official.configuration },
          }
        : ruleSource === "community"
          ? selectedCommunityRuleset!
          : {
              id: `guest-${crypto.randomUUID()}`,
              name: t("customRules"),
              sport: draft.sport,
              source: "guest_custom",
              version: 1,
              configuration: { ...customRules },
            };
    const definition: MatchDefinition = {
      id,
      sport: draft.sport,
      rulesetId: ruleset.id,
      ruleset,
      mode: draft.mode,
      createdAt: new Date().toISOString(),
      initialServingTeam: team,
      initialServingPlayer: Number(player) as PlayerIndex,
      teams: {
        A: {
          name: t("teamA"),
          players: [
            { id: crypto.randomUUID(), name: cleanName(0, "A", 0) },
            { id: crypto.randomUUID(), name: cleanName(1, "A", 1) },
          ],
        },
        B: {
          name: t("teamB"),
          players: [
            { id: crypto.randomUUID(), name: cleanName(2, "B", 0) },
            { id: crypto.randomUUID(), name: cleanName(3, "B", 1) },
          ],
        },
      },
    };
    const journal: MatchJournal = { definition, events: [] };
    saveMatch(journal);
    navigate(`/match/${id}`);
  }

  return (
    <div className={styles.pageShell}>
      <AppHeader compact />
      <main className={styles.setupMain}>
        <button
          className={styles.textButton}
          type="button"
          onClick={() => navigate("/")}
        >
          <span aria-hidden="true">←</span> {t("back")}
        </button>

        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>
            {t(draft.sport)} · {t(draft.mode)}
          </p>
          <h1>{t("setupTitle")}</h1>
          <p>{t("setupIntro")}</p>
        </div>

        <form className={styles.setupForm} onSubmit={submit}>
          <RulesSelector
            allowGuestCustom={allowGuestCustom}
            communityRules={communityRules}
            customRules={customRules}
            onCommunityRuleSelect={(id) => void chooseCommunityRule(id)}
            onRuleSourceChange={changeRuleSource}
            onRulesChange={updateRules}
            ruleSource={ruleSource}
            selectedCommunityRuleId={selectedCommunityRuleId}
          />

          <TeamFields
            label={t("teamA")}
            names={[names[0] ?? "", names[1] ?? ""]}
            playerLabels={[t("player1"), t("player2")]}
            onChange={(index, value) => updateName(index, value)}
          />
          <TeamFields
            label={t("teamB")}
            names={[names[2] ?? "", names[3] ?? ""]}
            playerLabels={[t("player1"), t("player2")]}
            onChange={(index, value) => updateName(index + 2, value)}
          />

          <label className={styles.selectField}>
            <span>{t("firstServer")}</span>
            <select
              value={firstServer}
              onChange={(event) => setFirstServer(event.target.value)}
            >
              <option value="A-0">
                {names[0]?.trim() || `${t("teamA")} · ${t("player1")}`}
              </option>
              <option value="A-1">
                {names[1]?.trim() || `${t("teamA")} · ${t("player2")}`}
              </option>
              <option value="B-0">
                {names[2]?.trim() || `${t("teamB")} · ${t("player1")}`}
              </option>
              <option value="B-1">
                {names[3]?.trim() || `${t("teamB")} · ${t("player2")}`}
              </option>
            </select>
          </label>

          <button className={styles.primaryButton} type="submit">
            {t("startMatch")} <span aria-hidden="true">→</span>
          </button>
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
  allowGuestCustom,
  communityRules,
  customRules,
  onCommunityRuleSelect,
  onRuleSourceChange,
  onRulesChange,
  ruleSource,
  selectedCommunityRuleId,
}: {
  allowGuestCustom: boolean;
  communityRules: Array<{ id: string; title: string; version: number }>;
  customRules: ScoringRules;
  onCommunityRuleSelect: (ruleId: string) => void;
  onRuleSourceChange: (
    source: "official" | "guest_custom" | "community",
  ) => void;
  onRulesChange: <Key extends keyof ScoringRules>(
    key: Key,
    value: ScoringRules[Key],
  ) => void;
  ruleSource: "official" | "guest_custom" | "community";
  selectedCommunityRuleId: string;
}) {
  const { t } = useLocale();

  return (
    <fieldset className={styles.rulesGroup}>
      <legend>{t("rulesTitle")}</legend>
      <div className={styles.rulesChoices}>
        <label
          className={styles.ruleChoice}
          data-selected={ruleSource === "official"}
        >
          <input
            type="radio"
            name="rules-source"
            checked={ruleSource === "official"}
            onChange={() => onRuleSourceChange("official")}
          />
          <span>
            <strong>{t("officialRules")}</strong>
            <small>{t("officialLocked")}</small>
          </span>
        </label>
        {communityRules.length ? (
          <label
            className={styles.ruleChoice}
            data-selected={ruleSource === "community"}
          >
            <input
              type="radio"
              name="rules-source"
              checked={ruleSource === "community"}
              onChange={() => onRuleSourceChange("community")}
            />
            <span>
              <strong>{t("communityRules")}</strong>
              <small>{t("rulesUnofficial")}</small>
            </span>
          </label>
        ) : null}
        {allowGuestCustom ? (
          <label
            className={styles.ruleChoice}
            data-selected={ruleSource === "guest_custom"}
          >
            <input
              type="radio"
              name="rules-source"
              checked={ruleSource === "guest_custom"}
              onChange={() => onRuleSourceChange("guest_custom")}
            />
            <span>
              <strong>{t("customRules")}</strong>
              <small>{t("rulesUnofficial")}</small>
            </span>
          </label>
        ) : null}
      </div>

      {ruleSource === "community" && communityRules.length ? (
        <label className={styles.selectField}>
          <span>{t("selectCommunityRules")}</span>
          <select
            value={selectedCommunityRuleId}
            onChange={(event) => onCommunityRuleSelect(event.target.value)}
          >
            <option value="">{t("selectCommunityRules")}</option>
            {communityRules.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.title} · v{rule.version}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {ruleSource === "guest_custom" ? (
        <div className={styles.ruleEditor}>
          <p>{t("customRulesNotice")}</p>
          <div className={styles.ruleFields}>
            <label>
              <span>{t("pointsToWin")}</span>
              <input
                type="number"
                min="1"
                max="101"
                value={customRules.pointsToWin}
                onChange={(event) =>
                  onRulesChange("pointsToWin", Number(event.target.value))
                }
                required
              />
            </label>
            <label>
              <span>{t("winBy")}</span>
              <input
                type="number"
                min="1"
                max="10"
                value={customRules.winBy}
                onChange={(event) =>
                  onRulesChange("winBy", Number(event.target.value))
                }
                required
              />
            </label>
            <label>
              <span>{t("maxPoints")}</span>
              <input
                type="number"
                min={customRules.pointsToWin}
                max="101"
                value={customRules.maxPoints ?? ""}
                onChange={(event) =>
                  onRulesChange(
                    "maxPoints",
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                  )
                }
              />
            </label>
            <label>
              <span>{t("bestOf")}</span>
              <select
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
              </select>
            </label>
            <label>
              <span>{t("scoringMode")}</span>
              <select
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
              </select>
            </label>
            {customRules.scoringMode === "side_out" ? (
              <>
                <label>
                  <span>{t("serversPerTurn")}</span>
                  <select
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
                  </select>
                </label>
                <label>
                  <span>{t("openingServerNumber")}</span>
                  <select
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
                  </select>
                </label>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

interface TeamFieldsProps {
  label: string;
  names: [string, string];
  playerLabels: [string, string];
  onChange: (index: number, value: string) => void;
}

function TeamFields({ label, names, playerLabels, onChange }: TeamFieldsProps) {
  return (
    <fieldset className={styles.teamFields}>
      <legend>{label}</legend>
      {names.map((name, index) => (
        <label key={playerLabels[index]}>
          <span>{playerLabels[index]}</span>
          <input
            autoComplete="off"
            maxLength={30}
            placeholder={playerLabels[index]}
            value={name}
            onChange={(event) => onChange(index, event.target.value)}
          />
        </label>
      ))}
    </fieldset>
  );
}

function isScoringRules(value: unknown): value is ScoringRules {
  if (!value || typeof value !== "object") return false;
  const rules = value as Partial<ScoringRules>;
  return (
    Number.isInteger(rules.pointsToWin) &&
    Number.isInteger(rules.winBy) &&
    (rules.maxPoints === null || Number.isInteger(rules.maxPoints)) &&
    (rules.bestOf === 1 || rules.bestOf === 3 || rules.bestOf === 5) &&
    (rules.scoringMode === "rally" || rules.scoringMode === "side_out") &&
    (rules.serversPerTurn === 1 || rules.serversPerTurn === 2) &&
    (rules.openingServerNumber === 1 || rules.openingServerNumber === 2)
  );
}
