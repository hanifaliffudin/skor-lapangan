import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
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
import { useAuth } from "../../lib/auth";
import { useLocale } from "../../lib/i18n";
import { loadMatch, removeMatch, saveMatch } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { syncJournal } from "../../lib/sync";
import { isRateLimitError } from "../../lib/userError";
import { Court } from "./Court";
import { OverrideDialog } from "./OverrideDialog";
import { useMatchControl } from "./useMatchControl";
import styles from "../../styles/App.module.css";

const eventMetadata = (): EventMetadata => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
});

export function MatchPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { t } = useLocale();
  const { user, isAnonymous } = useAuth();
  const {
    status: controlStatus,
    canControl,
    retry: retryControl,
  } = useMatchControl(matchId);
  const [journal, setJournal] = useState<MatchJournal | null>(() =>
    matchId ? loadMatch(matchId) : null,
  );
  const [syncState, setSyncState] = useState<
    "local" | "syncing" | "synced" | "offline" | "error"
  >("local");
  const [syncError, setSyncError] = useState("");
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerBusy, setViewerBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const overrideDialog = useRef<HTMLDialogElement>(null);
  const endDialog = useRef<HTMLDialogElement>(null);
  const view = useMemo(
    () => (journal ? deriveJournal(journal) : null),
    [journal],
  );

  useEffect(() => {
    if (!matchId) return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === `skor-lapangan:match:${matchId}`) {
        setJournal(loadMatch(matchId));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [matchId]);

  useEffect(() => {
    if (!journal || !user) {
      setSyncState("local");
      setSyncError("");
      return;
    }

    let active = true;
    const synchronize = async () => {
      if (!navigator.onLine) {
        setSyncState("offline");
        setSyncError("");
        return;
      }
      setSyncState("syncing");
      setSyncError("");
      const result = await syncJournal(journal, user.id, isAnonymous);
      if (!active) return;
      setSyncState(
        result.status === "synced"
          ? "synced"
          : result.status === "failed"
            ? "error"
            : "local",
      );
      setSyncError(result.status === "failed" ? result.error : "");
    };
    const handleOnline = () => void synchronize();
    void synchronize();
    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
    };
  }, [journal, user, isAnonymous, syncAttempt]);

  function commit(next: MatchJournal) {
    const nextView = deriveJournal(next);
    if (
      !next.finalState &&
      next.definition.ruleset?.source === "guest_custom" &&
      nextView.state.status === "complete"
    ) {
      next = {
        ...next,
        definition: {
          ...next.definition,
          ruleset: {
            id: next.definition.ruleset.id,
            name: next.definition.ruleset.name,
            sport: next.definition.ruleset.sport,
            source: "guest_custom",
            version: next.definition.ruleset.version,
          },
        },
        finalState: nextView.state,
      };
    }
    setJournal(next);
    saveMatch(next);
  }

  function rally(team: TeamId) {
    if (journal) commit(awardRally(journal, team, eventMetadata()));
  }

  async function createViewerLink() {
    if (!matchId || !supabase || !user) return;
    setViewerBusy(true);
    setShareMessage("");
    const { data, error } = await supabase.rpc("create_live_viewer_link", {
      p_match_id: matchId,
    });
    setViewerBusy(false);
    if (error || !data) {
      setShareMessage(
        error
          ? isRateLimitError(error.message)
            ? t("rateLimited")
            : error.message
          : t("shareFailed"),
      );
      return;
    }
    setViewerUrl(`${window.location.origin}/view/${data}`);
    setShareMessage(t("shareReady"));
  }

  async function copyViewerLink() {
    if (!viewerUrl) return;
    try {
      await navigator.clipboard.writeText(viewerUrl);
      setShareMessage(t("linkCopied"));
    } catch {
      setShareMessage(t("copyFailed"));
    }
  }

  async function shareViewerLink() {
    if (!viewerUrl || !navigator.share) {
      await copyViewerLink();
      return;
    }
    try {
      await navigator.share({ title: t("liveViewer"), url: viewerUrl });
    } catch {
      setShareMessage("");
    }
  }

  async function revokeViewerLink() {
    if (!matchId || !supabase) return;
    setViewerBusy(true);
    const { error } = await supabase.rpc("revoke_live_viewer_link", {
      p_match_id: matchId,
    });
    setViewerBusy(false);
    if (error) {
      setShareMessage(error.message);
      return;
    }
    setViewerUrl("");
    setShareMessage(t("shareRevoked"));
  }

  async function endSession() {
    if (matchId && supabase && user) {
      const { error } = await supabase.rpc("revoke_live_viewer_link", {
        p_match_id: matchId,
      });
      if (error) {
        setShareMessage(error.message);
        return;
      }
    }
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
          <div
            className={styles.rulesBadge}
            data-source={definition.ruleset?.source ?? "official"}
          >
            <strong>
              {definition.ruleset?.source === "guest_custom"
                ? t("matchCustomRules")
                : definition.ruleset?.source === "community"
                  ? t("communityRules")
                  : t("officialRules")}
            </strong>
            <span>
              {definition.ruleset?.source === "official"
                ? "✓"
                : t("rulesUnofficial")}
            </span>
          </div>
        </div>

        <p className={styles.syncStatus} role="status" data-state={syncState}>
          {t(
            syncState === "local"
              ? "syncLocal"
              : syncState === "synced"
                ? "syncSaved"
                : syncState === "syncing"
                  ? "syncing"
                  : syncState === "offline"
                    ? "syncOffline"
                    : "syncError",
          )}
          {syncError ? (
            <span className={styles.syncErrorDetail}>
              {isRateLimitError(syncError) ? t("rateLimited") : syncError}
            </span>
          ) : null}
        </p>
        {syncState === "error" ? (
          <button
            className={styles.syncRetryButton}
            type="button"
            onClick={() => setSyncAttempt((current) => current + 1)}
          >
            {t("retrySync")}
          </button>
        ) : null}
        {controlStatus !== "active" ? (
          <div className={styles.readOnlyNotice} role="status">
            <span>
              {t(
                controlStatus === "waiting"
                  ? "matchControlWaiting"
                  : "matchControlError",
              )}
            </span>
            {controlStatus === "error" ? (
              <button
                className={styles.controlButton}
                type="button"
                onClick={retryControl}
              >
                {t("retryControl")}
              </button>
            ) : null}
          </div>
        ) : null}

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
                disabled={state.status === "complete" || !canControl}
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
                disabled={state.status === "complete" || !canControl}
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
              disabled={!view.canUndo || !canControl}
              onClick={() => commit(undo(journal, eventMetadata()))}
            >
              <span aria-hidden="true">↶</span> {t("undo")}
            </button>
            <button
              className={styles.controlButton}
              type="button"
              disabled={!view.canRedo || !canControl}
              onClick={() => commit(redo(journal, eventMetadata()))}
            >
              {t("redo")} <span aria-hidden="true">↷</span>
            </button>
            <button
              className={styles.controlButton}
              type="button"
              disabled={state.status === "complete" || !canControl}
              onClick={() => overrideDialog.current?.showModal()}
            >
              <span aria-hidden="true">✎</span> {t("correction")}
            </button>
          </div>

          <button
            className={styles.dangerTextButton}
            type="button"
            disabled={!canControl}
            onClick={() => endDialog.current?.showModal()}
          >
            {state.status === "complete" ? t("newMatch") : t("endSession")}
          </button>

          {supabase ? (
            <section
              className={styles.shareControls}
              aria-label={t("liveViewer")}
            >
              <div>
                <strong>{t("liveViewer")}</strong>
                <p>{t("liveViewerDescription")}</p>
              </div>
              <div className={styles.shareActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={viewerBusy || !canControl || !user}
                  onClick={() => void createViewerLink()}
                >
                  {viewerBusy ? t("working") : t("createViewerLink")}
                </button>
                <button
                  className={styles.dangerTextButton}
                  type="button"
                  disabled={
                    viewerBusy || !canControl || !user || syncState !== "synced"
                  }
                  onClick={() => void revokeViewerLink()}
                >
                  {t("revokeViewerLink")}
                </button>
              </div>
              {viewerUrl ? (
                <div className={styles.viewerLink}>
                  <label>
                    <span>{t("viewerLink")}</span>
                    <input
                      readOnly
                      value={viewerUrl}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </label>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void copyViewerLink()}
                  >
                    {t("copyLink")}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void shareViewerLink()}
                  >
                    {t("shareLink")}
                  </button>
                  <div className={styles.ruleQr} aria-label={t("qrCode")}>
                    <QRCodeSVG
                      value={viewerUrl}
                      size={148}
                      level="M"
                      includeMargin
                    />
                  </div>
                </div>
              ) : null}
              {shareMessage ? <p role="status">{shareMessage}</p> : null}
            </section>
          ) : null}
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
              onClick={() => void endSession()}
            >
              {t("confirmEnd")}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
