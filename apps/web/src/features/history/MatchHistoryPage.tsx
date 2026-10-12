import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../lib/auth";
import { localizedPath, useLocale } from "../../lib/i18n";
import { loadMatch } from "../../lib/session";
import {
  padelPointLabel,
  tennisPointLabel,
  type MatchFormat,
  type PadelGameScoring,
  type TeamId,
} from "@skor-lapangan/scoring-core";
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
  format: MatchFormat;
  sport: string;
  points: { A: number; B: number };
  gamesWon: { A: number; B: number };
  tennis?: {
    setNumber: number;
    setsWon: { A: number; B: number };
    gamesInSet: { A: number; B: number };
    pointScore: { A: number; B: number };
    advantage: TeamId | null;
    phase: string;
    tieBreakScore: { A: number; B: number } | null;
  };
  padel?: {
    setNumber: number;
    setsWon: { A: number; B: number };
    gamesInSet: { A: number; B: number };
    pointScore: { A: number; B: number };
    advantage: TeamId | null;
    starDeuces: number;
    gameScoring: PadelGameScoring;
    phase: string;
    tieBreakScore: { A: number; B: number } | null;
  };
}

function scoreRecord(value: Json | undefined): { A: number; B: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, Json>;
  return typeof record.A === "number" && typeof record.B === "number"
    ? { A: record.A, B: record.B }
    : null;
}

function padelHistoryLabel(
  padel: NonNullable<SavedScore["padel"]>,
  team: TeamId,
  locale: "en" | "id",
  t: ReturnType<typeof useLocale>["t"],
): string {
  if (padel.phase !== "game") return String(padel.tieBreakScore?.[team] ?? 0);
  if (padel.advantage === team) {
    return padel.gameScoring === "star_point"
      ? `Ad${padel.starDeuces + 1}`
      : "Ad";
  }
  if (padel.pointScore.A === 3 && padel.pointScore.B === 3) {
    if (padel.gameScoring === "golden_point") return "Golden";
    if (padel.gameScoring === "star_point") {
      return padel.starDeuces >= 2
        ? "Star"
        : `${t("deuce")} ${padel.starDeuces + 1}`;
    }
  }
  return padelPointLabel(padel.pointScore[team], locale);
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
    format:
      state.format === "singles" || state.format === "mixed_doubles"
        ? state.format
        : "doubles",
    sport: typeof state.sport === "string" ? state.sport : "",
    points: { A: pointValues.A, B: pointValues.B },
    gamesWon: { A: gameValues.A, B: gameValues.B },
    ...(state.tennis &&
    typeof state.tennis === "object" &&
    !Array.isArray(state.tennis)
      ? (() => {
          const tennis = state.tennis as Record<string, Json>;
          const numberRecord = (
            value: Json | undefined,
          ): { A: number; B: number } | null =>
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            typeof (value as Record<string, Json>).A === "number" &&
            typeof (value as Record<string, Json>).B === "number"
              ? {
                  A: (value as Record<string, number>).A as number,
                  B: (value as Record<string, number>).B as number,
                }
              : null;
          const sets = numberRecord(tennis.setsWon);
          const games = numberRecord(tennis.gamesInSet);
          const pointScore = numberRecord(tennis.pointScore);
          const tieBreakScore =
            tennis.tieBreakScore === null
              ? null
              : numberRecord(tennis.tieBreakScore);
          if (!sets || !games || !pointScore) return {};
          return {
            tennis: {
              setNumber:
                typeof tennis.setNumber === "number" ? tennis.setNumber : 1,
              setsWon: sets,
              gamesInSet: games,
              pointScore,
              advantage:
                tennis.advantage === "A" || tennis.advantage === "B"
                  ? tennis.advantage
                  : null,
              phase: typeof tennis.phase === "string" ? tennis.phase : "game",
              tieBreakScore,
            },
          };
        })()
      : {}),
    ...(state.padel &&
    typeof state.padel === "object" &&
    !Array.isArray(state.padel)
      ? (() => {
          const padel = state.padel as Record<string, Json>;
          const sets = scoreRecord(padel.setsWon);
          const games = scoreRecord(padel.gamesInSet);
          const pointScore = scoreRecord(padel.pointScore);
          const tieBreakScore =
            padel.tieBreakScore === null
              ? null
              : scoreRecord(padel.tieBreakScore);
          const scoring = padel.gameScoring;
          if (
            !sets ||
            !games ||
            !pointScore ||
            (scoring !== "advantage" &&
              scoring !== "star_point" &&
              scoring !== "golden_point")
          )
            return {};
          return {
            padel: {
              setNumber:
                typeof padel.setNumber === "number" ? padel.setNumber : 1,
              setsWon: sets,
              gamesInSet: games,
              pointScore,
              advantage:
                padel.advantage === "A" || padel.advantage === "B"
                  ? padel.advantage
                  : null,
              starDeuces:
                typeof padel.starDeuces === "number" ? padel.starDeuces : 0,
              gameScoring: scoring,
              phase: typeof padel.phase === "string" ? padel.phase : "game",
              tieBreakScore,
            },
          };
        })()
      : {}),
  };
}

