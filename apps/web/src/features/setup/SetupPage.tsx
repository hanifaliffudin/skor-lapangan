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
  type TennisGender,
  type TennisRules,
  type TennisSetOrders,
  type PadelGender,
  type PadelRules,
  type PadelSetOrders,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { localizedPath, useLocale } from "../../lib/i18n";
import { loadDraft, saveDraft, saveMatch } from "../../lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectControl } from "@/components/ui/select-control";
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
  const [tennisRules, setTennisRules] =
    useState<TennisRules>(defaultTennisRules);
  const [padelRules, setPadelRules] = useState<PadelRules>(defaultPadelRules);
  const [firstServingTeam, setFirstServingTeam] = useState<TeamId>("A");
  const [firstServerByTeam, setFirstServerByTeam] = useState<
    Record<TeamId, PlayerIndex>
  >({ A: 0, B: 0 });
  const [deuceReceiverByTeam, setDeuceReceiverByTeam] = useState<
    Record<TeamId, PlayerIndex>
  >({ A: 0, B: 0 });
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

  function changeRuleSource(source: "official" | "guest_custom") {
    setRuleSource(source);
    if (draft) saveDraft({ sport: draft.sport, format, mode: draft.mode });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;

    if (ruleSource !== "official" && !hasValidCustomRules(customRules)) {
      setRuleError(
        customRules.maxPoints !== null &&
          customRules.maxPoints < customRules.pointsToWin
          ? t("capMustBeAtLeastTarget")
          : t("customRulesInvalid"),
      );
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
    const id = crypto.randomUUID();
    const official = officialRulesetFor(
      draft.sport,
      format,
      officialScoringMode,
    );
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
    const customConfiguration: ScoringRules = {
      ...customRules,
      ...(format === "singles"
        ? { serversPerTurn: 1, openingServerNumber: 1 }
        : {}),
    };
    const ruleset: RulesetSnapshot =
      draft.sport === "tennis"
        ? {
            id: official.id,
            name: official.name,
            sport: "tennis",
            format,
            source: "official",
            version: official.version,
            configuration: { ...official.configuration! },
            tennisConfiguration: { ...tennisRules },
          }
        : draft.sport === "padel"
          ? {
              id: official.id,
              name: official.name,
              sport: "padel",
              format,
              source: official.source,
              version: official.version,
              configuration: { ...official.configuration! },
              padelConfiguration: { ...padelRules },
            }
          : ruleSource === "official"
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
      initialServingTeam:
        draft.sport === "tennis" || draft.sport === "padel"
          ? firstServingTeam
          : team,
      initialServingPlayer:
        format === "singles"
          ? 0
          : draft.sport === "tennis" || draft.sport === "padel"
            ? selectedSetOrders.serviceOrder[firstServingTeam][0]
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
    const journal: MatchJournal = { definition, events: [] };
    saveMatch(journal);
    navigate(localizedPath(`/match/${id}`, locale));
  }

  return (
    <div className="min-h-screen min-h-dvh bg-paper pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <AppHeader compact />
      <main className="mx-auto w-full max-w-[720px] px-[clamp(18px,5vw,40px)] pt-8 pb-16">
        <Button
          variant="outline"
          className={styles.textButton}
          type="button"
          onClick={() => navigate(localizedPath("/", locale))}
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
          <p>{t("setupIntro")}</p>
        </div>

        <form className={styles.setupForm} onSubmit={submit}>
          <RulesSelector
            customRules={customRules}
            format={format}
            officialScoringMode={officialScoringMode}
            tennisRules={tennisRules}
            padelRules={padelRules}
            onRuleSourceChange={changeRuleSource}
            onOfficialScoringModeChange={setOfficialScoringMode}
            onRulesChange={updateRules}
            onTennisRulesChange={updateTennisRules}
            onPadelRulesChange={updatePadelRules}
            ruleSource={ruleSource}
            sport={draft.sport}
          />

          <TeamFields
            label={t("teamA")}
            teamKey="a"
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

          <Button className={styles.primaryButton} type="submit">
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
  onRuleSourceChange,
  onOfficialScoringModeChange,
  onRulesChange,
  onTennisRulesChange,
  onPadelRulesChange,
  ruleSource,
  sport,
}: {
  customRules: ScoringRules;
  format: MatchFormat;
  officialScoringMode: ScoringMode;
  tennisRules: TennisRules;
  padelRules: PadelRules;
  onRuleSourceChange: (source: "official" | "guest_custom") => void;
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
  ruleSource: "official" | "guest_custom";
  sport: MatchDefinition["sport"];
}) {
  const { t } = useLocale();

  if (sport === "tennis") {
    return (
      <TennisRulesFields rules={tennisRules} onChange={onTennisRulesChange} />
    );
  }
  if (sport === "padel") {
    return (
      <PadelRulesFields
        format={format}
        rules={padelRules}
        onChange={onPadelRulesChange}
      />
    );
  }

  return (
    <fieldset className={styles.rulesGroup}>
      <legend>{t("rulesTitle")}</legend>
      <RadioGroup
        className={styles.rulesChoices}
        name="rules-source"
        value={ruleSource}
        onValueChange={(value) =>
          onRuleSourceChange(value as "official" | "guest_custom")
        }
      >
        <RadioGroupItem
          className={styles.ruleChoice}
          data-selected={ruleSource === "official"}
          value="official"
        >
          <span>
            <strong>{t("officialRules")}</strong>
            <small>{t("officialLocked")}</small>
          </span>
        </RadioGroupItem>
        <RadioGroupItem
          className={styles.ruleChoice}
          data-selected={ruleSource === "guest_custom"}
          value="guest_custom"
        >
          <span>
            <strong>{t("customRules")}</strong>
            <small>{t("rulesUnofficial")}</small>
          </span>
        </RadioGroupItem>
      </RadioGroup>

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
                type="number"
                min="1"
                max="101"
                step="1"
                inputMode="numeric"
                value={customRules.pointsToWin}
                onChange={(event) =>
                  onRulesChange("pointsToWin", Number(event.target.value))
                }
                required
              />
            </Label>
            <Label>
              <span>{t("winBy")}</span>
              <Input
                name="custom-win-by"
                type="number"
                min="1"
                max="10"
                step="1"
                inputMode="numeric"
                value={customRules.winBy}
                onChange={(event) =>
                  onRulesChange("winBy", Number(event.target.value))
                }
                required
              />
            </Label>
            <Label>
              <span>{t("maxPoints")}</span>
              <Input
                name="custom-max-points"
                type="number"
                min={customRules.pointsToWin}
                max="101"
                step="1"
                inputMode="numeric"
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
            {customRules.scoringMode === "side_out" && format === "doubles" ? (
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
  rules,
  onChange,
}: {
  rules: TennisRules;
  onChange: <Key extends keyof TennisRules>(
    key: Key,
    value: TennisRules[Key],
  ) => void;
}) {
  const { t } = useLocale();
  return (
    <fieldset className={styles.rulesGroup}>
      <legend>{t("tennisFormatTitle")}</legend>
      <p className={styles.fieldHint}>{t("tennisRulesSource")}</p>
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
  rules,
  onChange,
}: {
  format: MatchFormat;
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
        {t(format === "singles" ? "padelLocalFormatTitle" : "padelFormatTitle")}
      </legend>
      <p className={styles.fieldHint}>
        {t(format === "singles" ? "padelLocalRulesSource" : "padelRulesSource")}
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
  teamKey: "a" | "b";
  onChange: (index: number, value: string) => void;
}

function TeamFields({
  label,
  names,
  playerLabels,
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
            onChange={(event) => onChange(index, event.target.value)}
          />
        </Label>
      ))}
    </fieldset>
  );
}
