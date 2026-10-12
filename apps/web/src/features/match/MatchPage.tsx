import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  awardRally,
  canSelectPadelDecidingSide,
  canSelectTennisDecidingSide,
  confirmPadelSetOrders,
  confirmTennisSetOrders,
  deriveJournal,
  getMatchFormat,
  isTennisNoAdDecidingPoint,
  isPadelDecidingPoint,
  overridePadelScore,
  overrideTennisScore,
  overrideState,
  padelRulesFor,
  padelScoreLabel,
  redo,
  selectTennisDecidingSide,
  selectPadelDecidingSide,
  tennisRulesFor,
  tennisScoreLabel,
  undo,
  type EventMetadata,
  type MatchDefinition,
  type MatchJournal,
  type MatchState,
  type TeamId,
  type TennisSetOrders,
  type PadelSetOrders,
  type PadelRules,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../lib/auth";
import { localizedPath, useLocale } from "../../lib/i18n";
import { loadMatch, removeMatch, saveMatch } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { syncJournal } from "../../lib/sync";
import {
  isRateLimitError,
  isUnsupportedMatchSportError,
} from "../../lib/userError";
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
  const { locale, t } = useLocale();
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
  const schemaBlockedMatches = useRef(new Set<string>());
  const previousSyncAttempt = useRef(0);
  const overrideDialog = useRef<HTMLDialogElement>(null);
  const setOrdersDialog = useRef<HTMLDialogElement>(null);
  const endDialog = useRef<HTMLDialogElement>(null);
  const [nextSetOrders, setNextSetOrders] = useState<TennisSetOrders | null>(
    null,
  );
  const [nextPadelOrders, setNextPadelOrders] = useState<PadelSetOrders | null>(
    null,
  );
  const view = useMemo(
    () => (journal ? deriveJournal(journal) : null),
    [journal],
  );

  useEffect(() => {
    const currentTennis = view?.state.tennis;
    const dialog = setOrdersDialog.current;
    if (!currentTennis?.awaitingSetOrders) {
      if (dialog?.open) dialog.close();
      setNextSetOrders(null);
      return;
    }
    setNextSetOrders(currentTennis.setOrders);
  }, [view?.state.tennis?.awaitingSetOrders, view?.state.tennis?.setNumber]);

  useEffect(() => {
    const current = view?.state.padel;
    const dialog = setOrdersDialog.current;
    if (!current?.awaitingSetOrders) {
      if (!view?.state.tennis?.awaitingSetOrders && dialog?.open)
        dialog.close();
      setNextPadelOrders(null);
      return;
    }
    setNextPadelOrders(current.setOrders);
  }, [view?.state.padel?.awaitingSetOrders, view?.state.padel?.setNumber]);

  useEffect(() => {
    const dialog = setOrdersDialog.current;
    if (
      dialog &&
      view?.state.tennis?.awaitingSetOrders &&
      nextSetOrders &&
      !dialog.open
    ) {
      dialog.showModal();
    }
  }, [nextSetOrders, view?.state.tennis?.awaitingSetOrders]);

  useEffect(() => {
    const dialog = setOrdersDialog.current;
    if (
      dialog &&
      view?.state.padel?.awaitingSetOrders &&
      nextPadelOrders &&
      !dialog.open
    )
      dialog.showModal();
  }, [nextPadelOrders, view?.state.padel?.awaitingSetOrders]);

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

    const manualRetry = syncAttempt !== previousSyncAttempt.current;
    previousSyncAttempt.current = syncAttempt;
    let active = true;
    const synchronize = async (retrySchemaBlocked = manualRetry) => {
      if (!navigator.onLine) {
        setSyncState("offline");
        setSyncError("");
        return;
      }
      const currentMatchId = journal.definition.id;
      if (
        schemaBlockedMatches.current.has(currentMatchId) &&
        !retrySchemaBlocked
      ) {
        setSyncState("error");
        return;
      }
      setSyncState("syncing");
      setSyncError("");
      const result = await syncJournal(journal, user.id, isAnonymous);
      if (!active) return;
      if (
        result.status === "failed" &&
        isUnsupportedMatchSportError(result.error)
      ) {
        schemaBlockedMatches.current.add(currentMatchId);
      } else if (result.status === "synced") {
        schemaBlockedMatches.current.delete(currentMatchId);
      }
      setSyncState(
        result.status === "synced"
          ? "synced"
          : result.status === "failed"
            ? "error"
            : "local",
      );
      setSyncError(result.status === "failed" ? result.error : "");
    };
    const handleOnline = () => void synchronize(true);
    void synchronize(manualRetry);
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
    setViewerUrl(
      `${window.location.origin}${localizedPath(`/view/${data}`, locale)}`,
    );
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
    navigate(localizedPath("/", locale));
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
            onClick={() => navigate(localizedPath("/", locale))}
          >
            {t("newMatch")}
          </button>
        </main>
      </div>
    );
  }

  const { definition } = journal;
  const { state } = view;
  const tennis = state.tennis;
  const padel = state.padel;
  const isTennis = definition.sport === "tennis" && Boolean(tennis);
  const isPadel = definition.sport === "padel" && Boolean(padel);
  const isRacket = isTennis || isPadel;
  const awaitingOrders = Boolean(
    tennis?.awaitingSetOrders || padel?.awaitingSetOrders,
  );
  const actionLabel = isTennis
    ? t("tennisPointWon")
    : isPadel
      ? t("padelPointWon")
      : definition.sport === "badminton"
        ? t("pointFor")
        : t("rallyFor");

  return (
    <div className={styles.matchShell}>
      <AppHeader compact />
      <main className={styles.matchMain}>
        <div className={styles.matchTopline}>
          <div>
            <p className={styles.eyebrow}>
              {t(definition.sport)} · {t(getMatchFormat(definition))} ·{" "}
              {t(definition.mode)}
            </p>
            <h1>
              {isRacket
                ? `${t("set")} ${tennis?.setNumber ?? padel?.setNumber ?? 1}`
                : `${t("game")} ${state.gameNumber}`}
            </h1>
          </div>
          <div
            className={styles.rulesBadge}
            data-source={definition.ruleset?.source ?? "official"}
          >
            <strong>
              {isPadel && getMatchFormat(definition) === "singles"
                ? t("padelLocalVariant")
                : definition.ruleset?.source === "guest_custom"
                  ? t("matchCustomRules")
                  : definition.ruleset?.source === "community"
                    ? t("communityRules")
                    : t("officialRules")}
            </strong>
            <span>
              {definition.ruleset?.source === "official" &&
              !(isPadel && getMatchFormat(definition) === "singles")
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
          {syncError &&
          (isRateLimitError(syncError) ||
            isUnsupportedMatchSportError(syncError)) ? (
            <span className={styles.syncErrorDetail}>
              {isRateLimitError(syncError)
                ? t("rateLimited")
                : t("syncUnsupportedSport")}
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

        <section className={styles.scoreboard} aria-label={t("score")}>
          {(["A", "B"] as const).map((team) => (
            <article
              className={styles.scoreCard}
              data-serving={state.servingTeam === team}
              key={team}
            >
              <div className={styles.teamMeta}>
                <span>{definition.teams[team].name}</span>
                <small>
                  {isRacket ? t("tennisSets") : t("sets")}:{" "}
                  {isTennis
                    ? tennis!.setsWon[team]
                    : isPadel
                      ? padel!.setsWon[team]
                      : state.gamesWon[team]}
                </small>
                {isRacket ? (
                  <small>
                    {t("games")}:{" "}
                    {isTennis
                      ? tennis!.gamesInSet[team]
                      : padel!.gamesInSet[team]}
                  </small>
                ) : null}
              </div>
              <button
                className={styles.scoreButton}
                data-tennis={isTennis}
                data-padel={isPadel}
                type="button"
                aria-label={`${t("correction")}: ${definition.teams[team].name}`}
                disabled={
                  state.status === "complete" || !canControl || awaitingOrders
                }
                onClick={() => overrideDialog.current?.showModal()}
              >
                {isTennis
                  ? tennisScoreLabel(state, team, locale)
                  : isPadel
                    ? padelScoreLabel(state, team, locale)
                    : state.points[team]}
              </button>
              <div className={styles.playerNames}>
                {definition.teams[team].players.map((player) => (
                  <span key={player.id}>{player.name}</span>
                ))}
              </div>
            </article>
          ))}
        </section>

        {isTennis && tennis ? (
          <>
            {tennis.completedSets.length > 0 ? (
              <p className={styles.tennisSetLine}>
                {t("completedSets")}:{" "}
                {tennis.completedSets
                  .map(
                    (set, index) =>
                      `${set.score.A}–${set.score.B}${set.tieBreakScore ? ` (${set.tieBreakScore.A}–${set.tieBreakScore.B})` : ""}`,
                  )
                  .join(" · ")}
              </p>
            ) : null}
            {tennis.phase !== "game" ? (
              <p className={styles.tennisPhaseNote} role="status">
                {tennis.phase === "match_tiebreak"
                  ? t("matchTieBreak")
                  : t("tieBreak")}
                {tennis.phase === "match_tiebreak"
                  ? ` · ${tennisRulesFor(definition).matchTieBreakPoints} ${t("pointsByTwo")}`
                  : " · 7 " + t("pointsByTwo")}
              </p>
            ) : null}
            {isTennisNoAdDecidingPoint(definition, state) ? (
              <div
                className={styles.tennisPointChoice}
                aria-label={t("decidingPoint")}
              >
                <span>
                  {t("decidingPoint")} · {t("receiveFrom")}
                </span>
                {(["right", "left"] as const).map((side) => (
                  <button
                    type="button"
                    key={side}
                    aria-pressed={tennis.noAdReceivingSide === side}
                    disabled={
                      !canControl ||
                      !canSelectTennisDecidingSide(definition, state, side)
                    }
                    onClick={() =>
                      commit(
                        selectTennisDecidingSide(
                          journal,
                          side,
                          eventMetadata(),
                        ),
                      )
                    }
                  >
                    {t(side)}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {isPadel && padel ? (
          <>
            {padel.completedSets.length > 0 ? (
              <p className={styles.tennisSetLine}>
                {t("completedSets")}:{" "}
                {padel.completedSets
                  .map(
                    (set) =>
                      `${set.score.A}–${set.score.B}${set.tieBreakScore ? ` (${set.tieBreakScore.A}–${set.tieBreakScore.B})` : ""}`,
                  )
                  .join(" · ")}
              </p>
            ) : null}
            {padel.phase !== "game" ? (
              <p className={styles.tennisPhaseNote} role="status">
                {padel.phase === "match_tiebreak"
                  ? t("matchTieBreak")
                  : t("tieBreak")}
                {padel.phase === "match_tiebreak"
                  ? ` · ${padelRulesFor(definition).matchTieBreakPoints} ${t("pointsByTwo")}`
                  : ` · 7 ${t("pointsByTwo")}`}
              </p>
            ) : null}
            {isPadelDecidingPoint(definition, state) ? (
              <div
                className={styles.tennisPointChoice}
                aria-label={t("padelDecidingPoint")}
              >
                <span>
                  {t("padelDecidingPoint")} · {t("receiveFrom")}
                </span>
                {(["right", "left"] as const).map((side) => (
                  <button
                    type="button"
                    key={side}
                    aria-pressed={padel.decidingReceivingSide === side}
                    disabled={
                      !canControl ||
                      !canSelectPadelDecidingSide(definition, state, side)
                    }
                    onClick={() =>
                      commit(
                        selectPadelDecidingSide(journal, side, eventMetadata()),
                      )
                    }
                  >
                    {t(side)}
                  </button>
                ))}
              </div>
            ) : null}
            <p className={styles.fieldHint}>{t("padelCourtNote")}</p>
          </>
        ) : null}

        <Court definition={definition} state={state} />

        <section className={styles.matchActions} aria-label="Match controls">
          <div className={styles.rallyActions}>
            {(["A", "B"] as const).map((team) => (
              <button
                className={styles.scoreAction}
                type="button"
                disabled={
                  state.status === "complete" || !canControl || awaitingOrders
                }
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
              disabled={
                state.status === "complete" || !canControl || awaitingOrders
              }
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
                      name="viewer-link"
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

      {isTennis ? (
        <TennisCorrectionDialog
          dialogRef={overrideDialog}
          state={state}
          gameScoring={tennisRulesFor(definition).gameScoring}
          onSave={(score) =>
            commit(overrideTennisScore(journal, score, eventMetadata()))
          }
        />
      ) : isPadel ? (
        <PadelCorrectionDialog
          dialogRef={overrideDialog}
          state={state}
          rules={padelRulesFor(definition)}
          onSave={(score) =>
            commit(overridePadelScore(journal, score, eventMetadata()))
          }
        />
      ) : (
        <OverrideDialog
          dialogRef={overrideDialog}
          state={state}
          onSave={(points) =>
            commit(overrideState(journal, points, eventMetadata()))
          }
        />
      )}

      {tennis && nextSetOrders ? (
        <TennisSetOrdersDialog
          dialogRef={setOrdersDialog}
          definition={definition}
          orders={nextSetOrders}
          onOrdersChange={setNextSetOrders}
          onConfirm={() => {
            commit(
              confirmTennisSetOrders(journal, nextSetOrders, eventMetadata()),
            );
            setOrdersDialog.current?.close();
          }}
        />
      ) : null}

      {padel && nextPadelOrders ? (
        <PadelSetOrdersDialog
          dialogRef={setOrdersDialog}
          definition={definition}
          orders={nextPadelOrders}
          onOrdersChange={setNextPadelOrders}
          onConfirm={() => {
            commit(
              confirmPadelSetOrders(journal, nextPadelOrders, eventMetadata()),
            );
            setOrdersDialog.current?.close();
          }}
        />
      ) : null}

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

function TennisCorrectionDialog({
  dialogRef,
  state,
  gameScoring,
  onSave,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  state: MatchState;
  gameScoring: "advantage" | "no_ad";
  onSave: (score: {
    pointScore: Record<TeamId, number>;
    advantage: TeamId | null;
    tieBreakScore: Record<TeamId, number> | null;
    gamePointCount: number;
  }) => void;
}) {
  const { locale, t } = useLocale();
  const tennis = state.tennis;
  const isTieBreak = tennis?.phase !== "game";
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [advantage, setAdvantage] = useState("");
  const firstInput = useRef<HTMLInputElement>(null);
  const firstSelect = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const sync = () => {
      const score =
        tennis?.phase === "game" ? tennis.pointScore : tennis?.tieBreakScore;
      setScoreA(String(score?.A ?? 0));
      setScoreB(String(score?.B ?? 0));
      setAdvantage(tennis?.advantage ?? "");
      window.requestAnimationFrame(() => {
        if (isTieBreak) firstInput.current?.select();
        else firstSelect.current?.focus();
      });
    };
    dialog.addEventListener("toggle", sync);
    return () => dialog.removeEventListener("toggle", sync);
  }, [dialogRef, tennis]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tennis) return;
    const A = Number(scoreA);
    const B = Number(scoreB);
    if (!Number.isInteger(A) || !Number.isInteger(B) || A < 0 || B < 0) return;
    onSave({
      pointScore: isTieBreak ? { ...tennis.pointScore } : { A, B },
      advantage: isTieBreak
        ? null
        : advantage === "A" || advantage === "B"
          ? advantage
          : null,
      tieBreakScore: isTieBreak ? { A, B } : null,
      gamePointCount: tennis.gamePointCount,
    });
    dialogRef.current?.close();
  }

  if (!tennis) return null;
  return (
    <dialog className={styles.dialog} ref={dialogRef}>
      <form className={styles.dialogBody} onSubmit={submit}>
        <h2>{t("correction")}</h2>
        <p>
          {t(isTieBreak ? "correctionTieBreakScore" : "correctionGameScore")}
        </p>
        <div className={styles.overrideFields}>
          <label>
            <span>{t("teamA")}</span>
            {isTieBreak ? (
              <input
                name="tennis-tiebreak-team-a"
                ref={firstInput}
                type="number"
                min="0"
                inputMode="numeric"
                value={scoreA}
                onChange={(event) => setScoreA(event.target.value)}
                required
              />
            ) : (
              <select
                name="tennis-score-team-a"
                ref={firstSelect}
                value={scoreA}
                onChange={(event) => setScoreA(event.target.value)}
              >
                {[0, 1, 2, 3].map((value) => (
                  <option key={value} value={value}>
                    {value === 0
                      ? locale === "id"
                        ? "Nol"
                        : "Love"
                      : value === 1
                        ? "15"
                        : value === 2
                          ? "30"
                          : "40"}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label>
            <span>{t("teamB")}</span>
            {isTieBreak ? (
              <input
                name="tennis-tiebreak-team-b"
                type="number"
                min="0"
                inputMode="numeric"
                value={scoreB}
                onChange={(event) => setScoreB(event.target.value)}
                required
              />
            ) : (
              <select
                name="tennis-score-team-b"
                value={scoreB}
                onChange={(event) => setScoreB(event.target.value)}
              >
                {[0, 1, 2, 3].map((value) => (
                  <option key={value} value={value}>
                    {value === 0
                      ? locale === "id"
                        ? "Nol"
                        : "Love"
                      : value === 1
                        ? "15"
                        : value === 2
                          ? "30"
                          : "40"}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>
        {!isTieBreak && gameScoring === "advantage" ? (
          <label className={styles.selectField}>
            <span>{t("advantageScore")}</span>
            <select
              name="tennis-advantage-score"
              value={advantage}
              onChange={(event) => setAdvantage(event.target.value)}
            >
              <option value="">{t("deuce")}</option>
              <option value="A">{t("teamA")}</option>
              <option value="B">{t("teamB")}</option>
            </select>
          </label>
        ) : null}
        <div className={styles.dialogActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => dialogRef.current?.close()}
          >
            {t("cancel")}
          </button>
          <button className={styles.primaryButton} type="submit">
            {t("save")}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function PadelCorrectionDialog({
  dialogRef,
  state,
  rules,
  onSave,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  state: MatchState;
  rules: PadelRules;
  onSave: (score: {
    pointScore: Record<TeamId, number>;
    advantage: TeamId | null;
    starDeuces: number;
    tieBreakScore: Record<TeamId, number> | null;
    gamePointCount: number;
  }) => void;
}) {
  const { locale, t } = useLocale();
  const padel = state.padel;
  const isTieBreak = padel?.phase !== "game";
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [advantage, setAdvantage] = useState("");
  const [starDeuces, setStarDeuces] = useState("0");
  const firstInput = useRef<HTMLInputElement>(null);
  const firstSelect = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const sync = () => {
      const score =
        padel?.phase === "game" ? padel.pointScore : padel?.tieBreakScore;
      setScoreA(String(score?.A ?? 0));
      setScoreB(String(score?.B ?? 0));
      setAdvantage(padel?.advantage ?? "");
      setStarDeuces(String(padel?.starDeuces ?? 0));
      window.requestAnimationFrame(() => {
        if (isTieBreak) firstInput.current?.select();
        else firstSelect.current?.focus();
      });
    };
    dialog.addEventListener("toggle", sync);
    return () => dialog.removeEventListener("toggle", sync);
  }, [dialogRef, padel]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!padel) return;
    const A = Number(scoreA);
    const B = Number(scoreB);
    if (!Number.isInteger(A) || !Number.isInteger(B) || A < 0 || B < 0) return;
    onSave({
      pointScore: isTieBreak ? { ...padel.pointScore } : { A, B },
      advantage: isTieBreak || advantage === "" ? null : (advantage as TeamId),
      starDeuces: isTieBreak ? 0 : Number(starDeuces),
      tieBreakScore: isTieBreak ? { A, B } : null,
      gamePointCount: padel.gamePointCount,
    });
    dialogRef.current?.close();
  }

  if (!padel) return null;
  return (
    <dialog className={styles.dialog} ref={dialogRef}>
      <form className={styles.dialogBody} onSubmit={submit}>
        <h2>{t("correction")}</h2>
        <p>
          {t(isTieBreak ? "correctionTieBreakScore" : "correctionGameScore")}
        </p>
        <div className={styles.overrideFields}>
          {(["A", "B"] as const).map((team, index) => (
            <label key={team}>
              <span>{t(team === "A" ? "teamA" : "teamB")}</span>
              {isTieBreak ? (
                <input
                  name={`padel-tiebreak-team-${team.toLowerCase()}`}
                  ref={index === 0 ? firstInput : undefined}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={team === "A" ? scoreA : scoreB}
                  onChange={(event) =>
                    team === "A"
                      ? setScoreA(event.target.value)
                      : setScoreB(event.target.value)
                  }
                  required
                />
              ) : (
                <select
                  name={`padel-score-team-${team.toLowerCase()}`}
                  ref={index === 0 ? firstSelect : undefined}
                  value={team === "A" ? scoreA : scoreB}
                  onChange={(event) =>
                    team === "A"
                      ? setScoreA(event.target.value)
                      : setScoreB(event.target.value)
                  }
                >
                  {[0, 1, 2, 3].map((value) => (
                    <option key={value} value={value}>
                      {value === 0
                        ? locale === "id"
                          ? "Nol"
                          : "Love"
                        : value === 1
                          ? "15"
                          : value === 2
                            ? "30"
                            : "40"}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ))}
        </div>
        {!isTieBreak && rules.gameScoring !== "golden_point" ? (
          <label className={styles.selectField}>
            <span>{t("advantageScore")}</span>
            <select
              name="padel-advantage-score"
              value={advantage}
              onChange={(event) => setAdvantage(event.target.value)}
            >
              <option value="">{t("deuce")}</option>
              <option value="A">{t("teamA")}</option>
              <option value="B">{t("teamB")}</option>
            </select>
          </label>
        ) : null}
        {!isTieBreak && rules.gameScoring === "star_point" ? (
          <label className={styles.selectField}>
            <span>{t("padelStarStage")}</span>
            <select
              name="padel-star-stage"
              value={starDeuces}
              onChange={(event) => setStarDeuces(event.target.value)}
            >
              {[0, 1, 2].map((value) => (
                <option key={value} value={value}>
                  {t("padelDeuceStage")} {value + 1}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className={styles.dialogActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => dialogRef.current?.close()}
          >
            {t("cancel")}
          </button>
          <button className={styles.primaryButton} type="submit">
            {t("save")}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function PadelSetOrdersDialog({
  dialogRef,
  definition,
  orders,
  onOrdersChange,
  onConfirm,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  definition: MatchDefinition;
  orders: PadelSetOrders;
  onOrdersChange: (orders: PadelSetOrders) => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  return (
    <dialog
      className={styles.dialog}
      ref={dialogRef}
      onCancel={(event) => event.preventDefault()}
    >
      <div className={styles.dialogBody}>
        <h2>{t("padelAwaitingOrders")}</h2>
        <p>{t("padelOrdersIntro")}</p>
        {(["A", "B"] as const).map((team) => (
          <fieldset className={styles.tennisPairOrders} key={team}>
            <legend>{definition.teams[team].name}</legend>
            {(["serviceOrder", "deuceReceiver"] as const).map((kind) => (
              <label className={styles.selectField} key={kind}>
                <span>
                  {t(
                    kind === "serviceOrder"
                      ? "padelFirstServer"
                      : "padelFirstReceiver",
                  )}
                </span>
                <select
                  value={
                    kind === "serviceOrder"
                      ? orders.serviceOrder[team][0]
                      : orders.deuceReceiver[team]
                  }
                  onChange={(event) => {
                    const player = Number(event.target.value) as 0 | 1;
                    if (kind === "serviceOrder") {
                      onOrdersChange({
                        ...orders,
                        serviceOrder: {
                          ...orders.serviceOrder,
                          [team]: [player, (1 - player) as 0 | 1],
                        },
                      });
                    } else {
                      onOrdersChange({
                        ...orders,
                        deuceReceiver: {
                          ...orders.deuceReceiver,
                          [team]: player,
                        },
                      });
                    }
                  }}
                >
                  {[0, 1].map((playerIndex) => (
                    <option key={playerIndex} value={playerIndex}>
                      {definition.teams[team].players[playerIndex]?.name ??
                        `${t("player1")} ${playerIndex + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
        ))}
        <div className={styles.dialogActions}>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={onConfirm}
          >
            {t("confirmSetOrders")}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function TennisSetOrdersDialog({
  dialogRef,
  definition,
  orders,
  onOrdersChange,
  onConfirm,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  definition: MatchDefinition;
  orders: TennisSetOrders;
  onOrdersChange: (orders: TennisSetOrders) => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  return (
    <dialog
      className={styles.dialog}
      ref={dialogRef}
      onCancel={(event) => event.preventDefault()}
    >
      <div className={styles.dialogBody}>
        <h2>{t("awaitingSetOrders")}</h2>
        <p>{t("setOrdersHint")}</p>
        {(["A", "B"] as const).map((team) => (
          <fieldset className={styles.tennisPairOrders} key={team}>
            <legend>{definition.teams[team].name}</legend>
            {(["serviceOrder", "deuceReceiver"] as const).map((kind) => (
              <label className={styles.selectField} key={kind}>
                <span>
                  {t(
                    kind === "serviceOrder"
                      ? "tennisPairFirstServer"
                      : "tennisDeuceReceiver",
                  )}
                </span>
                <select
                  value={
                    kind === "serviceOrder"
                      ? orders.serviceOrder[team][0]
                      : orders.deuceReceiver[team]
                  }
                  onChange={(event) => {
                    const player = Number(event.target.value) as 0 | 1;
                    if (kind === "serviceOrder") {
                      onOrdersChange({
                        ...orders,
                        serviceOrder: {
                          ...orders.serviceOrder,
                          [team]: [player, (1 - player) as 0 | 1],
                        },
                      });
                    } else {
                      onOrdersChange({
                        ...orders,
                        deuceReceiver: {
                          ...orders.deuceReceiver,
                          [team]: player,
                        },
                      });
                    }
                  }}
                >
                  {[0, 1].map((playerIndex) => (
                    <option key={playerIndex} value={playerIndex}>
                      {definition.teams[team].players[playerIndex]?.name ??
                        `${t("player1")} ${playerIndex + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
        ))}
        <div className={styles.dialogActions}>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={onConfirm}
          >
            {t("confirmSetOrders")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
