import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  MatchDefinition,
  MatchState,
  Sport,
  TeamId,
} from "@skor-lapangan/scoring-core";
import {
  getMatchFormat,
  padelScoreLabel,
  tennisScoreLabel,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { localizedPath, useLocale } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";
import { Button } from "@/components/ui/button";
import styles from "../../styles/App.module.css";
import { Court } from "./Court";

const VIEWER_POLL_MS = 5_000;
const HIDDEN_VIEWER_POLL_MS = 15_000;

interface ViewerSnapshot {
  sport: Sport;
  status: "active" | "complete";
  currentState: MatchState;
  updatedAt: string;
  expiresAt: string;
}

function isTeamId(value: unknown): value is TeamId {
  return value === "A" || value === "B";
}

function isViewerState(value: unknown): value is MatchState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<MatchState>;
  const points = state.points;
  const gamesWon = state.gamesWon;
  const positions = state.positions;
  const tennisState = state.tennis;
  const padelState = state.padel;
  const tableTennisState = state.tableTennis;
  const squashState = state.squash;
  const positionIsValid = (position: unknown) => {
    if (!position || typeof position !== "object") return false;
    const sides = position as { left?: unknown; right?: unknown };
    return (
      [0, 1].includes(sides.left as number) &&
      [0, 1].includes(sides.right as number)
    );
  };
  const nonNegativeInteger = (number: unknown): number is number =>
    Number.isInteger(number) && (number as number) >= 0;
  const scoreIsValid = (score: unknown) => {
    if (!score || typeof score !== "object") return false;
    const value = score as { A?: unknown; B?: unknown };
    return nonNegativeInteger(value.A) && nonNegativeInteger(value.B);
  };
  const tennisIsValid =
    state.sport !== "tennis" ||
    Boolean(
      tennisState &&
      nonNegativeInteger(tennisState.setNumber) &&
      tennisState.setNumber >= 1 &&
      scoreIsValid(tennisState.setsWon) &&
      scoreIsValid(tennisState.gamesInSet) &&
      scoreIsValid(tennisState.pointScore) &&
      nonNegativeInteger(tennisState.gamePointCount) &&
      (tennisState.tieBreakScore === null ||
        scoreIsValid(tennisState.tieBreakScore)) &&
      (tennisState.phase === "game" ||
        tennisState.phase === "tiebreak" ||
        tennisState.phase === "match_tiebreak") &&
      typeof tennisState.courtEndsSwapped === "boolean" &&
      (tennisState.noAdReceivingSide === null ||
        tennisState.noAdReceivingSide === "left" ||
        tennisState.noAdReceivingSide === "right"),
    );
  const padelIsValid =
    state.sport !== "padel" ||
    Boolean(
      padelState &&
      nonNegativeInteger(padelState.setNumber) &&
      padelState.setNumber >= 1 &&
      scoreIsValid(padelState.setsWon) &&
      scoreIsValid(padelState.gamesInSet) &&
      scoreIsValid(padelState.pointScore) &&
      nonNegativeInteger(padelState.gamePointCount) &&
      (padelState.tieBreakScore === null ||
        scoreIsValid(padelState.tieBreakScore)) &&
      ["advantage", "star_point", "golden_point"].includes(
        padelState.gameScoring,
      ) &&
      ["game", "tiebreak", "match_tiebreak"].includes(padelState.phase) &&
      typeof padelState.courtEndsSwapped === "boolean" &&
      typeof padelState.awaitingSetOrders === "boolean" &&
      Number.isInteger(padelState.starDeuces) &&
      padelState.starDeuces >= 0 &&
      padelState.starDeuces <= 2 &&
      Array.isArray(padelState.completedSets) &&
      (padelState.decidingReceivingSide === null ||
        padelState.decidingReceivingSide === "left" ||
        padelState.decidingReceivingSide === "right"),
    );
  const tableTennisIsValid =
    state.sport !== "table_tennis" ||
    Boolean(
      tableTennisState &&
      typeof tableTennisState.awaitingGameOrders === "boolean" &&
      (tableTennisState.currentReceiver === 0 ||
        tableTennisState.currentReceiver === 1) &&
      typeof tableTennisState.courtEndsSwapped === "boolean" &&
      typeof tableTennisState.receivingOrderSwapped === "boolean" &&
      tableTennisState.gameOrders &&
      isTeamId(tableTennisState.gameOrders.firstServer.team) &&
      isTeamId(tableTennisState.gameOrders.firstReceiver.team) &&
      (tableTennisState.gameOrders.firstServer.player === 0 ||
        tableTennisState.gameOrders.firstServer.player === 1) &&
      (tableTennisState.gameOrders.firstReceiver.player === 0 ||
        tableTennisState.gameOrders.firstReceiver.player === 1),
    );
  const squashIsValid =
    state.sport !== "squash" ||
    Boolean(
      squashState &&
      (squashState.currentServiceBox === null ||
        squashState.currentServiceBox === "left" ||
        squashState.currentServiceBox === "right") &&
      typeof squashState.serviceBoxChoiceRequired === "boolean" &&
      typeof squashState.awaitingGameOrders === "boolean" &&
      isTeamId(squashState.serviceRotationStartTeam) &&
      [0, 1, 2, 3].includes(squashState.serviceRotationIndex) &&
      squashState.gameOrders &&
      (["A", "B"] as const).every((team) => {
        const serviceOrder = squashState.gameOrders.serviceOrder[team];
        const receiverBySide = squashState.gameOrders.receiverBySide[team];
        return (
          Array.isArray(serviceOrder) &&
          serviceOrder.length === 2 &&
          serviceOrder.every((player) => player === 0 || player === 1) &&
          receiverBySide &&
          (receiverBySide.left === 0 || receiverBySide.left === 1) &&
          (receiverBySide.right === 0 || receiverBySide.right === 1)
        );
      }) &&
      (squashState.gameOrders.openingServiceBox === "left" ||
        squashState.gameOrders.openingServiceBox === "right"),
    );

  return (
    typeof state.matchId === "string" &&
    (state.sport === "badminton" ||
      state.sport === "pickleball" ||
      state.sport === "tennis" ||
      state.sport === "padel" ||
      state.sport === "table_tennis" ||
      state.sport === "squash") &&
    (state.format === undefined ||
      state.format === "singles" ||
      state.format === "doubles" ||
      ((state.sport === "tennis" || state.sport === "padel") &&
        state.format === "mixed_doubles")) &&
    nonNegativeInteger(state.gameNumber) &&
    state.gameNumber >= 1 &&
    scoreIsValid(points) &&
    scoreIsValid(gamesWon) &&
    isTeamId(state.servingTeam) &&
    (state.currentServer === 0 || state.currentServer === 1) &&
    (state.serverNumber === null ||
      state.serverNumber === 1 ||
      state.serverNumber === 2) &&
    Boolean(
      positions && positionIsValid(positions.A) && positionIsValid(positions.B),
    ) &&
    (state.status === "active" || state.status === "complete") &&
    (state.winner === null || isTeamId(state.winner)) &&
    Array.isArray(state.completedGames) &&
    state.completedGames.every(
      (game) =>
        Boolean(game) &&
        typeof game === "object" &&
        isTeamId((game as { winner?: unknown }).winner) &&
        scoreIsValid((game as { score?: unknown }).score),
    ) &&
    tennisIsValid &&
    padelIsValid &&
    tableTennisIsValid &&
    squashIsValid
  );
}

