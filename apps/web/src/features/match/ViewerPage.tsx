import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  MatchDefinition,
  MatchState,
  Sport,
  TeamId,
} from "@skor-lapangan/scoring-core";
import { AppHeader } from "../../components/AppHeader";
import { useLocale } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";
import styles from "../../styles/App.module.css";
import { Court } from "./Court";

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
  const positionIsValid = (position: unknown) => {
    if (!position || typeof position !== "object") return false;
    const sides = position as { left?: unknown; right?: unknown };
    return (
      [0, 1].includes(sides.left as number) &&
      [0, 1].includes(sides.right as number)
    );
  };

  return (
    typeof state.matchId === "string" &&
    (state.sport === "badminton" || state.sport === "pickleball") &&
    typeof state.gameNumber === "number" &&
    Boolean(
      points && Number.isInteger(points.A) && Number.isInteger(points.B),
    ) &&
    Boolean(
      gamesWon && Number.isInteger(gamesWon.A) && Number.isInteger(gamesWon.B),
    ) &&
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
    Array.isArray(state.completedGames)
  );
}

function viewerDefinition(state: MatchState): MatchDefinition {
  const genericTeam = (team: TeamId) => ({
    name: team === "A" ? "Team A" : "Team B",
    players: [
      { id: `${team}-player-1`, name: "Player 1" },
      { id: `${team}-player-2`, name: "Player 2" },
    ] as const,
  });
  return {
    id: state.matchId,
    sport: state.sport,
    rulesetId: "viewer",
    mode: "casual",
    createdAt: new Date().toISOString(),
    initialServingTeam: state.servingTeam,
    initialServingPlayer: state.currentServer,
    teams: { A: genericTeam("A"), B: genericTeam("B") },
  };
}

export function ViewerPage() {
  const { token } = useParams();
  const { t } = useLocale();
  const [snapshot, setSnapshot] = useState<ViewerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState(false);
  const hasSnapshot = useRef(false);

  useEffect(() => {
    let active = true;
    let requestRunning = false;
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
        sport: row.sport === "pickleball" ? "pickleball" : "badminton",
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

    void refresh();
    const interval = window.setInterval(() => void refresh(), 3000);
    const handleOnline = () => void refresh();
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleOnline);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleOnline);
    };
  }, [token]);

  const state = snapshot?.currentState;
  const definition = state ? viewerDefinition(state) : null;

  return (
    <div className={styles.matchShell}>
      <AppHeader compact />
      <main className={styles.viewerMain}>
        <p className={styles.eyebrow}>{t("liveViewer")}</p>
        <h1>{t("viewerTitle")}</h1>
        {loading ? <p role="status">{t("viewerLoading")}</p> : null}
        {error && !snapshot ? (
          <section className={styles.emptyState}>
            <h2>{t("viewerUnavailable")}</h2>
            <p>{t("viewerUnavailableBody")}</p>
          </section>
        ) : null}
        {snapshot && state && definition ? (
          <>
            <p className={styles.viewerMeta} role="status">
              {stale ? t("viewerStale") : t("viewerLive")} · {t(snapshot.sport)}{" "}
              · {t("updatedAt")}{" "}
              {new Date(snapshot.updatedAt).toLocaleTimeString()}
            </p>
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
                      {t("sets")}: {state.gamesWon[team]}
                    </small>
                  </div>
                  <strong className={styles.viewerScore}>
                    {state.points[team]}
                  </strong>
                </article>
              ))}
            </section>
            <Court definition={definition} state={state} />
            {state.status === "complete" ? (
              <p className={styles.viewerMeta}>{t("matchComplete")}</p>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