export function MatchHistoryPage() {
  const { locale, t } = useLocale();
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
                    {match.sport === "padel" && score?.format === "singles"
                      ? t("padelLocalVariant")
                      : t(
                          match.sport === "pickleball" ||
                            match.sport === "tennis" ||
                            match.sport === "padel"
                            ? match.sport
                            : "badminton",
                        )}{" "}
                    · {t(score?.format ?? "doubles")}
                  </strong>
                  <span>
                    {t(
                      match.status === "complete"
                        ? "matchComplete"
                        : "activeMatch",
                    )}
                  </span>
                </div>
                {score?.padel ? (
                  <div className={styles.historyScore}>
                    <p>
                      {t("tennisSets")} {score.padel.setsWon.A}–
                      {score.padel.setsWon.B}
                    </p>
                    <small>
                      {t("set")} {score.padel.setNumber} · {t("games")}:{" "}
                      {score.padel.gamesInSet.A}–{score.padel.gamesInSet.B}
                      {score.padel.phase === "game"
                        ? ` · ${t("score")}: ${padelHistoryLabel(score.padel, "A", locale, t)}–${padelHistoryLabel(score.padel, "B", locale, t)}`
                        : ` · ${t(score.padel.phase === "match_tiebreak" ? "matchTieBreak" : "tieBreak")}: ${score.padel.tieBreakScore?.A ?? 0}–${score.padel.tieBreakScore?.B ?? 0}`}
                    </small>
                  </div>
                ) : score?.tennis ? (
                  <div className={styles.historyScore}>
                    <p>
                      {t("tennisSets")} {score.tennis.setsWon.A}–
                      {score.tennis.setsWon.B}
                    </p>
                    <small>
                      {t("set")} {score.tennis.setNumber} · {t("games")}:{" "}
                      {score.tennis.gamesInSet.A}–{score.tennis.gamesInSet.B}
                      {score.tennis.phase === "game"
                        ? ` · ${t("score")}: ${score.tennis.advantage === "A" ? t("advantageScore") : tennisPointLabel(score.tennis.pointScore.A, locale)}–${score.tennis.advantage === "B" ? t("advantageScore") : tennisPointLabel(score.tennis.pointScore.B, locale)}`
                        : ` · ${t(score.tennis.phase === "match_tiebreak" ? "matchTieBreak" : "tieBreak")}: ${score.tennis.tieBreakScore?.A ?? 0}–${score.tennis.tieBreakScore?.B ?? 0}`}
                    </small>
                  </div>
                ) : score ? (
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
                    onClick={() =>
                      navigate(localizedPath(`/match/${match.id}`, locale))
                    }
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
        <Link className={styles.textButton} to={localizedPath("/", locale)}>
          {t("backToHome")}
        </Link>
      </main>
    </div>
  );
}
