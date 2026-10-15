import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { useAuth } from "../../lib/auth";
import { localizedPath, useLocale } from "../../lib/i18n";
import { removeMatch } from "../../lib/session";
import {
  padelPointLabel,
  tennisPointLabel,
  type MatchFormat,
  type PadelGameScoring,
  type TeamId,
} from "@skor-lapangan/scoring-core";
import { supabase } from "../../lib/supabase";
import type { Json } from "../../lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectControl } from "@/components/ui/select-control";
import styles from "../../styles/App.module.css";

const HISTORY_PAGE_SIZE = 50;

interface MatchHistoryRow {
  id: string;
  sport: string;
  status: string;
  winner: string | null;
  team_a_name?: string;
  team_b_name?: string;
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
  const { action, isAnonymous, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [historyCursor, setHistoryCursor] = useState<{
    updatedAt: string;
    id: string;
  } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "complete"
  >("all");
  const [sportFilter, setSportFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    document.title = t("historyPageTitle");
  }, [t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setSearchQuery(searchInput.trim()),
      250,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (!supabase || !user || isAnonymous) {
      setMatches([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    setMatches([]);
    setHistoryCursor(null);
    setHasMore(false);
    void supabase
      .rpc("list_my_match_summaries", {
        p_search: searchQuery || null,
        p_status: statusFilter === "all" ? null : statusFilter,
        p_sport: sportFilter === "all" ? null : sportFilter,
        p_sort: sortOrder,
        p_limit: HISTORY_PAGE_SIZE,
        p_before_updated_at: null,
        p_before_id: null,
      })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(queryError.message);
        else {
          const page = (data ?? []) as MatchHistoryRow[];
          const last = page.at(-1);
          setMatches(page);
          setHistoryCursor(
            last ? { updatedAt: last.updated_at, id: last.id } : null,
          );
          setHasMore(page.length === HISTORY_PAGE_SIZE);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    user,
    isAnonymous,
    retryAttempt,
    searchQuery,
    sortOrder,
    sportFilter,
    statusFilter,
  ]);

  async function loadMoreMatches() {
    if (!supabase || !historyCursor || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const { data, error: queryError } = await supabase.rpc(
      "list_my_match_summaries",
      {
        p_search: searchQuery || null,
        p_status: statusFilter === "all" ? null : statusFilter,
        p_sport: sportFilter === "all" ? null : sportFilter,
        p_sort: sortOrder,
        p_limit: HISTORY_PAGE_SIZE,
        p_before_updated_at: historyCursor.updatedAt,
        p_before_id: historyCursor.id,
      },
    );
    if (queryError) {
      setError(queryError.message);
      setLoadingMore(false);
      return;
    }
    const page = (data ?? []) as MatchHistoryRow[];
    const last = page.at(-1);
    setMatches((current) => [...current, ...page]);
    setHistoryCursor(last ? { updatedAt: last.updated_at, id: last.id } : null);
    setHasMore(page.length === HISTORY_PAGE_SIZE);
    setLoadingMore(false);
  }

  async function handleDeleteMatch(matchId: string) {
    if (!supabase) return;
    setDeleteError("");
    setDeletingMatchId(matchId);
    const { error: deleteQueryError } = await supabase
      .from("matches")
      .delete()
      .eq("id", matchId);
    if (deleteQueryError) {
      setDeleteError(deleteQueryError.message);
      setDeletingMatchId(null);
      return;
    }
    removeMatch(matchId);
    setMatches((current) => current.filter((match) => match.id !== matchId));
    setConfirmDeleteId(null);
    setDeletingMatchId(null);
  }

  const orderedMatches = [...matches].sort((left, right) => {
    const leftGroup = left.status === "complete" ? 1 : 0;
    const rightGroup = right.status === "complete" ? 1 : 0;
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    return sortOrder === "oldest"
      ? left.updated_at.localeCompare(right.updated_at)
      : right.updated_at.localeCompare(left.updated_at);
  });
  const hasHistoryFilters = Boolean(
    searchInput.trim() ||
    statusFilter !== "all" ||
    sportFilter !== "all" ||
    sortOrder !== "newest",
  );

  function clearHistoryFilters() {
    setSearchInput("");
    setSearchQuery("");
    setStatusFilter("all");
    setSportFilter("all");
    setSortOrder("newest");
  }

  return (
    <div className={styles.pageShell}>
      <AppHeader />
      <main className={styles.rulesMain}>
        <p className={styles.eyebrow}>{t("matchHistory")}</p>
        <h1 className={styles.historyTitle}>{t("matchHistory")}</h1>
        <p className={styles.historyIntro}>{t("historyIntro")}</p>
        {user && !isAnonymous ? (
          <section
            className={styles.historyFilters}
            aria-label={t("matchHistory")}
          >
            <label className={styles.historySearch}>
              <span className="sr-only">{t("historySearchPlaceholder")}</span>
              <Input
                type="search"
                value={searchInput}
                placeholder={t("historySearchPlaceholder")}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </label>
            <div className={styles.historyFilterRow}>
              <label className={styles.historyFilterField}>
                <span>{t("historyFilterStatus")}</span>
                <SelectControl
                  name="history-status-filter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as typeof statusFilter)
                  }
                >
                  <option value="all">{t("historyFilterAll")}</option>
                  <option value="active">{t("historyFilterInProgress")}</option>
                  <option value="complete">
                    {t("historyFilterCompleted")}
                  </option>
                </SelectControl>
              </label>
              <label className={styles.historyFilterField}>
                <span>{t("historyFilterSport")}</span>
                <SelectControl
                  name="history-sport-filter"
                  value={sportFilter}
                  onChange={(event) => setSportFilter(event.target.value)}
                >
                  <option value="all">{t("allSports")}</option>
                  <option value="badminton">{t("badminton")}</option>
                  <option value="pickleball">{t("pickleball")}</option>
                  <option value="tennis">{t("tennis")}</option>
                  <option value="padel">{t("padel")}</option>
                  <option value="table_tennis">{t("table_tennis")}</option>
                  <option value="squash">{t("squash")}</option>
                </SelectControl>
              </label>
              <label className={styles.historyFilterField}>
                <span>{t("historySort")}</span>
                <SelectControl
                  name="history-sort"
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(event.target.value as typeof sortOrder)
                  }
                >
                  <option value="newest">{t("historySortNewest")}</option>
                  <option value="oldest">{t("historySortOldest")}</option>
                </SelectControl>
              </label>
            </div>
          </section>
        ) : null}
        {!user || isAnonymous ? (
          <section className={styles.rulesEmpty}>
            <h2>{t("historyGoogleRequired")}</h2>
            <p>{t("historyRequiresGoogle")}</p>
            <Button
              type="button"
              className="mt-4 min-h-11"
              disabled={action === "google" || action === "claiming"}
              onClick={() => void signInWithGoogle()}
            >
              {action === "google" || action === "claiming"
                ? t("working")
                : t("signInWithGoogle")}
            </Button>
          </section>
        ) : null}
        {loading ? <p role="status">{t("loading")}</p> : null}
        {error ? (
          <div className="grid gap-3" role="alert">
            <p className={styles.formError}>{t("historyLoadError")}</p>
            <Button
              variant="outline"
              type="button"
              className="min-h-11 justify-self-start"
              onClick={() => setRetryAttempt((current) => current + 1)}
            >
              {t("retryHistory")}
            </Button>
          </div>
        ) : null}
        {!loading && !error && user && !isAnonymous && matches.length === 0 ? (
          <section className={styles.rulesEmpty}>
            <h2>
              {t(hasHistoryFilters ? "historyNoResults" : "noSavedMatches")}
            </h2>
            <p>
              {hasHistoryFilters ? t("historyIntro") : t("noSavedMatchesBody")}
            </p>
            {hasHistoryFilters ? (
              <Button
                variant="outline"
                type="button"
                className="mt-4 min-h-11"
                onClick={clearHistoryFilters}
              >
                {t("clearHistoryFilters")}
              </Button>
            ) : null}
          </section>
        ) : null}
        <div className={styles.historyList}>
          {orderedMatches.map((match, index) => {
            const score = savedScore(match.current_state);
            const isFirstInGroup =
              index === 0 || orderedMatches[index - 1]?.status !== match.status;
            return (
              <Fragment key={match.id}>
                {isFirstInGroup ? (
                  <h2 className={styles.historyGroupTitle}>
                    {t(
                      match.status === "complete"
                        ? "historyCompleted"
                        : "historyInProgress",
                    )}
                  </h2>
                ) : null}
                <article className={styles.historyCard}>
                  <div className={styles.historyCardHeading}>
                    <strong>
                      {match.sport === "padel" && score?.format === "singles"
                        ? t("padelLocalVariant")
                        : t(
                            match.sport === "pickleball" ||
                              match.sport === "tennis" ||
                              match.sport === "padel" ||
                              match.sport === "table_tennis" ||
                              match.sport === "squash"
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
                  ) : score?.sport === "table_tennis" ? (
                    <div className={styles.historyScore}>
                      <p>
                        {t("tableTennisGames")} {score.gamesWon.A}–
                        {score.gamesWon.B}
                      </p>
                      <small>
                        {t("game")} · {t("score")}: {score.points.A}–
                        {score.points.B}
                      </small>
                    </div>
                  ) : score?.sport === "squash" ? (
                    <div className={styles.historyScore}>
                      <p>
                        {t("squashGames")} {score.gamesWon.A}–{score.gamesWon.B}
                      </p>
                      <small>
                        {t("game")} · {t("score")}: {score.points.A}–
                        {score.points.B}
                      </small>
                    </div>
                  ) : score ? (
                    <p className={styles.historyScore}>
                      {t("teamA")} {score.points.A}–{score.points.B}{" "}
                      {t("teamB")}
                      <small>
                        {score.gamesWon.A}–{score.gamesWon.B} {t("gamesWon")}
                      </small>
                    </p>
                  ) : null}
                  {match.team_a_name || match.team_b_name ? (
                    <p className={styles.historyTeams}>
                      {match.team_a_name ?? t("teamA")} ·{" "}
                      {match.team_b_name ?? t("teamB")}
                    </p>
                  ) : null}
                  <p className={styles.historyDate}>
                    {t("lastUpdated")}{" "}
                    {new Date(match.updated_at).toLocaleString(
                      locale === "id" ? "id-ID" : "en-US",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                  <div className={styles.historyCardActions}>
                    <Button
                      variant="outline"
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() =>
                        navigate(localizedPath(`/match/${match.id}`, locale))
                      }
                    >
                      {t(
                        match.status === "complete"
                          ? "viewMatch"
                          : "resumeMatch",
                      )}
                    </Button>
                    {confirmDeleteId === match.id ? (
                      <div
                        className="flex flex-wrap items-center gap-2"
                        role="group"
                      >
                        <Button
                          variant="destructive"
                          type="button"
                          className="min-h-11"
                          disabled={deletingMatchId === match.id}
                          onClick={() => void handleDeleteMatch(match.id)}
                        >
                          {deletingMatchId === match.id
                            ? t("deletingHistoryMatch")
                            : t("confirmDeleteHistoryMatch")}
                        </Button>
                        <Button
                          variant="outline"
                          type="button"
                          className="min-h-11"
                          disabled={deletingMatchId === match.id}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {t("cancel")}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        type="button"
                        className="min-h-11 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleteError("");
                          setConfirmDeleteId(match.id);
                        }}
                      >
                        {t("deleteHistoryMatch")}
                      </Button>
                    )}
                  </div>
                  {deleteError && confirmDeleteId === match.id ? (
                    <p className={styles.formError} role="alert">
                      {t("historyDeleteError")}
                    </p>
                  ) : null}
                </article>
              </Fragment>
            );
          })}
        </div>
        {hasMore && !error ? (
          <Button
            variant="outline"
            className="mt-6 min-h-11"
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMoreMatches()}
          >
            {loadingMore ? t("loading") : t("loadMore")}
          </Button>
        ) : null}
        <Link className={styles.textButton} to={localizedPath("/", locale)}>
          {t("backToHome")}
        </Link>
      </main>
    </div>
  );
}
