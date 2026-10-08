import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  awardRally,
  deriveJournal,
  overrideState,
  redo,
  undo,
  type EventMetadata,
  type MatchJournal,
  type TeamId,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { useLocale } from "../../lib/i18n";
import { loadMatch, removeMatch, saveMatch } from "../../lib/session";
import { Court } from "./Court";
import { OverrideDialog } from "./OverrideDialog";
import styles from "../../styles/App.module.css";

const eventMetadata = (): EventMetadata => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
});

export function MatchPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { t } = useLocale();
  const [journal, setJournal] = useState<MatchJournal | null>(() =>
    matchId ? loadMatch(matchId) : null,
  );
  const overrideDialog = useRef<HTMLDialogElement>(null);
  const endDialog = useRef<HTMLDialogElement>(null);
  const view = useMemo(
    () => (journal ? deriveJournal(journal) : null),
    [journal],
  );

  function commit(next: MatchJournal) {
    setJournal(next);
    saveMatch(next);
  }

  function rally(team: TeamId) {
    if (journal) commit(awardRally(journal, team, eventMetadata()));
  }

  function endSession() {
    if (matchId) removeMatch(matchId);
    navigate("/");
  }

  if (!journal || !view) {
    return (
      <div className={styles.pageShell}>
        <AppHeader />
        <main className={styles.emptyState}>
          <span className={styles.emptyMark} aria-hidden="true">
            ?
          </span>
          <h1>{t("missingTitle")}</h1>
          <p>{t("missingBody")}</p>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => navigate("/")}
          >
            {t("newMatch")}
          </button>
        </main>
      </div>
    );
  }

  const { definition } = journal;
  const { state } = view;
  const actionLabel =
    definition.sport === "badminton" ? t("pointFor") : t("rallyFor");

  return (
    <div className={styles.matchShell}>
      <AppHeader compact />
      <main className={styles.matchMain}>
        <div className={styles.matchTopline}>
          <div>
            <p className={styles.eyebrow}>
              {t(definition.sport)} · {t(definition.mode)}
            </p>
            <h1>
              {t("game")} {state.gameNumber}
            </h1>
          </div>
          <div className={styles.rulesBadge}>
            <strong>{t("officialRules")}</strong>
            <span aria-hidden="true">✓</span>
          </div>
        </div>

        {state.status === "complete" ? (
          <section className={styles.winnerBanner} aria-live="polite">
            <span>{t("matchComplete")}</span>
            <strong>
              {t("winner")}: {definition.teams[state.winner!].name}
            </strong>
          </section>
        ) : null}

        <section className={styles.scoreboard} aria-label="Score">
          {(["A", "B"] as const).map((team) => (
            <article
              className={styles.scoreCard}
              data-serving={state.servingTeam === team}
              key={team}
            >
              <div className={styles.teamMeta}>
                <span>{definition.teams[team].name}</span>
                <small>
                  {t("sets")}: {state.gamesWon[team]}
                </small>
              </div>
              <button
                className={styles.scoreButton}
                type="button"
                aria-label={`${t("correction")}: ${definition.teams[team].name}`}
                disabled={state.status === "complete"}
                onClick={() => overrideDialog.current?.showModal()}
              >
                {state.points[team]}
              </button>
              <div className={styles.playerNames}>
                {definition.teams[team].players.map((player) => (
                  <span key={player.id}>{player.name}</span>
                ))}
              </div>
            </article>
          ))}
        </section>

        <Court definition={definition} state={state} />

        <section className={styles.matchActions} aria-label="Match controls">
          <div className={styles.rallyActions}>
            {(["A", "B"] as const).map((team) => (
              <button
                className={styles.scoreAction}
                type="button"
                disabled={state.status === "complete"}
                onClick={() => rally(team)}
                key={team}
              >
                <span>+ {actionLabel}</span>
                <strong>{definition.teams[team].name}</strong>
              </button>
            ))}
          </div>

          <div className={styles.historyActions}>
            <button
              className={styles.controlButton}
              type="button"
              disabled={!view.canUndo}
              onClick={() => commit(undo(journal, eventMetadata()))}
            >
              <span aria-hidden="true">↶</span> {t("undo")}
            </button>
            <button
              className={styles.controlButton}
              type="button"
              disabled={!view.canRedo}
              onClick={() => commit(redo(journal, eventMetadata()))}
            >
              {t("redo")} <span aria-hidden="true">↷</span>
            </button>
            <button
              className={styles.controlButton}
              type="button"
              disabled={state.status === "complete"}
              onClick={() => overrideDialog.current?.showModal()}
            >
              <span aria-hidden="true">✎</span> {t("correction")}
            </button>
          </div>

          <button
            className={styles.dangerTextButton}
            type="button"
            onClick={() => endDialog.current?.showModal()}
          >
            {state.status === "complete" ? t("newMatch") : t("endSession")}
          </button>
        </section>
      </main>

      <OverrideDialog
        dialogRef={overrideDialog}
        state={state}
        onSave={(points) =>
          commit(overrideState(journal, points, eventMetadata()))
        }
      />

      <dialog className={styles.dialog} ref={endDialog}>
        <div className={styles.dialogBody}>
          <h2>{state.status === "complete" ? t("newMatch") : t("endTitle")}</h2>
          <p>{t("endBody")}</p>
          <div className={styles.dialogActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => endDialog.current?.close()}
            >
              {t("cancel")}
            </button>
            <button
              className={styles.dangerButton}
              type="button"
              onClick={endSession}
            >
              {t("confirmEnd")}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
