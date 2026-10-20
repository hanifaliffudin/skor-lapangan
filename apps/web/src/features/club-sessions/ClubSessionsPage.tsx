import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectControl } from "@/components/ui/select-control";
import { useAuth } from "../../lib/auth";
import { fillMessage, localizedPath, useLocale } from "../../lib/i18n";
import { saveDraft } from "../../lib/session";
import {
  createClubSessionManagement,
  derivePlayerRecords,
  type ClubSessionCourt,
  type ClubSessionMatch,
  type ClubSessionMatchResult,
  type ClubSessionPlayer,
  type ClubSessionSummary,
} from "./clubSessionManagement";
import { clubSessionMatchAction } from "./clubSessionMatchHandoff";
import { createClubSessionSupabaseAdapter } from "./clubSessionSupabaseAdapter";

const fieldClass =
  "grid gap-2 text-sm font-bold text-ink [&_input]:mt-0 [&_input]:font-medium";
const sectionClass =
  "rounded-xl border-2 border-line-strong bg-surface p-5 shadow-[4px_4px_0_var(--ink)] max-[560px]:p-4";

function today() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function ClubSessionsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const {
    isAnonymous,
    loading: authLoading,
    signInWithGoogle,
    user,
  } = useAuth();
  const isAccount = Boolean(user && !isAnonymous);
  const [sessions, setSessions] = useState<ClubSessionSummary[]>([]);
  const [session, setSession] = useState<ClubSessionSummary | null>(null);
  const [players, setPlayers] = useState<ClubSessionPlayer[]>([]);
  const [courts, setCourts] = useState<ClubSessionCourt[]>([]);
  const [queue, setQueue] = useState<ClubSessionMatch[]>([]);
  const [results, setResults] = useState<
    Record<string, ClubSessionMatchResult>
  >({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const [error, setError] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [sessionDate, setSessionDate] = useState(today);
  const [playerName, setPlayerName] = useState("");
  const [courtName, setCourtName] = useState("");
  const [selectedCourt, setSelectedCourt] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<
    [string, string, string, string]
  >(["", "", "", ""]);
  const management = useMemo(
    () =>
      createClubSessionManagement(
        createClubSessionSupabaseAdapter(user?.id ?? null),
      ),
    [user?.id],
  );

  const activePlayers = useMemo(
    () => players.filter((player) => player.is_active),
    [players],
  );
  const activeCourts = useMemo(
    () => courts.filter((court) => court.is_active),
    [courts],
  );

  const loadData = useCallback(
    async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
      if (!user || !isAccount) {
        setLoading(false);
        return;
      }
      if (showLoading) setLoading(true);
      setError("");
      if (!sessionId) {
        try {
          setSessions(await management.listSessions());
        } catch {
          setError(t("clubSessionLoadError"));
          setSessions([]);
        }
        setSession(null);
        setPlayers([]);
        setCourts([]);
        setQueue([]);
        setResults({});
        setLoading(false);
        return;
      }

      try {
        const detail = await management.loadSession(sessionId);
        setSession(detail.session);
        setPlayers(detail.players);
        setCourts(detail.courts);
        setQueue(detail.queue);
        setResults(detail.results);
        setSelectedCourt((current) =>
          detail.courts.some((court) => court.is_active && court.id === current)
            ? current
            : (detail.courts.find((court) => court.is_active)?.id ?? ""),
        );
      } catch {
        setError(t("clubSessionLoadError"));
        setSession(null);
        setPlayers([]);
        setCourts([]);
        setQueue([]);
        setResults({});
        setLoading(false);
        return;
      }
      setLoading(false);
    },
    [isAccount, management, sessionId, t, user],
  );

  useEffect(() => {
    setDeletePrompt(false);
    void loadData({ showLoading: true });
  }, [loadData]);

  useEffect(() => {
    document.title = session
      ? `${session.name} · ${t("clubSessions")}`
      : t("clubSessionsPageTitle");
  }, [session, t]);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !isAccount || busy) return;
    setBusy(true);
    setError("");
    try {
      const { id } = await management.createSession({
        name: sessionName,
        sessionDate,
      });
      setSessionName("");
      setSessionDate(today());
      navigate(localizedPath(`/sessions/${id}`, locale));
    } catch {
      setError(t("clubSessionSaveError"));
    } finally {
      setBusy(false);
    }
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !session || busy) return;
    const displayName = playerName.trim();
    if (!displayName) return;
    setBusy(true);
    setError("");
    try {
      await management.addPlayer({
        sessionId: session.id,
        displayName,
        currentPlayerCount: players.length,
      });
      setPlayerName("");
      await loadData();
    } catch {
      setError(t("clubSessionSaveError"));
    } finally {
      setBusy(false);
    }
  }

  async function addCourt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !session || busy) return;
    const name = courtName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      await management.addCourt({
        sessionId: session.id,
        name,
        currentCourtCount: courts.length,
      });
      setCourtName("");
      await loadData();
    } catch {
      setError(t("clubSessionSaveError"));
    } finally {
      setBusy(false);
    }
  }

  async function setRosterStatus(
    kind: "player" | "court",
    id: string,
    isActive: boolean,
  ) {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      if (kind === "player") {
        await management.setPlayerActive({
          sessionId: session.id,
          playerId: id,
          isActive,
        });
      } else {
        await management.setCourtActive({
          sessionId: session.id,
          courtId: id,
          isActive,
        });
      }
      await loadData();
    } catch {
      setError(t("clubSessionSaveError"));
    } finally {
      setBusy(false);
    }
  }

  async function addQueuedMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !session || busy) return;
    setBusy(true);
    setError("");
    try {
      await management.addQueuedMatch({
        session,
        players,
        courts,
        queue,
        courtId: selectedCourt,
        playerIds: selectedPlayers,
      });
      setSelectedPlayers(["", "", "", ""]);
      await loadData();
    } catch (error) {
      setError(
        error instanceof Error &&
          error.message === "CLUB_SESSION_ASSIGNMENT_INVALID"
          ? t("clubSessionAssignmentError")
          : t("clubSessionSaveError"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeQueuedMatch(id: string) {
    if (!session || busy) return;
    setBusy(true);
    try {
      await management.removeQueuedMatch({
        sessionId: session.id,
        queueId: id,
      });
      await loadData();
    } catch {
      setError(t("clubSessionSaveError"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleSessionStatus() {
    if (!session || busy) return;
    setBusy(true);
    try {
      await management.toggleStatus(session);
      await loadData();
    } catch {
      setError(t("clubSessionSaveError"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSession() {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      await management.deleteSession(session.id);
      navigate(localizedPath("/sessions", locale));
    } catch {
      setError(t("clubSessionSaveError"));
      setDeletePrompt(false);
    } finally {
      setBusy(false);
    }
  }

  function startMatch(entry: ClubSessionMatch) {
    if (!session) return;
    const action = clubSessionMatchAction({
      sessionStatus: session.status,
      entry,
    });
    if (action.type === "open") {
      navigate(
        localizedPath(
          `/match/${action.matchId}?clubSessionId=${session.id}`,
          locale,
        ),
      );
      return;
    }
    if (action.type === "blocked") {
      return;
    }
    saveDraft({ sport: "badminton", format: "doubles", mode: "casual" });
    navigate(
      localizedPath(
        `/setup?clubSessionId=${session.id}&clubMatchId=${action.matchId}`,
        locale,
      ),
    );
  }

  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player.display_name])),
    [players],
  );
  const courtById = useMemo(
    () => new Map(courts.map((court) => [court.id, court.name])),
    [courts],
  );
  const playerRecords = useMemo(() => {
    return derivePlayerRecords(players, queue, results);
  }, [players, queue, results]);

  return (
    <div className="min-h-screen min-h-dvh bg-paper pb-14 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <AppHeader compact />
      <main className="mx-auto w-full max-w-[1000px] px-[clamp(18px,4vw,40px)] pt-8">
        <Link
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold text-ink no-underline hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          to={localizedPath(sessionId ? "/sessions" : "/", locale)}
        >
          <span aria-hidden="true">←</span>
          <span className="ml-2">
            {sessionId ? t("clubSessions") : t("backToHome")}
          </span>
        </Link>
        <header className="mb-7 mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-cobalt">
              {t("clubSessionEyebrow")}
            </p>
            <h1 className="m-0 text-[clamp(2rem,6vw,3.25rem)] font-black leading-[1.02] tracking-[-0.045em] text-ink">
              {session?.name ?? t("clubSessions")}
            </h1>
            <p className="mb-0 mt-3 max-w-[620px] text-base leading-7 text-text-muted">
              {session ? t("clubSessionDetailIntro") : t("clubSessionsIntro")}
            </p>
          </div>
          {session ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                type="button"
                disabled={busy}
                onClick={() => void toggleSessionStatus()}
              >
                {session.status === "active"
                  ? t("clubSessionComplete")
                  : t("clubSessionReopen")}
              </Button>
              <Button
                variant="destructive"
                className="min-h-11"
                type="button"
                disabled={busy}
                onClick={() => setDeletePrompt((open) => !open)}
              >
                {t("clubSessionDelete")}
              </Button>
            </div>
          ) : null}
        </header>

        {authLoading || loading ? (
          <div
            className="rounded-xl border-2 border-line-strong bg-surface p-6 text-sm font-semibold text-text-muted"
            role="status"
          >
            {t("loading")}
          </div>
        ) : !isAccount ? (
          <section className={`${sectionClass} max-w-[680px]`}>
            <h2 className="m-0 text-2xl font-extrabold text-ink">
              {t("clubSessionSignInTitle")}
            </h2>
            <p className="mb-5 mt-2 leading-7 text-text-muted">
              {t("clubSessionSignInBody")}
            </p>
            <Button
              type="button"
              className="min-h-11"
              onClick={() => void signInWithGoogle()}
            >
              {t("signInWithGoogle")}
            </Button>
          </section>
        ) : error ? (
          <div
            className="mb-5 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 text-sm font-semibold text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {isAccount && !loading ? (
          sessionId && !session ? (
            <section className={`${sectionClass} max-w-[680px]`}>
              <h2 className="m-0 text-xl font-extrabold text-ink">
                {t("clubSessionNotFound")}
              </h2>
              <p className="mb-0 mt-2 leading-7 text-text-muted">
                {error || t("clubSessionNotFoundBody")}
              </p>
            </section>
          ) : session ? (
            <>
              {deletePrompt ? (
                <div
                  className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4"
                  role="group"
                  aria-label={t("clubSessionDelete")}
                >
                  <p className="m-0 flex-1 text-sm font-semibold leading-6 text-ink">
                    {t("clubSessionDeleteConfirm")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      className="min-h-11"
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteSession()}
                    >
                      {t("clubSessionDeleteConfirmAction")}
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-11"
                      type="button"
                      disabled={busy}
                      onClick={() => setDeletePrompt(false)}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                </div>
              ) : null}
              {error ? (
                <div
                  className="mb-5 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 text-sm font-semibold text-destructive"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-line-strong bg-surface px-4 py-3">
                  <p className="m-0 text-xs font-bold uppercase tracking-wide text-text-muted">
                    {t("clubSessionDate")}
                  </p>
                  <p className="mb-0 mt-1 font-extrabold text-ink">
                    {session.session_date}
                  </p>
                </div>
                <div className="rounded-lg border border-line-strong bg-surface px-4 py-3">
                  <p className="m-0 text-xs font-bold uppercase tracking-wide text-text-muted">
                    {t("clubSessionPlayers")}
                  </p>
                  <p className="mb-0 mt-1 font-extrabold text-ink">
                    {activePlayers.length}
                  </p>
                </div>
                <div className="rounded-lg border border-line-strong bg-surface px-4 py-3">
                  <p className="m-0 text-xs font-bold uppercase tracking-wide text-text-muted">
                    {t("clubSessionStatus")}
                  </p>
                  <p className="mb-0 mt-1 font-extrabold text-ink">
                    {t(
                      session.status === "active"
                        ? "clubSessionActive"
                        : "clubSessionCompleted",
                    )}
                  </p>
                </div>
              </div>

              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.88fr)]">
                <div className="grid gap-5">
                  <section
                    className={sectionClass}
                    aria-labelledby="club-roster-title"
                  >
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h2
                          id="club-roster-title"
                          className="m-0 text-xl font-extrabold text-ink"
                        >
                          {t("clubSessionRosterTitle")}
                        </h2>
                        <p className="mb-0 mt-1 text-sm leading-6 text-text-muted">
                          {t("clubSessionRosterBody")}
                        </p>
                      </div>
                    </div>
                    <form
                      className="mb-4 flex flex-col gap-2 sm:flex-row"
                      onSubmit={(event) => void addPlayer(event)}
                    >
                      <Label className="sr-only" htmlFor="club-player-name">
                        {t("clubSessionPlayerName")}
                      </Label>
                      <Input
                        id="club-player-name"
                        value={playerName}
                        maxLength={30}
                        placeholder={t("clubSessionPlayerPlaceholder")}
                        onChange={(event) => setPlayerName(event.target.value)}
                        required
                      />
                      <Button
                        className="min-h-11 sm:min-w-28"
                        type="submit"
                        disabled={busy}
                      >
                        {t("clubSessionAddPlayer")}
                      </Button>
                    </form>
                    <div className="grid gap-2">
                      {players.map((player) => {
                        const record = playerRecords.get(player.id) ?? {
                          played: 0,
                          won: 0,
                          lost: 0,
                        };
                        return (
                          <div
                            key={player.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p
                                className={`m-0 truncate font-extrabold ${player.is_active ? "text-ink" : "text-text-muted line-through"}`}
                              >
                                {player.display_name}
                              </p>
                              <p className="mb-0 mt-1 text-xs font-semibold text-text-muted">
                                {fillMessage(t("clubSessionRecord"), {
                                  played: record.played,
                                  won: record.won,
                                  lost: record.lost,
                                })}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-11"
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void setRosterStatus(
                                  "player",
                                  player.id,
                                  !player.is_active,
                                )
                              }
                            >
                              {player.is_active
                                ? t("clubSessionDeactivate")
                                : t("clubSessionReactivate")}
                            </Button>
                          </div>
                        );
                      })}
                      {players.length === 0 ? (
                        <p className="m-0 rounded-lg bg-paper p-4 text-sm text-text-muted">
                          {t("clubSessionRosterEmpty")}
                        </p>
                      ) : null}
                    </div>
                  </section>

                  <section
                    className={sectionClass}
                    aria-labelledby="club-courts-title"
                  >
                    <h2
                      id="club-courts-title"
                      className="m-0 text-xl font-extrabold text-ink"
                    >
                      {t("clubSessionCourtsTitle")}
                    </h2>
                    <form
                      className="my-4 flex flex-col gap-2 sm:flex-row"
                      onSubmit={(event) => void addCourt(event)}
                    >
                      <Label className="sr-only" htmlFor="club-court-name">
                        {t("clubSessionCourtName")}
                      </Label>
                      <Input
                        id="club-court-name"
                        value={courtName}
                        maxLength={50}
                        placeholder={t("clubSessionCourtPlaceholder")}
                        onChange={(event) => setCourtName(event.target.value)}
                        required
                      />
                      <Button
                        className="min-h-11 sm:min-w-28"
                        type="submit"
                        disabled={busy}
                      >
                        {t("clubSessionAddCourt")}
                      </Button>
                    </form>
                    <div className="flex flex-wrap gap-2">
                      {courts.map((court) => (
                        <div
                          key={court.id}
                          className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 ${court.is_active ? "border-line-strong bg-paper text-ink" : "border-line bg-paper text-text-muted"}`}
                        >
                          <span className="font-bold">{court.name}</span>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="min-h-11 px-2"
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void setRosterStatus(
                                "court",
                                court.id,
                                !court.is_active,
                              )
                            }
                          >
                            {court.is_active
                              ? t("clubSessionDeactivate")
                              : t("clubSessionReactivate")}
                          </Button>
                        </div>
                      ))}
                      {courts.length === 0 ? (
                        <p className="m-0 text-sm text-text-muted">
                          {t("clubSessionCourtsEmpty")}
                        </p>
                      ) : null}
                    </div>
                  </section>
                </div>

                <div className="grid gap-5">
                  <section
                    className={sectionClass}
                    aria-labelledby="club-queue-title"
                  >
                    <h2
                      id="club-queue-title"
                      className="m-0 text-xl font-extrabold text-ink"
                    >
                      {t("clubSessionQueueTitle")}
                    </h2>
                    <p className="mb-4 mt-1 text-sm leading-6 text-text-muted">
                      {t("clubSessionQueueBody")}
                    </p>
                    {session.status === "active" ? (
                      <form
                        className="grid gap-3 rounded-lg border border-line bg-paper p-3"
                        onSubmit={(event) => void addQueuedMatch(event)}
                      >
                        <Label className={fieldClass}>
                          <span>{t("clubSessionCourtName")}</span>
                          <SelectControl
                            value={selectedCourt}
                            onChange={(event) =>
                              setSelectedCourt(event.target.value)
                            }
                            required
                          >
                            <option value="">
                              {t("clubSessionSelectCourt")}
                            </option>
                            {activeCourts.map((court) => (
                              <option key={court.id} value={court.id}>
                                {court.name}
                              </option>
                            ))}
                          </SelectControl>
                        </Label>
                        {selectedPlayers.map((selected, index) => (
                          <Label className={fieldClass} key={index}>
                            <span>
                              {fillMessage(
                                t(
                                  index < 2
                                    ? "clubSessionTeamAPlayer"
                                    : "clubSessionTeamBPlayer",
                                ),
                                { number: (index % 2) + 1 },
                              )}
                            </span>
                            <SelectControl
                              value={selected}
                              onChange={(event) =>
                                setSelectedPlayers(
                                  (current) =>
                                    current.map((id, playerIndex) =>
                                      playerIndex === index
                                        ? event.target.value
                                        : id,
                                    ) as [string, string, string, string],
                                )
                              }
                              required
                            >
                              <option value="">
                                {t("clubSessionSelectPlayer")}
                              </option>
                              {activePlayers.map((player) => (
                                <option
                                  key={player.id}
                                  value={player.id}
                                  disabled={selectedPlayers.some(
                                    (id, selectedIndex) =>
                                      selectedIndex !== index &&
                                      id === player.id,
                                  )}
                                >
                                  {player.display_name}
                                </option>
                              ))}
                            </SelectControl>
                          </Label>
                        ))}
                        <Button
                          className="mt-1 min-h-11 w-full"
                          type="submit"
                          disabled={
                            busy ||
                            activePlayers.length < 4 ||
                            !activeCourts.length
                          }
                        >
                          {t("clubSessionAddToQueue")}
                        </Button>
                        {activePlayers.length < 4 || !activeCourts.length ? (
                          <p className="m-0 text-xs leading-5 text-text-muted">
                            {t("clubSessionQueueRequirements")}
                          </p>
                        ) : null}
                      </form>
                    ) : (
                      <p className="rounded-lg bg-paper p-3 text-sm text-text-muted">
                        {t("clubSessionQueueClosed")}
                      </p>
                    )}

                    <ol className="mt-4 grid list-none gap-3 p-0">
                      {queue.map((entry, index) => {
                        const result = entry.linked_match_id
                          ? results[entry.linked_match_id]
                          : null;
                        const isComplete =
                          result?.status === "complete" &&
                          Boolean(result.winner);
                        return (
                          <li
                            key={entry.id}
                            className="rounded-lg border border-line-strong bg-paper p-3"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold uppercase tracking-wide text-text-muted">
                                {fillMessage(t("clubSessionMatchNumber"), {
                                  number: index + 1,
                                })}{" "}
                                ·{" "}
                                {courtById.get(entry.court_id) ??
                                  t("clubSessionCourtName")}
                              </span>
                              {!entry.started_at ? (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="min-h-11 px-2 text-text-muted"
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void removeQueuedMatch(entry.id)
                                  }
                                >
                                  {t("remove")}
                                </Button>
                              ) : null}
                            </div>
                            <p className="m-0 text-sm font-bold leading-6 text-ink">
                              {playerById.get(entry.team_a_player_1) ?? "—"} +{" "}
                              {playerById.get(entry.team_a_player_2) ?? "—"}
                              <span className="px-2 text-text-muted">vs</span>
                              {playerById.get(entry.team_b_player_1) ??
                                "—"} +{" "}
                              {playerById.get(entry.team_b_player_2) ?? "—"}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-text-muted">
                                {isComplete
                                  ? fillMessage(t("clubSessionWinner"), {
                                      team:
                                        result.winner === "A"
                                          ? t("teamA")
                                          : t("teamB"),
                                    })
                                  : entry.linked_match_id
                                    ? t("clubSessionMatchSynced")
                                    : entry.started_at
                                      ? t("clubSessionMatchNotSynced")
                                      : t("clubSessionMatchQueued")}
                              </span>
                              <Button
                                variant={isComplete ? "outline" : "default"}
                                size="sm"
                                className="min-h-11"
                                type="button"
                                disabled={
                                  session.status !== "active" &&
                                  !entry.started_at
                                }
                                onClick={() => startMatch(entry)}
                              >
                                {entry.linked_match_id
                                  ? t("clubSessionOpenMatch")
                                  : entry.started_at
                                    ? t("clubSessionContinueSetup")
                                    : t("clubSessionStartMatch")}
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                      {queue.length === 0 ? (
                        <li className="rounded-lg bg-paper p-4 text-sm text-text-muted">
                          {t("clubSessionQueueEmpty")}
                        </li>
                      ) : null}
                    </ol>
                  </section>
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
              <section
                className={sectionClass}
                aria-labelledby="club-session-list-title"
              >
                <h2
                  id="club-session-list-title"
                  className="m-0 text-xl font-extrabold text-ink"
                >
                  {t("clubSessionYourSessions")}
                </h2>
                <div className="mt-4 grid gap-3">
                  {sessions.map((item) => (
                    <Link
                      key={item.id}
                      to={localizedPath(`/sessions/${item.id}`, locale)}
                      className="rounded-lg border border-line-strong bg-paper p-4 text-ink no-underline transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-lg">{item.name}</strong>
                        <span className="rounded-full border border-line px-2.5 py-1 text-xs font-bold">
                          {t(
                            item.status === "active"
                              ? "clubSessionActive"
                              : "clubSessionCompleted",
                          )}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-text-muted">
                        {item.session_date}
                      </span>
                    </Link>
                  ))}
                  {sessions.length === 0 ? (
                    <p className="m-0 rounded-lg bg-paper p-4 text-sm leading-6 text-text-muted">
                      {t("clubSessionListEmpty")}
                    </p>
                  ) : null}
                </div>
              </section>
              <section
                className={sectionClass}
                aria-labelledby="club-session-create-title"
              >
                <h2
                  id="club-session-create-title"
                  className="m-0 text-xl font-extrabold text-ink"
                >
                  {t("clubSessionCreateTitle")}
                </h2>
                <p className="mb-4 mt-1 text-sm leading-6 text-text-muted">
                  {t("clubSessionCreateBody")}
                </p>
                <form
                  className="grid gap-4"
                  onSubmit={(event) => void createSession(event)}
                >
                  <Label className={fieldClass} htmlFor="club-session-name">
                    <span>{t("clubSessionName")}</span>
                    <Input
                      id="club-session-name"
                      value={sessionName}
                      onChange={(event) => setSessionName(event.target.value)}
                      maxLength={80}
                      required
                    />
                  </Label>
                  <Label className={fieldClass} htmlFor="club-session-date">
                    <span>{t("clubSessionDate")}</span>
                    <Input
                      id="club-session-date"
                      type="date"
                      value={sessionDate}
                      onChange={(event) => setSessionDate(event.target.value)}
                      required
                    />
                  </Label>
                  <Button className="min-h-11" type="submit" disabled={busy}>
                    {t("clubSessionCreateAction")}
                  </Button>
                </form>
              </section>
            </div>
          )
        ) : null}
      </main>
    </div>
  );
}
