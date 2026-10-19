import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  confirmTableTennisGameOrders,
  tableTennisFirstReceiverForNextGame,
  confirmSquashGameOrders,
  selectSquashServiceBox,
  tennisRulesFor,
  tennisScoreLabel,
  undo,
  type EventMetadata,
  type MatchDefinition,
  type MatchJournal,
  type MatchState,
  type PlayerIndex,
  type TeamId,
  type TennisSetOrders,
  type PadelSetOrders,
  type PadelRules,
  type TableTennisGameOrders,
  type SquashGameOrders,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../lib/auth";
import { localizedPath, useLocale } from "../../lib/i18n";
import { normalizeIntegerInput } from "../../lib/numberInput";
import { trackMatchSignal } from "../../lib/analytics";
import {
  canSyncStoredMatch,
  getStoredMatchInfo,
  loadMatch,
  removeMatch,
  saveMatch,
} from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { isLocalOnlyRulesJournal, syncJournal } from "../../lib/sync";
import {
  isSyncConflictError,
  isMatchControlHeldError,
  isMatchControlLostError,
  isRateLimitError,
  isUnsupportedMatchSportError,
} from "../../lib/userError";
import {
  appendRemoteEvents,
  journalSequence,
  matchHeadHasSameState,
  readRemoteMatchEventsSince,
  readRemoteMatchHead,
  readRemoteMatch,
  type RemoteMatchSnapshot,
} from "../../lib/match-remote";
import { Court } from "./Court";
import { OverrideDialog } from "./OverrideDialog";
import { createMatchLifecycle } from "./matchLifecycle";
import { useMatchControl } from "./useMatchControl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectControl } from "@/components/ui/select-control";
import styles from "../../styles/App.module.css";

const QRCodeSVG = lazy(() =>
  import("qrcode.react").then(({ QRCodeSVG: component }) => ({
    default: component,
  })),
);

const eventMetadata = (): EventMetadata => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
});

function pointLabel(state: MatchState, team: TeamId, locale: "en" | "id") {
  if (state.tennis) return tennisScoreLabel(state, team, locale);
  if (state.padel) return padelScoreLabel(state, team, locale);
  return String(state.points[team]);
}