function viewerDefinition(state: MatchState): MatchDefinition {
  const format = getMatchFormat(state);
  const genericTeam = (team: TeamId) => ({
    name: team === "A" ? "Team A" : "Team B",
    players:
      format === "singles"
        ? ([{ id: `${team}-player-1`, name: "Player 1" }] as const)
        : ([
            { id: `${team}-player-1`, name: "Player 1" },
            { id: `${team}-player-2`, name: "Player 2" },
          ] as const),
  });
  return {
    id: state.matchId,
    sport: state.sport,
    format,
    rulesetId: "viewer",
    mode: "casual",
    createdAt: new Date().toISOString(),
    initialServingTeam: state.servingTeam,
    initialServingPlayer: state.currentServer,
    ...(state.tableTennis
      ? { tableTennisOrders: state.tableTennis.gameOrders }
      : state.squash
        ? { squashGameOrders: state.squash.gameOrders }
        : {}),
    teams: { A: genericTeam("A"), B: genericTeam("B") },
  };
}

export function ViewerPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const [snapshot, setSnapshot] = useState<ViewerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState(false);
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const hasSnapshot = useRef(false);

  useEffect(() => {
    let active = true;
    let requestRunning = false;
    let timerId: number | null = null;
    const refresh = async () => {
      if (!active || requestRunning || document.visibilityState === "hidden")
        return;
      requestRunning = true;
      if (!supabase || !token) {
        setLoading(false);
        setError(true);
        requestRunning = false;
        return;
      }

      const { data, error: rpcError } = await supabase.rpc("read_live_viewer", {
        p_token: token,
      });
      requestRunning = false;
      if (!active) return;
      const row = data?.[0];
      if (rpcError || !row || !isViewerState(row.current_state)) {
        if (!hasSnapshot.current) setError(true);
        else setStale(true);
        setLoading(false);
        return;
      }

      setSnapshot({
        sport:
          row.sport === "pickleball" ||
          row.sport === "tennis" ||
          row.sport === "padel" ||
          row.sport === "table_tennis" ||
          row.sport === "squash"
            ? row.sport
            : "badminton",
        status: row.status === "complete" ? "complete" : "active",
        currentState: row.current_state,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
      });
      hasSnapshot.current = true;
      setStale(false);
      setError(false);
      setLoading(false);
    };

    const schedule = () => {
      if (!active) return;
      timerId = window.setTimeout(
        () => {
          void refresh().finally(schedule);
        },
        document.visibilityState === "hidden"
          ? HIDDEN_VIEWER_POLL_MS
          : VIEWER_POLL_MS,
      );
    };
    const refreshAndSchedule = () => {
      if (timerId !== null) window.clearTimeout(timerId);
      void refresh().finally(schedule);
    };

    void refresh().finally(schedule);
    const handleOnline = refreshAndSchedule;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshAndSchedule();
    };
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      if (timerId !== null) window.clearTimeout(timerId);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshAttempt, token]);

  const state = snapshot?.currentState;
  const definition = state ? viewerDefinition(state) : null;
  const updatedTime = snapshot
    ? new Date(snapshot.updatedAt).toLocaleTimeString(
        locale === "id" ? "id-ID" : "en-US",
        { hour: "2-digit", minute: "2-digit" },
      )
    : "";

  return (
    <div className="min-h-screen min-h-dvh bg-paper pb-[max(28px,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <AppHeader compact />
      <main className="mx-auto w-full max-w-[720px] px-[clamp(18px,5vw,40px)] pt-8 pb-16">
        <p className="mb-3 text-xs font-black tracking-[0.12em] text-cobalt-dark uppercase">
          {t("liveViewer")}
        </p>
        <h1 className="mb-3 text-[clamp(28px,6vw,42px)] tracking-[-0.04em]">
          {t("viewerTitle")}
        </h1>
        {loading ? <p role="status">{t("viewerLoading")}</p> : null}
        {error && !snapshot ? (
          <section className="mx-auto w-full max-w-[580px] px-[22px] py-20 text-center [&>p]:mx-auto [&>p]:max-w-[600px] [&>p]:text-[clamp(17px,3vw,21px)] [&>p]:leading-[1.55] [&>p]:text-text-muted">
            <h2>{t("viewerUnavailable")}</h2>
            <p>{t("viewerUnavailableBody")}</p>
            <Button
              variant="outline"
              className="mt-6"
              type="button"
              onClick={() => navigate(localizedPath("/", locale))}
            >
              {t("backToHome")}
            </Button>
          </section>
        ) : null}
        {snapshot && state && definition ? (
          <>
            <p
              className="mb-4 text-[13px] leading-[1.45] text-text-muted"
              role="status"
            >
              {stale ? t("viewerStale") : t("viewerLive")} · {t(snapshot.sport)}{" "}
              ·{" "}
              {state.sport === "padel" && getMatchFormat(state) === "singles"
                ? t("padelLocalVariant")
                : t(getMatchFormat(state))}{" "}
              · {t("updatedAt")} {updatedTime}
            </p>
            {stale ? (
              <Button
                variant="outline"
                className="mb-4 min-h-11"
                type="button"
                onClick={() => setRefreshAttempt((current) => current + 1)}
              >
                {t("viewerRefresh")}
              </Button>
            ) : null}
            <section className={styles.scoreboard} aria-label={t("score")}>
              {(["A", "B"] as const).map((team) => (
                <article
                  className={styles.scoreCard}
                  data-serving={state.servingTeam === team}
                  key={team}
                >
                  <div className={styles.teamMeta}>
                    <span>{team === "A" ? t("teamA") : t("teamB")}</span>
                    <small>
                      {t(
                        state.tennis || state.padel
                          ? "tennisSets"
                          : state.tableTennis || state.squash
                            ? state.squash
                              ? "squashGames"
                              : "tableTennisGames"
                            : "sets",
                      )}
                      :{" "}
                      {state.tennis?.setsWon[team] ??
                        state.padel?.setsWon[team] ??
                        state.gamesWon[team]}
                    </small>
                    {state.tennis || state.padel ? (
                      <small>
                        {t("games")}:{" "}
                        {state.tennis?.gamesInSet[team] ??
                          state.padel?.gamesInSet[team]}
                      </small>
                    ) : null}
                  </div>
                  <strong className="block py-3 text-center text-[clamp(48px,12vw,76px)] leading-none font-black tabular-nums text-ink">
                    {state.tennis
                      ? tennisScoreLabel(state, team, locale)
                      : state.padel
                        ? padelScoreLabel(state, team, locale)
                        : state.points[team]}
                  </strong>
                </article>
              ))}
            </section>
            <Court definition={definition} state={state} />
            {state.status === "complete" ? (
              <p className="mb-4 text-[13px] leading-[1.45] text-text-muted">
                {t("matchComplete")}
              </p>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
