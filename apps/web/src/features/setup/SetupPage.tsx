import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  getMatchFormat,
  officialRulesetFor,
  type MatchFormat,
  type MatchDefinition,
  type MatchJournal,
  type ScoringRules,
  type ScoringMode,
  type RulesetSnapshot,
  type PlayerIndex,
  type TeamId,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { localizedPath, useLocale } from "../../lib/i18n";
import { loadDraft, saveDraft, saveMatch } from "../../lib/session";
import styles from "../../styles/App.module.css";

export function SetupPage() {
  const draft = loadDraft();
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const [names, setNames] = useState(["", "", "", ""]);
  const [firstServer, setFirstServer] = useState("A-0");
  const [officialScoringMode, setOfficialScoringMode] =
    useState<ScoringMode>("side_out");
  const [ruleSource, setRuleSource] = useState<"official" | "guest_custom">(
    "official",
  );
  const [ruleError, setRuleError] = useState("");
  const [customRules, setCustomRules] = useState<ScoringRules>(() => ({
    ...officialRulesetFor(
      draft?.sport ?? "badminton",
      draft?.format ?? "doubles",
    ).configuration,
  }));

  if (!draft) return <Navigate to={localizedPath("/", locale)} replace />;

  const format = getMatchFormat(draft);
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

  function changeRuleSource(source: "official" | "guest_custom") {
    setRuleSource(source);
    if (draft) saveDraft({ sport: draft.sport, format, mode: draft.mode });
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
    setRuleError("");

    const [team, player] = firstServer.split("-") as [TeamId, `${PlayerIndex}`];
    const fallback = (teamId: TeamId, playerIndex: number) =>
      locale === "id"
        ? `Pemain ${teamId}${playerIndex + 1}`
        : `Player ${teamId}${playerIndex + 1}`;
    const cleanName = (index: number, teamId: TeamId, playerIndex: number) =>
      names[index]?.trim() || fallback(teamId, playerIndex);
    const id = crypto.randomUUID();
    const official = officialRulesetFor(
      draft.sport,
      format,
      officialScoringMode,
    );
    const customConfiguration: ScoringRules = {
      ...customRules,
      ...(format === "singles"
        ? { serversPerTurn: 1, openingServerNumber: 1 }
        : {}),
    };
    const ruleset: RulesetSnapshot =
      ruleSource === "official"
        ? {
            id: official.id,
            name: official.name,
            sport: draft.sport,
            format,
            source: "official",
            version: official.version,
            configuration: { ...official.configuration },
          }
        : {
            id: `guest-${crypto.randomUUID()}`,
            name: t("customRules"),
            sport: draft.sport,
            format,
            source: "guest_custom",
            version: 1,
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
      initialServingTeam: team,
      initialServingPlayer:
        format === "singles" ? 0 : (Number(player) as PlayerIndex),
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
    const journal: MatchJournal = { definition, events: [] };
    saveMatch(journal);
    navigate(localizedPath(`/match/${id}`, locale));
  }

  return (
    <div className={styles.pageShell}>
      <AppHeader compact />
      <main className={styles.setupMain}>
        <button
          className={styles.textButton}
          type="button"
          onClick={() => navigate(localizedPath("/", locale))}
        >
          <span aria-hidden="true">←</span> {t("back")}
        </button>

        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>
            {t(draft.sport)} · {t(format)} · {t(draft.mode)}
          </p>
          <h1>{t("setupTitle")}</h1>
          <p>{t("setupIntro")}</p>
        </div>

        <form className={styles.setupForm} onSubmit={submit}>
          <RulesSelector
            customRules={customRules}
            format={format}
            officialScoringMode={officialScoringMode}
            onRuleSourceChange={changeRuleSource}
            onOfficialScoringModeChange={setOfficialScoringMode}
            onRulesChange={updateRules}
            ruleSource={ruleSource}
            sport={draft.sport}
          />

          <TeamFields
            label={t("teamA")}
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
            names={Array.from(
              { length: playerCount },
              (_, index) => names[index + 2] ?? "",
            )}
            playerLabels={Array.from({ length: playerCount }, (_, index) =>
              index === 0 ? t("player1") : t("player2"),
            )}
            onChange={(index, value) => updateName(index + 2, value)}
          />

          <label className={styles.selectField}>
            <span>{t("firstServer")}</span>
            <select
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
  customRules,
  format,
  officialScoringMode,
  onRuleSourceChange,
  onOfficialScoringModeChange,
  onRulesChange,
  ruleSource,
  sport,
}: {
  customRules: ScoringRules;
  format: MatchFormat;
  officialScoringMode: ScoringMode;
  onRuleSourceChange: (source: "official" | "guest_custom") => void;
  onOfficialScoringModeChange: (mode: ScoringMode) => void;
  onRulesChange: <Key extends keyof ScoringRules>(
    key: Key,
    value: ScoringRules[Key],
  ) => void;
  ruleSource: "official" | "guest_custom";
  sport: MatchDefinition["sport"];
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
      </div>

      {ruleSource === "official" &&
      sport === "pickleball" &&
      format === "singles" ? (
        <label className={styles.selectField}>
          <span>{t("scoringMode")}</span>
          <select
            value={officialScoringMode}
            onChange={(event) =>
              onOfficialScoringModeChange(event.target.value as ScoringMode)
            }
          >
            <option value="side_out">{t("sideOutStandard")}</option>
            <option value="rally">{t("rallyScoring")}</option>
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
            {customRules.scoringMode === "side_out" && format === "doubles" ? (
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
  names: string[];
  playerLabels: string[];
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