export function MatchPage() {
  const { matchId } = useParams();
  const [searchParams] = useSearchParams();
  const clubSessionId = searchParams.get("clubSessionId");
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const returnPath = localizedPath(
    clubSessionId ? `/sessions/${clubSessionId}` : "/",
    locale,
  );

  useEffect(() => {
    document.title = t("matchPageTitle");
  }, [t]);

  const {
    action,
    isAnonymous,
    loading: authLoading,
    signInWithGoogle,
    user,
  } = useAuth();
  const matchLifecycle = useMemo(
    () =>
      createMatchLifecycle({
        loadLocalMatch: loadMatch,
        readRemoteMatch,
        readRemoteMatchHead,
        readRemoteMatchEventsSince,
        appendRemoteEvents,
        matchHeadHasSameState,
        canSyncLocalMatch: canSyncStoredMatch,
        syncJournal,
        revokeViewerLink: async (currentMatchId) => {
          if (!supabase || !user) return { status: "ok" };
          try {
            const { error } = await supabase.rpc("revoke_live_viewer_link", {
              p_match_id: currentMatchId,
            });
            return error
              ? { status: "error", error: error.message }
              : { status: "ok" };
          } catch {
            return { status: "error", error: "VIEWER_REVOKE_FAILED" };
          }
        },
        removeLocalMatch: removeMatch,
      }),
    [user],
  );
  const [journal, setJournal] = useState<MatchJournal | null>(() =>
    matchId ? loadMatch(matchId) : null,
  );
  const journalRef = useRef(journal);
  journalRef.current = journal;
  const [remoteLoading, setRemoteLoading] = useState(
    Boolean(matchId && supabase),
  );
  const [remoteError, setRemoteError] = useState("");
  const [remoteWarning, setRemoteWarning] = useState(false);
  const [remoteConflict, setRemoteConflict] =
    useState<RemoteMatchSnapshot | null>(null);
  const [remoteReloadAttempt, setRemoteReloadAttempt] = useState(0);
  const [syncState, setSyncState] = useState<
    "local" | "syncing" | "synced" | "offline" | "error"
  >("local");
  const [syncError, setSyncError] = useState("");
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerBusy, setViewerBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [endingSession, setEndingSession] = useState(false);
  const [takeoverPending, setTakeoverPending] = useState(false);
  const [endError, setEndError] = useState("");
  const schemaBlockedMatches = useRef(new Set<string>());
  const previousSyncAttempt = useRef(0);
  const syncedSequence = useRef<number | null>(null);
  const pollInFlight = useRef(false);
  const pollFailureCount = useRef(0);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [setOrdersOpen, setSetOrdersOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [nextSetOrders, setNextSetOrders] = useState<TennisSetOrders | null>(
    null,
  );
  const [nextPadelOrders, setNextPadelOrders] = useState<PadelSetOrders | null>(
    null,
  );
  const [nextTableTennisOrders, setNextTableTennisOrders] =
    useState<TableTennisGameOrders | null>(null);
  const [nextSquashOrders, setNextSquashOrders] =
    useState<SquashGameOrders | null>(null);
  const view = useMemo(
    () => (journal ? deriveJournal(journal) : null),
    [journal],
  );
  const localOnlyRules = Boolean(
    journal && isLocalOnlyRulesJournal(journal) && user && !isAnonymous,
  );
  const matchIsActive = view?.state.status === "active";
  const {
    status: controlStatus,
    canControl,
    controlToken,
    retry: retryControl,
    takeOver,
  } = useMatchControl(matchId, {
    enabled: Boolean(matchIsActive && !remoteLoading && !remoteConflict),
    server: Boolean(supabase && user && !localOnlyRules),
  });

  useEffect(() => {
    if (!matchId || !supabase || isAnonymous || localOnlyRules) {
      setRemoteLoading(false);
      setRemoteError("");
      setRemoteWarning(false);
      return;
    }
    if (authLoading || !user) {
      setRemoteLoading(authLoading);
      return;
    }

    let active = true;
    setRemoteLoading(true);
    setRemoteError("");
    setRemoteWarning(false);
    void matchLifecycle
      .loadRemote({
        matchId,
        userId: user.id,
        isAnonymous,
      })
      .then((result) => {
        if (!active) return;
        if (result.status === "error") {
          if (result.error === "REMOTE_UNAVAILABLE") {
            trackMatchSignal("remote_unavailable", "detected");
          } else {
            trackMatchSignal("remote_invalid", "detected");
          }
          if (result.journal && result.error === "REMOTE_UNAVAILABLE") {
            setRemoteWarning(true);
          } else {
            setRemoteError(result.error);
          }
          setRemoteLoading(false);
          return;
        }

        if (result.status === "recoverable_missing") {
          setRemoteLoading(false);
          return;
        }

        if (result.status === "conflict") {
          setRemoteConflict(result.snapshot);
          setRemoteLoading(false);
          return;
        }

        if (result.action === "replace") {
          syncedSequence.current = result.snapshot.sequence;
          setJournal(result.snapshot.journal);
          saveMatch(result.snapshot.journal, {
            ownerId: user.id,
            persistent: true,
          });
        } else if (
          result.journal &&
          result.snapshot.sequence === journalSequence(result.journal)
        ) {
          syncedSequence.current = result.snapshot.sequence;
        }
        setRemoteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    authLoading,
    isAnonymous,
    localOnlyRules,
    matchId,
    matchLifecycle,
    remoteReloadAttempt,
    user,
  ]);

  useEffect(() => {
    if (
      !matchId ||
      !supabase ||
      !user ||
      isAnonymous ||
      localOnlyRules ||
      !matchIsActive ||
      remoteLoading ||
      remoteConflict ||
      remoteError
    ) {
      return;
    }

    const poll = async (): Promise<boolean> => {
      setRemoteWarning(false);
      const local = journalRef.current;
      if (!local) return true;
      const result = await matchLifecycle.pollRemote({
        matchId,
        journal: local,
        controlActive: controlStatus === "active",
      });
      if (!active) return true;
      if (result.status === "unavailable") {
        trackMatchSignal("remote_unavailable", "detected");
        setRemoteWarning(true);
        return false;
      }
      if (result.status === "error") {
        trackMatchSignal("remote_invalid", "detected");
        setRemoteError(result.error);
        return true;
      }
      if (result.status === "conflict") {
        if (result.controlLost) trackMatchSignal("control_lost", "detected");
        setRemoteConflict(result.snapshot);
        if (result.controlLost) setSyncError("CONTROL_LOST");
        return true;
      }
      if (result.status === "replace") {
        syncedSequence.current = result.sequence;
        setJournal(result.journal);
        saveMatch(result.journal, {
          ownerId: user.id,
          persistent: true,
        });
      }
      return true;
    };
    let active = true;
    let timeoutId: number | null = null;
    const baseDelay = 10_000;
    const jitter = () => Math.floor(Math.random() * 1_500);
    const schedule = (delay: number) => {
      if (!active) return;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(run, delay);
    };
    const run = async () => {
      if (!active) return;
      if (document.visibilityState === "hidden" || pollInFlight.current) {
        schedule(baseDelay + jitter());
        return;
      }
      pollInFlight.current = true;
      let succeeded = true;
      try {
        succeeded = await poll();
      } catch {
        succeeded = false;
        if (active) setRemoteWarning(true);
      } finally {
        pollInFlight.current = false;
      }
      pollFailureCount.current = succeeded
        ? 0
        : Math.min(pollFailureCount.current + 1, 3);
      const backoff = succeeded
        ? baseDelay
        : Math.min(baseDelay * 2 ** pollFailureCount.current, 60_000);
      schedule(backoff + jitter());
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") schedule(0);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    schedule(baseDelay + jitter());
    return () => {
      active = false;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    controlStatus,
    isAnonymous,
    localOnlyRules,
    matchId,
    matchIsActive,
    matchLifecycle,
    remoteConflict,
    remoteError,
    remoteLoading,
    user,
  ]);

  useEffect(() => {
    const currentTennis = view?.state.tennis;
    if (!currentTennis?.awaitingSetOrders) {
      setNextSetOrders(null);
      return;
    }
    setNextSetOrders(currentTennis.setOrders);
  }, [view?.state.tennis?.awaitingSetOrders, view?.state.tennis?.setNumber]);

  useEffect(() => {
    const current = view?.state.padel;
    if (!current?.awaitingSetOrders) {
      setNextPadelOrders(null);
      return;
    }
    setNextPadelOrders(current.setOrders);
  }, [view?.state.padel?.awaitingSetOrders, view?.state.padel?.setNumber]);

  useEffect(() => {
    const current = view?.state.tableTennis;
    if (!current?.awaitingGameOrders || !view) {
      setNextTableTennisOrders(null);
      return;
    }
    const firstServer =
      current.gameOrders.firstServer.team === view.state.servingTeam
        ? current.gameOrders.firstServer.player
        : 0;
    setNextTableTennisOrders({
      firstServer: { team: view.state.servingTeam, player: firstServer },
      firstReceiver: {
        team: view.state.servingTeam === "A" ? "B" : "A",
        player: tableTennisFirstReceiverForNextGame(view.state, firstServer),
      },
    });
  }, [view?.state.tableTennis?.awaitingGameOrders, view?.state.gameNumber]);

  useEffect(() => {
    const current = view?.state.squash;
    if (!current?.awaitingGameOrders) {
      setNextSquashOrders(null);
      return;
    }
    setNextSquashOrders(current.gameOrders);
  }, [view?.state.squash?.awaitingGameOrders, view?.state.gameNumber]);

  useEffect(() => {
    const tennisReady = Boolean(
      view?.state.tennis?.awaitingSetOrders && nextSetOrders,
    );
    const padelReady = Boolean(
      view?.state.padel?.awaitingSetOrders && nextPadelOrders,
    );
    const tableTennisReady = Boolean(
      view?.state.tableTennis?.awaitingGameOrders && nextTableTennisOrders,
    );
    const squashReady = Boolean(
      view?.state.squash?.awaitingGameOrders && nextSquashOrders,
    );
    setSetOrdersOpen(
      tennisReady || padelReady || tableTennisReady || squashReady,
    );
  }, [
    nextPadelOrders,
    nextSetOrders,
    nextTableTennisOrders,
    nextSquashOrders,
    view?.state.padel?.awaitingSetOrders,
    view?.state.tableTennis?.awaitingGameOrders,
    view?.state.squash?.awaitingGameOrders,
    view?.state.tennis?.awaitingSetOrders,
  ]);

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
      const currentMatchId = journal.definition.id;
      setSyncState("syncing");
      setSyncError("");
      const result = await matchLifecycle.synchronize({
        journal,
        userId: user.id,
        isAnonymous,
        controlToken,
        afterSequence: syncedSequence.current ?? 0,
        online: navigator.onLine,
        localOnlyRules,
        remoteReady: !remoteLoading && !remoteConflict && !remoteError,
        matchIsActive: Boolean(matchIsActive),
        controlStatus,
        schemaBlocked: schemaBlockedMatches.current.has(currentMatchId),
        retrySchemaBlocked,
      });
      if (!active) return;
      if (result.status === "offline") {
        setSyncState("offline");
        setSyncError("");
        return;
      }
      if (result.status === "local" || result.status === "skipped") {
        setSyncState("local");
        setSyncError("");
        return;
      }
      if (result.status === "blocked") {
        setSyncState("error");
        setSyncError("");
        return;
      }
      if (
        result.status === "failed" &&
        isUnsupportedMatchSportError(result.error)
      ) {
        schemaBlockedMatches.current.add(currentMatchId);
      } else if (result.status === "synced") {
        schemaBlockedMatches.current.delete(currentMatchId);
        syncedSequence.current = journalSequence(journal);
      }
      setSyncState(
        result.status === "synced"
          ? "synced"
          : result.status === "failed" ||
              result.status === "conflict" ||
              result.status === "control_lost" ||
              result.status === "control_held"
            ? "error"
            : "local",
      );
      setSyncError(
        result.status === "failed" ||
          result.status === "conflict" ||
          result.status === "control_lost" ||
          result.status === "control_held"
          ? result.error
          : "",
      );
      if (
        result.status === "conflict" ||
        result.status === "control_lost" ||
        result.status === "control_held"
      ) {
        trackMatchSignal(
          result.status === "conflict" ? "sync_conflict" : "control_lost",
          "detected",
        );
      }
    };
    const handleOnline = () => void synchronize(true);
    void synchronize(manualRetry);
    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
    };
  }, [
    controlStatus,
    controlToken,
    isAnonymous,
    localOnlyRules,
    journal,
    matchIsActive,
    matchLifecycle,
    remoteConflict,
    remoteError,
    remoteLoading,
    syncAttempt,
    user,
  ]);

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
    const storedMatchInfo = matchId ? getStoredMatchInfo(matchId) : null;
    const accountOwnerId = user && !isAnonymous ? user.id : null;
    const localOwnerId =
      storedMatchInfo?.persistent && storedMatchInfo.ownerId
        ? storedMatchInfo.ownerId
        : (accountOwnerId ?? user?.id);
    saveMatch(next, {
      persistent:
        next.definition.ruleset?.source !== "guest_custom" &&
        (Boolean(accountOwnerId) || Boolean(storedMatchInfo?.persistent)),
      ...(next.definition.ruleset?.source !== "guest_custom" && localOwnerId
        ? { ownerId: localOwnerId }
        : {}),
    });
  }

  function rally(team: TeamId) {
    if (journal) commit(awardRally(journal, team, eventMetadata()));
  }

  async function createViewerLink() {
    if (!matchId || !supabase || !user) return;
    setViewerBusy(true);
    setShareMessage("");
    try {
      const { data, error } = await supabase.rpc("create_live_viewer_link", {
        p_match_id: matchId,
      });
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
    } catch {
      setShareMessage(t("shareFailed"));
    } finally {
      setViewerBusy(false);
    }
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
    try {
      const { error } = await supabase.rpc("revoke_live_viewer_link", {
        p_match_id: matchId,
      });
      if (error) {
        setShareMessage(error.message);
        return;
      }
      setViewerUrl("");
      setShareMessage(t("shareRevoked"));
    } catch {
      setShareMessage(t("shareFailed"));
    } finally {
      setViewerBusy(false);
    }
  }

  async function endSession() {
    if (endingSession) return;
    if (authLoading) return;
    if (!journal || !view) return;
    const isComplete = view?.state.status === "complete";
    if (view?.state.status !== "complete" && !canEndActiveMatch) {
      setEndError(
        t(
          controlStatus === "waiting"
            ? "matchControlWaiting"
            : controlLost
              ? "matchControlLost"
              : "matchControlError",
        ),
      );
      return;
    }

    setEndingSession(true);
    setEndError("");
    try {
      if (matchId) {
        if (isComplete) {
          setSyncState("syncing");
          setSyncError("");
        }
        const finishResult = await matchLifecycle.finish({
          matchId,
          journal,
          userId: user?.id ?? null,
          isAnonymous,
          controlToken,
          afterSequence: syncedSequence.current ?? 0,
          isComplete,
          online: navigator.onLine,
          localOnlyRules,
          remoteConfigured: Boolean(supabase),
        });
        if (finishResult.status === "offline") {
          setEndError(t("finalScoreSaveFailed"));
          return;
        }
        if (finishResult.status === "sync_failed") {
          const finalSync = finishResult.result;
          setSyncState("error");
          setSyncError(
            finalSync.status === "failed" ||
              finalSync.status === "conflict" ||
              finalSync.status === "control_lost" ||
              finalSync.status === "control_held"
              ? finalSync.error
              : "FINAL_SCORE_NOT_SAVED",
          );
          setEndError(t("finalScoreSaveFailed"));
          return;
        }
        if (finishResult.status === "revoke_failed") {
          setEndError(t(isComplete ? "endFailure" : "closeSessionFailure"));
          return;
        }
        if (finishResult.synced) {
          syncedSequence.current = journalSequence(journal);
          setSyncState("synced");
        }
      }
      navigate(returnPath);
    } catch {
      setEndError(t(isComplete ? "endFailure" : "closeSessionFailure"));
    } finally {
      setEndingSession(false);
    }
  }

  async function handleTakeOver() {
    if (takeoverPending) return;
    setTakeoverPending(true);
    setRemoteLoading(true);
    try {
      const acquired = await takeOver();
      if (acquired) {
        trackMatchSignal("control_takeover", "resolved");
        setSyncError("");
        setSyncState("local");
        setRemoteConflict(null);
        setRemoteReloadAttempt((current) => current + 1);
      } else {
        trackMatchSignal("control_takeover", "failed");
        setRemoteLoading(false);
      }
    } finally {
      setTakeoverPending(false);
    }
  }

  function useServerVersion() {
    if (!remoteConflict || !user) return;
    syncedSequence.current = journalSequence(remoteConflict.journal);
    setJournal(remoteConflict.journal);
    saveMatch(remoteConflict.journal, { ownerId: user.id, persistent: true });
    setRemoteConflict(null);
  }

  if (!journal || !view) {
    if (authLoading || remoteLoading) {
      return (
        <div className="min-h-screen min-h-dvh bg-paper">
          <AppHeader />
          <main className={styles.emptyState}>
            <p role="status">{t("loadingMatch")}</p>
          </main>
        </div>
      );
    }
    if (remoteError) {
      return (
        <div className="min-h-screen min-h-dvh bg-paper">
          <AppHeader />
          <main className={styles.emptyState}>
            <h1>{t("matchLoadErrorTitle")}</h1>
            <p>{t("matchLoadErrorBody")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                type="button"
                className="min-h-11"
                onClick={() => setRemoteReloadAttempt((current) => current + 1)}
              >
                {t("retryMatchLoad")}
              </Button>
              <Button
                type="button"
                className={styles.primaryButton}
                onClick={() => navigate(returnPath)}
              >
                {t("backToHome")}
              </Button>
            </div>
          </main>
        </div>
      );
    }
    return (
      <div className="min-h-screen min-h-dvh bg-paper pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <AppHeader />
        <main className={styles.emptyState}>
          <span className={styles.emptyMark} aria-hidden="true">
            ?
          </span>
          <h1>{t("missingTitle")}</h1>
          <p>{t("missingBody")}</p>
          <Button
            className={styles.primaryButton}
            type="button"
            onClick={() => navigate(returnPath)}
          >
            {t("newMatch")}
          </Button>
        </main>
      </div>
    );
  }

  const { definition } = journal;
  const { state } = view;
  const syncConflict = isSyncConflictError(syncError);
  const controlLost = isMatchControlLostError(syncError);
  const controlHeld = isMatchControlHeldError(syncError);
  const displayedControlStatus =
    controlStatus === "active" && controlLost
      ? "lost"
      : controlStatus === "active" && controlHeld
        ? "held"
        : controlStatus;
  const canEditMatch =
    state.status === "active" &&
    !authLoading &&
    canControl &&
    !syncConflict &&
    !controlLost &&
    !controlHeld &&
    !remoteConflict &&
    !remoteLoading &&
    !remoteError &&
    !takeoverPending;
  const canEndActiveMatch =
    !authLoading &&
    canControl &&
    !controlLost &&
    !controlHeld &&
    !remoteConflict &&
    !remoteLoading &&
    !remoteError &&
    !takeoverPending;
  const matchStatusNotice = remoteLoading ? (
    <div
      className={styles.matchStatusBanner}
      data-state="loading"
      role="status"
    >
      <span>{t("loadingLatestMatch")}</span>
    </div>
  ) : remoteConflict ? (
    <div
      className={styles.matchStatusBanner}
      data-state="conflict"
      role="alert"
    >
      <span>{t("matchRemoteConflict")}</span>
      <Button
        variant="outline"
        size="sm"
        className={styles.controlButton}
        type="button"
        onClick={useServerVersion}
      >
        {t("useServerVersion")}
      </Button>
    </div>
  ) : remoteError ? (
    <div className={styles.matchStatusBanner} data-state="error" role="alert">
      <span>{t("matchLoadErrorBody")}</span>
      <Button
        variant="outline"
        size="sm"
        className={styles.controlButton}
        type="button"
        onClick={() => setRemoteReloadAttempt((current) => current + 1)}
      >
        {t("retryMatchLoad")}
      </Button>
    </div>
  ) : remoteWarning ? (
    <div
      className={styles.matchStatusBanner}
      data-state="warning"
      role="status"
    >
      <span>{t("remoteMatchWarning")}</span>
      <Button
        variant="outline"
        size="sm"
        className={styles.controlButton}
        type="button"
        onClick={() => setRemoteReloadAttempt((current) => current + 1)}
      >
        {t("retryMatchLoad")}
      </Button>
    </div>
  ) : displayedControlStatus !== "active" ? (
    <div
      className={styles.matchStatusBanner}
      data-state={displayedControlStatus}
      role={displayedControlStatus === "lost" ? "alert" : "status"}
    >
      <span>
        {t(
          displayedControlStatus === "waiting"
            ? "matchControlWaiting"
            : displayedControlStatus === "held"
              ? "matchControlHeld"
              : displayedControlStatus === "lost"
                ? "matchControlLost"
                : displayedControlStatus === "disabled"
                  ? "matchReadOnly"
                  : "matchControlError",
        )}
      </span>
      {displayedControlStatus === "held" ||
      displayedControlStatus === "lost" ? (
        <Button
          variant="outline"
          size="sm"
          className={styles.controlButton}
          type="button"
          onClick={() => void handleTakeOver()}
        >
          {t("takeOverMatch")}
        </Button>
      ) : controlStatus === "error" ? (
        <Button
          variant="outline"
          size="sm"
          className={styles.controlButton}
          type="button"
          onClick={retryControl}
        >
          {t("retryControl")}
        </Button>
      ) : null}
    </div>
  ) : null;
  const tennis = state.tennis;
  const padel = state.padel;
  const tableTennis = state.tableTennis;
  const squash = state.squash;
  const isTennis = definition.sport === "tennis" && Boolean(tennis);
  const isPadel = definition.sport === "padel" && Boolean(padel);
  const isTableTennis =
    definition.sport === "table_tennis" && Boolean(tableTennis);
  const isSquash = definition.sport === "squash" && Boolean(squash);
  const isRacket = isTennis || isPadel;
  const awaitingOrders = Boolean(
    tennis?.awaitingSetOrders ||
    padel?.awaitingSetOrders ||
    tableTennis?.awaitingGameOrders ||
    squash?.awaitingGameOrders ||
    squash?.serviceBoxChoiceRequired,
  );
  const actionLabel = isTennis
    ? t("tennisPointWon")
    : isPadel
      ? t("padelPointWon")
      : isTableTennis
        ? t("tableTennisPointWon")
        : isSquash
          ? t("squashPointWon")
          : definition.sport === "badminton"
            ? t("pointFor")
            : t("rallyFor");
  const bestOf = isSquash
    ? definition.ruleset?.squashConfiguration?.bestOf
    : isTableTennis
      ? definition.ruleset?.tableTennisConfiguration?.bestOf
      : null;

  return (
    <div className="min-h-screen min-h-dvh bg-paper pb-[max(28px,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <AppHeader compact />
      <main className={styles.matchMain}>
        {clubSessionId ? (
          <Button
            variant="outline"
            className="mb-4 min-h-11"
            type="button"
            onClick={() => navigate(returnPath)}
          >
            <span aria-hidden="true">←</span> {t("clubSessions")}
          </Button>
        ) : null}
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
            {bestOf ? (
              <p className={styles.matchFormatNote}>
                {t(bestOf === 3 ? "bestOfThree" : "bestOfFive")}
              </p>
            ) : null}
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
            isUnsupportedMatchSportError(syncError) ||
            isSyncConflictError(syncError) ||
            controlLost ||
            controlHeld) ? (
            <span className={styles.syncErrorDetail}>
              {isRateLimitError(syncError)
                ? t("rateLimited")
                : isSyncConflictError(syncError)
                  ? t("syncConflict")
                  : controlLost
                    ? t("matchControlLost")
                    : controlHeld
                      ? t("matchControlHeld")
                      : t("syncUnsupportedSport")}
            </span>
          ) : null}
        </p>
        {syncState === "error" ? (
          <Button
            variant="outline"
            size="sm"
            className={styles.syncRetryButton}
            type="button"
            onClick={() => setSyncAttempt((current) => current + 1)}
          >
            {t("retrySync")}
          </Button>
        ) : null}
        {isAnonymous ? (
          <div
            className={`${styles.matchAuthNotice} mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-strong bg-surface px-4 py-3`}
          >
            <p className="m-0 max-w-[560px] text-sm leading-6 text-text-muted">
              {t("guestHistoryPrompt")}
            </p>
            <Button
              variant="outline"
              type="button"
              className="min-h-11 shrink-0"
              disabled={action === "google" || action === "claiming"}
              onClick={() => void signInWithGoogle()}
            >
              {action === "google" || action === "claiming"
                ? t("working")
                : t("saveHistory")}
            </Button>
          </div>
        ) : null}
        {matchStatusNotice}

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
                  {isRacket
                    ? t("tennisSets")
                    : isTableTennis
                      ? t("tableTennisGames")
                      : isSquash
                        ? t("squashGames")
                        : t("sets")}
                  :{" "}
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
              <Button
                variant="ghost"
                className={styles.scoreButton}
                data-tennis={isTennis}
                data-padel={isPadel}
                data-table-tennis={isTableTennis}
                data-squash={isSquash}
                type="button"
                aria-label={`${t("correction")}: ${definition.teams[team].name}`}
                disabled={
                  state.status === "complete" || !canEditMatch || awaitingOrders
                }
                onClick={() => setOverrideOpen(true)}
              >
                {isTennis
                  ? tennisScoreLabel(state, team, locale)
                  : isPadel
                    ? padelScoreLabel(state, team, locale)
                    : state.points[team]}
              </Button>
              <Button
                variant="outline"
                className={styles.scoreAction}
                type="button"
                aria-label={`${actionLabel} ${definition.teams[team].name} (+1)`}
                title={`${actionLabel} ${definition.teams[team].name}`}
                disabled={
                  state.status === "complete" || !canEditMatch || awaitingOrders
                }
                onClick={() => rally(team)}
              >
                +1
              </Button>
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
                    (set) =>
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
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    key={side}
                    aria-pressed={tennis.noAdReceivingSide === side}
                    disabled={
                      !canEditMatch ||
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
                  </Button>
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
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    key={side}
                    aria-pressed={padel.decidingReceivingSide === side}
                    disabled={
                      !canEditMatch ||
                      !canSelectPadelDecidingSide(definition, state, side)
                    }
                    onClick={() =>
                      commit(
                        selectPadelDecidingSide(journal, side, eventMetadata()),
                      )
                    }
                  >
                    {t(side)}
                  </Button>
                ))}
              </div>
            ) : null}
            <p className={styles.fieldHint}>{t("padelCourtNote")}</p>
          </>
        ) : null}

        {isTableTennis && getMatchFormat(definition) === "doubles" ? (
          <p className={styles.fieldHint}>{t("tableTennisOrderNote")}</p>
        ) : null}

        {isSquash && getMatchFormat(definition) === "doubles" ? (
          <p className={styles.fieldHint}>{t("squashOrderNote")}</p>
        ) : null}
        {isSquash &&
        squash?.serviceBoxChoiceRequired &&
        !squash.awaitingGameOrders ? (
          <div
            className={styles.tennisPointChoice}
            aria-label={t("squashChooseServiceBox")}
          >
            <span>{t("squashChooseServiceBox")}</span>
            <p className={styles.fieldHint}>{t("squashServiceBoxHint")}</p>
            {(["left", "right"] as const).map((side) => (
              <Button
                variant="outline"
                size="sm"
                type="button"
                key={side}
                aria-pressed={squash.currentServiceBox === side}
                disabled={!canEditMatch}
                onClick={() =>
                  commit(selectSquashServiceBox(journal, side, eventMetadata()))
                }
              >
                {t(
                  side === "left"
                    ? "squashServiceBoxLeft"
                    : "squashServiceBoxRight",
                )}
              </Button>
            ))}
          </div>
        ) : null}

        <Court definition={definition} state={state} />

        <section
          className={styles.matchActions}
          aria-label={t("matchControls")}
        >
          <div className={styles.historyActions}>
            <Button
              variant="outline"
              className={styles.controlButton}
              type="button"
              disabled={!view.canUndo || !canEditMatch}
              onClick={() => commit(undo(journal, eventMetadata()))}
            >
              <span aria-hidden="true">↶</span> {t("undo")}
            </Button>
            <Button
              variant="outline"
              className={styles.controlButton}
              type="button"
              disabled={!view.canRedo || !canEditMatch}
              onClick={() => commit(redo(journal, eventMetadata()))}
            >
              {t("redo")} <span aria-hidden="true">↷</span>
            </Button>
            <Button
              variant="outline"
              className={styles.controlButton}
              type="button"
              disabled={
                state.status === "complete" || !canEditMatch || awaitingOrders
              }
              onClick={() => setOverrideOpen(true)}
            >
              <span aria-hidden="true">✎</span> {t("correction")}
            </Button>
          </div>

          <Button
            variant="ghost"
            className={styles.dangerTextButton}
            type="button"
            disabled={
              authLoading || (state.status !== "complete" && !canControl)
            }
            onClick={() => {
              setEndError("");
              setEndOpen(true);
            }}
          >
            {state.status === "complete" ? t("newMatch") : t("closeSession")}
          </Button>

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
                <Button
                  variant="outline"
                  className={styles.secondaryButton}
                  type="button"
                  disabled={
                    viewerBusy || !canEditMatch || !user || localOnlyRules
                  }
                  onClick={() => void createViewerLink()}
                >
                  {viewerBusy ? t("working") : t("createViewerLink")}
                </Button>
                <Button
                  variant="ghost"
                  className={styles.dangerTextButton}
                  type="button"
                  disabled={
                    viewerBusy ||
                    !canEditMatch ||
                    !user ||
                    localOnlyRules ||
                    syncState !== "synced"
                  }
                  onClick={() => void revokeViewerLink()}
                >
                  {t("revokeViewerLink")}
                </Button>
              </div>
              {viewerUrl ? (
                <div className={styles.viewerLink}>
                  <Label>
                    <span>{t("viewerLink")}</span>
                    <Input
                      name="viewer-link"
                      readOnly
                      value={viewerUrl}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </Label>
                  <Button
                    variant="outline"
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void copyViewerLink()}
                  >
                    {t("copyLink")}
                  </Button>
                  <Button
                    variant="outline"
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => void shareViewerLink()}
                  >
                    {t("shareLink")}
                  </Button>
                  <div className={styles.ruleQr} aria-label={t("qrCode")}>
                    <Suspense fallback={null}>
                      <QRCodeSVG
                        value={viewerUrl}
                        size={148}
                        level="M"
                        includeMargin
                      />
                    </Suspense>
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
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          state={state}
          gameScoring={tennisRulesFor(definition).gameScoring}
          onSave={(score) =>
            commit(overrideTennisScore(journal, score, eventMetadata()))
          }
        />
      ) : isPadel ? (
        <PadelCorrectionDialog
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          state={state}
          rules={padelRulesFor(definition)}
          onSave={(score) =>
            commit(overridePadelScore(journal, score, eventMetadata()))
          }
        />
      ) : (
        <OverrideDialog
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          state={state}
          onSave={(points) =>
            commit(overrideState(journal, points, eventMetadata()))
          }
        />
      )}

      {tennis && nextSetOrders ? (
        <TennisSetOrdersDialog
          open={setOrdersOpen && Boolean(tennis.awaitingSetOrders)}
          onOpenChange={(open) => {
            if (open) setSetOrdersOpen(true);
          }}
          definition={definition}
          orders={nextSetOrders}
          onOrdersChange={setNextSetOrders}
          onConfirm={() => {
            commit(
              confirmTennisSetOrders(journal, nextSetOrders, eventMetadata()),
            );
            setSetOrdersOpen(false);
          }}
        />
      ) : null}

      {padel && nextPadelOrders ? (
        <PadelSetOrdersDialog
          open={setOrdersOpen && Boolean(padel.awaitingSetOrders)}
          onOpenChange={(open) => {
            if (open) setSetOrdersOpen(true);
          }}
          definition={definition}
          orders={nextPadelOrders}
          onOrdersChange={setNextPadelOrders}
          onConfirm={() => {
            commit(
              confirmPadelSetOrders(journal, nextPadelOrders, eventMetadata()),
            );
            setSetOrdersOpen(false);
          }}
        />
      ) : null}

      {tableTennis && nextTableTennisOrders ? (
        <TableTennisGameOrdersDialog
          open={setOrdersOpen && Boolean(tableTennis.awaitingGameOrders)}
          onOpenChange={(open) => {
            if (open) setSetOrdersOpen(true);
          }}
          definition={definition}
          state={state}
          orders={nextTableTennisOrders}
          onOrdersChange={setNextTableTennisOrders}
          onConfirm={() => {
            commit(
              confirmTableTennisGameOrders(
                journal,
                nextTableTennisOrders,
                eventMetadata(),
              ),
            );
            setSetOrdersOpen(false);
          }}
        />
      ) : null}

      {isSquash && squash && nextSquashOrders ? (
        <SquashGameOrdersDialog
          open={setOrdersOpen && squash.awaitingGameOrders}
          onOpenChange={(open) => {
            if (open) setSetOrdersOpen(true);
          }}
          definition={definition}
          state={state}
          orders={nextSquashOrders}
          onOrdersChange={setNextSquashOrders}
          onConfirm={() => {
            commit(
              confirmSquashGameOrders(
                journal,
                nextSquashOrders,
                eventMetadata(),
              ),
            );
            setSetOrdersOpen(false);
          }}
        />
      ) : null}

      <Dialog
        open={endOpen}
        onOpenChange={(open) => {
          if (endingSession && !open) return;
          setEndOpen(open);
          if (!open) setEndError("");
        }}
      >
        <DialogContent className={styles.dialog} showCloseButton={false}>
          <div className={styles.endDialogBody} aria-busy={endingSession}>
            <DialogHeader className={styles.endDialogHeader}>
              <p className={styles.endDialogEyebrow}>
                {t(definition.sport)} · {t(getMatchFormat(definition))}
              </p>
              <DialogTitle className={styles.endDialogTitle}>
                {state.status === "complete"
                  ? t("newMatchPrompt")
                  : t("closeSessionTitle")}
              </DialogTitle>
              <DialogDescription className={styles.endDialogDescription}>
                {state.status === "complete"
                  ? t("newMatchBody")
                  : t("closeSessionBody")}
              </DialogDescription>
            </DialogHeader>

            <div
              className={styles.endMatchSummary}
              role="group"
              aria-label={t("score")}
            >
              <span className={styles.endTeamName}>
                {definition.teams.A.name}
              </span>
              <strong className={styles.endMatchScore}>
                {pointLabel(state, "A", locale)}
                <span aria-hidden="true">:</span>
                {pointLabel(state, "B", locale)}
              </strong>
              <span className={styles.endTeamName}>
                {definition.teams.B.name}
              </span>
            </div>

            {endError || (state.status !== "complete" && !canEndActiveMatch) ? (
              <p className={styles.endError} role="alert">
                {endError ||
                  t(
                    controlStatus === "waiting"
                      ? "matchControlWaiting"
                      : controlLost
                        ? "matchControlLost"
                        : "matchControlError",
                  )}
              </p>
            ) : null}

            <DialogFooter className={styles.endDialogActions}>
              <Button
                variant="outline"
                className={styles.secondaryButton}
                type="button"
                disabled={endingSession}
                onClick={() => setEndOpen(false)}
              >
                {state.status === "complete"
                  ? t("backToScore")
                  : t("keepPlaying")}
              </Button>
              <Button
                variant="destructive"
                className={styles.dangerButton}
                type="button"
                disabled={
                  authLoading ||
                  (state.status !== "complete" && !canEndActiveMatch) ||
                  endingSession
                }
                onClick={() => void endSession()}
              >
                {endingSession
                  ? t("working")
                  : state.status === "complete"
                    ? t("goHome")
                    : t("confirmCloseSession")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TennisCorrectionDialog({
  open,
  onOpenChange,
  state,
  gameScoring,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const firstSelect = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const score =
      tennis?.phase === "game" ? tennis.pointScore : tennis?.tieBreakScore;
    setScoreA(String(score?.A ?? 0));
    setScoreB(String(score?.B ?? 0));
    setAdvantage(tennis?.advantage ?? "");
    window.requestAnimationFrame(() => {
      if (isTieBreak) firstInput.current?.select();
      else firstSelect.current?.focus();
    });
  }, [open, tennis, isTieBreak]);

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
    onOpenChange(false);
  }

  if (!tennis) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog} showCloseButton={false}>
        <form className={styles.dialogBody} onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("correction")}</DialogTitle>
            <DialogDescription>
              {t(
                isTieBreak ? "correctionTieBreakScore" : "correctionGameScore",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.overrideFields}>
            <Label>
              <span>{t("teamA")}</span>
              {isTieBreak ? (
                <Input
                  name="tennis-tiebreak-team-a"
                  ref={firstInput}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={scoreA}
                  onChange={(event) =>
                    setScoreA(normalizeIntegerInput(event.target.value))
                  }
                  required
                />
              ) : (
                <SelectControl
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
                </SelectControl>
              )}
            </Label>
            <Label>
              <span>{t("teamB")}</span>
              {isTieBreak ? (
                <Input
                  name="tennis-tiebreak-team-b"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={scoreB}
                  onChange={(event) =>
                    setScoreB(normalizeIntegerInput(event.target.value))
                  }
                  required
                />
              ) : (
                <SelectControl
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
                </SelectControl>
              )}
            </Label>
          </div>
          {!isTieBreak && gameScoring === "advantage" ? (
            <Label className={styles.selectField}>
              <span>{t("advantageScore")}</span>
              <SelectControl
                name="tennis-advantage-score"
                value={advantage}
                onChange={(event) => setAdvantage(event.target.value)}
              >
                <option value="">{t("deuce")}</option>
                <option value="A">{t("teamA")}</option>
                <option value="B">{t("teamB")}</option>
              </SelectControl>
            </Label>
          ) : null}
          <DialogFooter className={styles.dialogActions}>
            <Button
              variant="outline"
              className={styles.secondaryButton}
              type="button"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" className={styles.primaryButton}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PadelCorrectionDialog({
  open,
  onOpenChange,
  state,
  rules,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const firstSelect = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open, padel, isTieBreak]);

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
    onOpenChange(false);
  }

  if (!padel) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog} showCloseButton={false}>
        <form className={styles.dialogBody} onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("correction")}</DialogTitle>
            <DialogDescription>
              {t(
                isTieBreak ? "correctionTieBreakScore" : "correctionGameScore",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.overrideFields}>
            {(["A", "B"] as const).map((team, index) => (
              <Label key={team}>
                <span>{t(team === "A" ? "teamA" : "teamB")}</span>
                {isTieBreak ? (
                  <Input
                    name={`padel-tiebreak-team-${team.toLowerCase()}`}
                    ref={index === 0 ? firstInput : undefined}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={team === "A" ? scoreA : scoreB}
                    onChange={(event) =>
                      team === "A"
                        ? setScoreA(normalizeIntegerInput(event.target.value))
                        : setScoreB(normalizeIntegerInput(event.target.value))
                    }
                    required
                  />
                ) : (
                  <SelectControl
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
                  </SelectControl>
                )}
              </Label>
            ))}
          </div>
          {!isTieBreak && rules.gameScoring !== "golden_point" ? (
            <Label className={styles.selectField}>
              <span>{t("advantageScore")}</span>
              <SelectControl
                name="padel-advantage-score"
                value={advantage}
                onChange={(event) => setAdvantage(event.target.value)}
              >
                <option value="">{t("deuce")}</option>
                <option value="A">{t("teamA")}</option>
                <option value="B">{t("teamB")}</option>
              </SelectControl>
            </Label>
          ) : null}
          {!isTieBreak && rules.gameScoring === "star_point" ? (
            <Label className={styles.selectField}>
              <span>{t("padelStarStage")}</span>
              <SelectControl
                name="padel-star-stage"
                value={starDeuces}
                onChange={(event) => setStarDeuces(event.target.value)}
              >
                {[0, 1, 2].map((value) => (
                  <option key={value} value={value}>
                    {t("padelDeuceStage")} {value + 1}
                  </option>
                ))}
              </SelectControl>
            </Label>
          ) : null}
          <DialogFooter className={styles.dialogActions}>
            <Button
              variant="outline"
              className={styles.secondaryButton}
              type="button"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" className={styles.primaryButton}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PadelSetOrdersDialog({
  open,
  onOpenChange,
  definition,
  orders,
  onOrdersChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: MatchDefinition;
  orders: PadelSetOrders;
  onOrdersChange: (orders: PadelSetOrders) => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
      }}
    >
      <DialogContent className={styles.dialog} showCloseButton={false}>
        <div className={styles.dialogBody}>
          <DialogHeader>
            <DialogTitle>{t("padelAwaitingOrders")}</DialogTitle>
            <DialogDescription>{t("padelOrdersIntro")}</DialogDescription>
          </DialogHeader>
          {(["A", "B"] as const).map((team) => (
            <fieldset className={styles.tennisPairOrders} key={team}>
              <legend>{definition.teams[team].name}</legend>
              {(["serviceOrder", "deuceReceiver"] as const).map((kind) => (
                <Label className={styles.selectField} key={kind}>
                  <span>
                    {t(
                      kind === "serviceOrder"
                        ? "padelFirstServer"
                        : "padelFirstReceiver",
                    )}
                  </span>
                  <SelectControl
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
                  </SelectControl>
                </Label>
              ))}
            </fieldset>
          ))}
          <DialogFooter className={styles.dialogActions}>
            <Button
              className={styles.primaryButton}
              type="button"
              onClick={onConfirm}
            >
              {t("confirmSetOrders")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TennisSetOrdersDialog({
  open,
  onOpenChange,
  definition,
  orders,
  onOrdersChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: MatchDefinition;
  orders: TennisSetOrders;
  onOrdersChange: (orders: TennisSetOrders) => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
      }}
    >
      <DialogContent className={styles.dialog} showCloseButton={false}>
        <div className={styles.dialogBody}>
          <DialogHeader>
            <DialogTitle>{t("awaitingSetOrders")}</DialogTitle>
            <DialogDescription>{t("setOrdersHint")}</DialogDescription>
          </DialogHeader>
          {(["A", "B"] as const).map((team) => (
            <fieldset className={styles.tennisPairOrders} key={team}>
              <legend>{definition.teams[team].name}</legend>
              {(["serviceOrder", "deuceReceiver"] as const).map((kind) => (
                <Label className={styles.selectField} key={kind}>
                  <span>
                    {t(
                      kind === "serviceOrder"
                        ? "tennisPairFirstServer"
                        : "tennisDeuceReceiver",
                    )}
                  </span>
                  <SelectControl
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
                  </SelectControl>
                </Label>
              ))}
            </fieldset>
          ))}
          <DialogFooter className={styles.dialogActions}>
            <Button
              className={styles.primaryButton}
              type="button"
              onClick={onConfirm}
            >
              {t("confirmSetOrders")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TableTennisGameOrdersDialog({
  open,
  onOpenChange,
  definition,
  state,
  orders,
  onOrdersChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: MatchDefinition;
  state: MatchState;
  orders: TableTennisGameOrders;
  onOrdersChange: (orders: TableTennisGameOrders) => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  const servingTeam = state.servingTeam;
  const receivingTeam = servingTeam === "A" ? "B" : "A";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog} showCloseButton={false}>
        <div className={styles.dialogBody}>
          <DialogHeader>
            <DialogTitle>{t("tableTennisOrdersTitle")}</DialogTitle>
            <DialogDescription>
              {t("tableTennisAwaitingOrders")}
            </DialogDescription>
          </DialogHeader>
          <fieldset className={styles.overrideFields}>
            <Label>
              <span>{t("tableTennisFirstServer")}</span>
              <SelectControl
                name="table-tennis-next-server"
                value={orders.firstServer.player}
                onChange={(event) => {
                  const player = Number(event.target.value) as 0 | 1;
                  const receiver = tableTennisFirstReceiverForNextGame(
                    state,
                    player,
                  );
                  onOrdersChange({
                    firstServer: { team: servingTeam, player },
                    firstReceiver: { team: receivingTeam, player: receiver },
                  });
                }}
              >
                {[0, 1].map((player) => (
                  <option key={player} value={player}>
                    {definition.teams[servingTeam].players[player]?.name ??
                      `${t(player === 0 ? "player1" : "player2")}`}
                  </option>
                ))}
              </SelectControl>
            </Label>
            <Label>
              <span>{t("tableTennisFirstReceiver")}</span>
              <SelectControl
                name="table-tennis-next-receiver"
                value={orders.firstReceiver.player}
                disabled
                onChange={() => undefined}
              >
                {[0, 1].map((player) => (
                  <option key={player} value={player}>
                    {definition.teams[receivingTeam].players[player]?.name ??
                      `${t(player === 0 ? "player1" : "player2")}`}
                  </option>
                ))}
              </SelectControl>
            </Label>
          </fieldset>
          <p className={styles.fieldHint}>{t("tableTennisOrderNote")}</p>
          <DialogFooter className={styles.dialogActions}>
            <Button
              className={styles.primaryButton}
              type="button"
              onClick={onConfirm}
            >
              {t("confirmSetOrders")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SquashGameOrdersDialog({
  open,
  onOpenChange,
  definition,
  state,
  orders,
  onOrdersChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: MatchDefinition;
  state: MatchState;
  orders: SquashGameOrders;
  onOrdersChange: (orders: SquashGameOrders) => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  const servingTeam = state.servingTeam;
  const currentServer = orders.serviceOrder[servingTeam][0];
  const teamOptions =
    getMatchFormat(definition) === "doubles"
      ? (["A", "B"] as const)
      : ([servingTeam] as const);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog} showCloseButton={false}>
        <div className={styles.dialogBody}>
          <DialogHeader>
            <DialogTitle>{t("squashOrdersTitle")}</DialogTitle>
            <DialogDescription>{t("squashAwaitingOrders")}</DialogDescription>
          </DialogHeader>
          <p className={styles.fieldHint}>
            {t("server")}:{" "}
            {definition.teams[servingTeam].players[currentServer]?.name}
          </p>
          <Label className={styles.selectField}>
            <span>{t("squashFirstServiceBox")}</span>
            <SelectControl
              name="squash-next-service-box"
              value={orders.openingServiceBox}
              onChange={(event) =>
                onOrdersChange({
                  ...orders,
                  openingServiceBox: event.target.value as "left" | "right",
                })
              }
            >
              <option value="right">{t("squashServiceBoxRight")}</option>
              <option value="left">{t("squashServiceBoxLeft")}</option>
            </SelectControl>
          </Label>
          {getMatchFormat(definition) === "doubles"
            ? teamOptions.map((team) => (
                <fieldset className={styles.overrideFields} key={team}>
                  <legend>{t(team === "A" ? "teamA" : "teamB")}</legend>
                  {(["left", "right"] as const).map((side) => (
                    <Label key={side}>
                      <span>
                        {side === "left"
                          ? t("squashReceiverLeft")
                          : t("squashReceiverRight")}
                      </span>
                      <SelectControl
                        name={`squash-next-receiver-${team}-${side}`}
                        value={orders.receiverBySide[team][side]}
                        onChange={(event) =>
                          onOrdersChange({
                            ...orders,
                            receiverBySide: {
                              ...orders.receiverBySide,
                              [team]: {
                                ...orders.receiverBySide[team],
                                [side]: Number(
                                  event.target.value,
                                ) as PlayerIndex,
                              },
                            },
                          })
                        }
                      >
                        <option value="0">
                          {definition.teams[team].players[0]?.name ??
                            t("player1")}
                        </option>
                        <option value="1">
                          {definition.teams[team].players[1]?.name ??
                            t("player2")}
                        </option>
                      </SelectControl>
                    </Label>
                  ))}
                </fieldset>
              ))
            : null}
          <p className={styles.fieldHint}>{t("squashOrderNote")}</p>
          <DialogFooter className={styles.dialogActions}>
            <Button
              className={styles.primaryButton}
              type="button"
              onClick={onConfirm}
            >
              {t("confirmGameOrders")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
