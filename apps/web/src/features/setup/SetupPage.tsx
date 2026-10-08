import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  officialRulesetFor,
  type MatchDefinition,
  type MatchJournal,
  type PlayerIndex,
  type TeamId,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { useLocale } from "../../lib/i18n";
import { loadDraft, saveMatch } from "../../lib/session";
import styles from "../../styles/App.module.css";

export function SetupPage() {
  const draft = loadDraft();
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const [names, setNames] = useState(["", "", "", ""]);
  const [firstServer, setFirstServer] = useState("A-0");

  if (!draft) return <Navigate to="/" replace />;

  function updateName(index: number, value: string) {
    setNames((current) =>
      current.map((name, itemIndex) => (itemIndex === index ? value : name)),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;

    const [team, player] = firstServer.split("-") as [TeamId, `${PlayerIndex}`];
    const fallback = (teamId: TeamId, playerIndex: number) =>
      locale === "id"
        ? `Pemain ${teamId}${playerIndex + 1}`
        : `Player ${teamId}${playerIndex + 1}`;
    const cleanName = (index: number, teamId: TeamId, playerIndex: number) =>
      names[index]?.trim() || fallback(teamId, playerIndex);
    const id = crypto.randomUUID();
    const definition: MatchDefinition = {
      id,
      sport: draft.sport,
      rulesetId: officialRulesetFor(draft.sport).id,
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
        </form>
      </main>
    </div>
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
