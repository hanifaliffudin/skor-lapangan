import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../lib/auth";
import { useLocale } from "../../lib/i18n";
import { loadMatch } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import type { Json } from "../../lib/database.types";
import styles from "../../styles/App.module.css";

interface MatchHistoryRow {
  id: string;
  sport: string;
  status: string;
  winner: string | null;
  current_state: Json;
  created_at: string;
  updated_at: string;
}

interface SavedScore {
  points: { A: number; B: number };
  gamesWon: { A: number; B: number };
}

function savedScore(value: Json): SavedScore | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const state = value as Record<string, Json>;
  const points = state.points;
  const gamesWon = state.gamesWon;
  if (!points || typeof points !== "object" || Array.isArray(points))
    return null;
  if (!gamesWon || typeof gamesWon !== "object" || Array.isArray(gamesWon))
    return null;
  const pointValues = points as Record<string, Json>;
  const gameValues = gamesWon as Record<string, Json>;
  if (
    typeof pointValues.A !== "number" ||
    typeof pointValues.B !== "number" ||
    typeof gameValues.A !== "number" ||
    typeof gameValues.B !== "number"
  )
    return null;
  return {
    points: { A: pointValues.A, B: pointValues.B },
    gamesWon: { A: gameValues.A, B: gameValues.B },
  };
}

export function MatchHistoryPage() {
  const { t } = useLocale();
  const { user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase || !user || isAnonymous) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase
      .from("matches")
      .select("id,sport,status,winner,current_state,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(queryError.message);
        else setMatches((data ?? []) as MatchHistoryRow[]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, isAnonymous]);

  return (
    <div className={styles.pageShell}>
      <AppHeader />
      <main className={styles.rulesMain}>
        <p className={styles.eyebrow}>{t("matchHistory")}</p>
        <h1 className={styles.historyTitle}>{t("matchHistory")}</h1>
        <p className={styles.historyIntro}>{t("historyIntro")}</p>
        {!user || isAnonymous ? (
          <section className={styles.rulesEmpty}>
            <h2>{t("googleRequired")}</h2>
            <p>{t("historyRequiresGoogle")}</p>
          </section>
        ) : null}
        {loading ? <p role="status">{t("loading")}</p> : null}
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && user && !isAnonymous && matches.length === 0 ? (
          <section className={styles.rulesEmpty}>
            <h2>{t("noSavedMatches")}</h2>
            <p>{t("noSavedMatchesBody")}</p>
          </section>
        ) : null}
        <div className={styles.historyList}>
          {matches.map((match) => {
            const score = savedScore(match.current_state);
            const localMatch = loadMatch(match.id);
            return (
              <article className={styles.historyCard} key={match.id}>
                <div className={styles.historyCardHeading}>
                  <strong>
                    {t(
                      match.sport === "pickleball" ? "pickleball" : "badminton",
                    )}
                  </strong>
                  <span>
                    {t(
                      match.status === "complete"
                        ? "matchComplete"
                        : "activeMatch",
                    )}
                  </span>
                </div>
                {score ? (
                  <p className={styles.historyScore}>
                    {t("teamA")} {score.points.A}–{score.points.B} {t("teamB")}
                    <small>
                      {score.gamesWon.A}–{score.gamesWon.B}{" "}
                      {t("sets").toLowerCase()}
                    </small>
                  </p>
                ) : null}
                <p className={styles.historyDate}>
                  {t("lastUpdated")}{" "}
                  {new Date(match.updated_at).toLocaleString()}
                </p>
                {localMatch ? (
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => navigate("/match/" + match.id)}
                  >
                    {t("openOnThisDevice")}
                  </button>
                ) : (
                  <span className={styles.historyDeviceOnly}>
                    {t("detailsOnOriginalDevice")}
                  </span>
                )}
              </article>
            );
          })}
        </div>
        <Link className={styles.textButton} to="/">
          {t("backToHome")}
        </Link>
      </main>
    </div>
  );
}
