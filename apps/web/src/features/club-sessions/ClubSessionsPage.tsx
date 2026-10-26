import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { AuthProviderButtons } from "../../components/AuthProviderButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectControl } from "@/components/ui/select-control";
import { useAuth } from "../../lib/auth";
import {
  fillMessage,
  formatClockTime,
  formatDateOnly,
  localizedPath,
  useLocale,
} from "../../lib/i18n";
import { saveDraft } from "../../lib/session";
import {
  createClubSessionManagement,
  clubSessionPlayProfile,
  clubSessionPlayProfileForSport,
  derivePlayerRecords,
  deriveStandings,
  type ClubSessionCourt,
  type ClubSessionAvailability,
  type ClubSessionGender,
  type ClubSessionMatch,
  type ClubSessionMatchResult,
  type ClubSessionPlayer,
  type ClubSessionPairingMode,
  type ClubSessionSport,
  type ClubSessionSmartRotationPlan,
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
    authProviders,
    isAnonymous,
    loading: authLoading,
    signInWithGoogle,
    signInWithProvider,
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
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  const [sessionName, setSessionName] = useState("");
  const [sessionDate, setSessionDate] = useState(today);
  const [sessionTime, setSessionTime] = useState("");
  const [sessionLocation, setSessionLocation] = useState("");
  const [sessionSport, setSessionSport] =
    useState<ClubSessionSport>("badminton");
  const [pairingMode, setPairingMode] =
    useState<ClubSessionPairingMode>("open");
  const [playerName, setPlayerName] = useState("");
  const [playerGender, setPlayerGender] =
    useState<ClubSessionGender>("unspecified");
  const [playerSkillLevel, setPlayerSkillLevel] = useState("3");
  const [courtName, setCourtName] = useState("");
  const [selectedCourt, setSelectedCourt] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([
    "",
    "",
    "",
    "",
  ]);
  const [mixedFallbackPrompt, setMixedFallbackPrompt] = useState(false);
  const [manualFallbackPrompt, setManualFallbackPrompt] = useState(false);
  const [rotationPreview, setRotationPreview] =
    useState<ClubSessionSmartRotationPlan | null>(null);
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
  const sessionProfile = session ? clubSessionPlayProfile(session) : null;
  const requiredPlayersPerMatch = sessionProfile?.playersPerMatch ?? 4;
  const sessionProfileLabel = sessionProfile
    ? sessionProfile.format === "singles"
      ? fillMessage(t("clubSessionSinglesRound"), {
          players: sessionProfile.playersPerMatch,
        })
      : t("doubles")
    : t("doubles");

  const loadData = useCallback(
    async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
      if (!user || !isAccount) {
        setLoading(false);
        return;
      }
      setRotationPreview(null);
      if (offline) {
        setLoading(false);
        setError("");
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
        setPairingMode(detail.session.pairing_mode ?? "open");
        setSelectedPlayers(
          Array.from(
            {
              length: clubSessionPlayProfile(detail.session).playersPerMatch,
            },
            () => "",
          ),
        );
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
    [isAccount, management, offline, sessionId, t, user],
  );

  useEffect(() => {
    setDeletePrompt(false);
    void loadData({ showLoading: true });
  }, [loadData]);

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    document.title = session
      ? `${session.name} · ${t("clubSessions")}`
      : t("clubSessionsPageTitle");
  }, [session, t]);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !isAccount || busy || offline) return;
    setBusy(true);
    setError("");
    try {
      const { id } = await management.createSession({
        name: sessionName,
        sessionDate,
        startTime: sessionTime || undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        locationName: sessionLocation,
        sport: sessionSport,
        playProfile: clubSessionPlayProfileForSport(sessionSport).id,
        pairingMode:
          clubSessionPlayProfileForSport(sessionSport).format === "singles"
            ? "open"
            : pairingMode,
      });
      setSessionName("");
      setSessionDate(today());
      setSessionTime("");
      setSessionLocation("");
      setSessionSport("badminton");
      navigate(localizedPath(`/sessions/${id}`, locale));
    } catch {
      setError(t("clubSessionSaveError"));
    } finally {
      setBusy(false);
    }
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !session || busy || offline) return;
    const displayName = playerName.trim();
    if (!displayName) return;
    setBusy(true);
    setError("");
    try {
      await management.addPlayer({
        sessionId: session.id,
        displayName,
        currentPlayerCount: players.length,
        gender: playerGender,
        skillLevel: Number(playerSkillLevel),
      });
      setPlayerName("");
      await loadData();
    } catch {
      setError(t("clubSessionSaveError"));
    } finally {
      setBusy(false);
    }
  }

  async function updatePlayerProfile(
    playerId: string,
    profile: {
      gender?: ClubSessionGender;
      skillLevel?: number;
      availability?: ClubSessionAvailability;
      avoidPlayerIds?: string[];
    },
  ) {
    if (!session || busy || offline) return;
    setBusy(true);
    setError("");
    try {
      await management.updatePlayerProfile({
        sessionId: session.id,
        playerId,
        ...profile,
      });
      await loadData();
    } catch {
      setError(t("clubSessionSaveProfileError"));
    } finally {
      setBusy(false);
    }
  }

  async function addCourt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !session || busy || offline) return;
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
    if (!session || busy || offline) return;
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

  async function addQueuedMatch(
    event?: FormEvent<HTMLFormElement>,
    allowOpenFallback = false,
  ) {
    event?.preventDefault();
    if (!user || !session || busy || offline) return;
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
        allowOpenFallback,
      });
      setSelectedPlayers(
        Array.from({ length: requiredPlayersPerMatch }, () => ""),
      );
      setManualFallbackPrompt(false);
      await loadData();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "CLUB_SESSION_MIXED_ASSIGNMENT_INVALID") {
        setManualFallbackPrompt(true);
      }
      setError(
        code === "CLUB_SESSION_ASSIGNMENT_INVALID"
          ? t("clubSessionAssignmentError")
          : code === "CLUB_SESSION_MIXED_ASSIGNMENT_INVALID"
            ? t("clubSessionMixedManualFallbackRequired")
            : t("clubSessionSaveError"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function previewNextCourts(allowOpenFallback = false) {
    if (!user || !session || busy || offline) return;
    setBusy(true);
    setError("");
    try {
      const plan = management.planSmartRotation({
        session,
        players,
        courts,
        queue,
        results,
        allowOpenFallback,
      });
      if (plan.reason === "MIXED_FALLBACK_REQUIRED") {
        setMixedFallbackPrompt(true);
      } else {
        setMixedFallbackPrompt(false);
      }
      if (!plan.matches.length) {
        setError(
          plan.reason === "NO_FREE_COURT"
            ? t("clubSessionNoFreeCourt")
            : plan.reason === "MIXED_FALLBACK_REQUIRED"
              ? t("clubSessionMixedFallbackRequired")
              : t("clubSessionRotationRequirements"),
        );
        return;
      }
      setRotationPreview(plan);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setError(
        code === "CLUB_SESSION_SCHEDULE_EXISTS"
          ? t("clubSessionScheduleExists")
          : code === "CLUB_SESSION_SCHEDULE_REQUIREMENTS"
            ? fillMessage(t("clubSessionScheduleRequirements"), {
                players: requiredPlayersPerMatch,
              })
            : t("clubSessionSaveError"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmSmartRotation() {
    if (!user || !session || !rotationPreview || busy || offline) return;
    setBusy(true);
    setError("");
    try {
      await management.queueSmartRotationPlan({
        session,
        queue,
        plan: rotationPreview,
      });
      setRotationPreview(null);
      setMixedFallbackPrompt(false);
      await loadData();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "CLUB_SESSION_ROTATION_STALE"
      ) {
        setRotationPreview(null);
        await loadData();
        setError(t("clubSessionRotationStale"));
      } else {
        setError(t("clubSessionSaveError"));
      }
    } finally {
      setBusy(false);
    }
  }

  function rejectSmartRotation() {
    setRotationPreview(null);
    setMixedFallbackPrompt(false);
    setError(t("clubSessionRotationRejected"));
  }

  async function removeQueuedMatch(id: string) {
    if (!session || busy || offline) return;
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
    if (!session || busy || offline) return;
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
    if (!session || busy || offline) return;
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
    if (offline && action.type !== "open") return;
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
    saveDraft({
      sport: session.sport,
      format: sessionProfile?.format ?? "doubles",
      mode: "casual",
    });
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
  const standings = useMemo(
    () => deriveStandings(players, queue, results),
    [players, queue, results],
  );
  const hasCompletedResults = standings.some((standing) => standing.played > 0);
  function queuePlayerLabel(index: number) {
    const isDoubles = requiredPlayersPerMatch === 4;
    return fillMessage(
      t(
        (isDoubles && index < 2) || (!isDoubles && index === 0)
          ? "clubSessionTeamAPlayer"
          : "clubSessionTeamBPlayer",
      ),
      { number: isDoubles ? (index % 2) + 1 : 1 },
    );
  }

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
              {session
                ? `${t(session.sport)} · ${sessionProfileLabel}${
                    sessionProfile?.rotationUnit === "minutes"
                      ? ` · ${fillMessage(t("clubSessionShortRound"), {
                          minutes: sessionProfile.roundMinutes ?? 10,
                        })}`
                      : ""
                  }`
                : t("clubSessionEyebrow")}
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
                disabled={busy || offline}
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
                disabled={busy || offline}
                onClick={() => setDeletePrompt((open) => !open)}
              >
                {t("clubSessionDelete")}
              </Button>
            </div>
          ) : null}
        </header>

        {offline ? (
          <div
            className="mb-5 rounded-lg border-2 border-line-strong bg-surface p-4 text-sm font-semibold leading-6 text-ink"
            role="status"
            aria-live="polite"
          >
            {t("clubSessionOffline")}
          </div>
        ) : null}

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
            <AuthProviderButtons
              disabled={offline}
              fallbackSignIn={signInWithGoogle}
              providers={authProviders}
              signInWithProvider={signInWithProvider}
            />
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
                      disabled={busy || offline}
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
              <div className="mb-6 grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-line-strong bg-surface px-4 py-3">
                  <p className="m-0 text-xs font-bold uppercase tracking-wide text-text-muted">
                    {t("clubSessionDate")}
                  </p>
                  <p className="mb-0 mt-1 font-extrabold text-ink">
                    {formatDateOnly(session.session_date, locale)}
                  </p>
                </div>
                <div className="rounded-lg border border-line-strong bg-surface px-4 py-3">
                  <p className="m-0 text-xs font-bold uppercase tracking-wide text-text-muted">
                    {t("clubSessionSchedule")}
                  </p>
                  <p className="mb-0 mt-1 font-extrabold text-ink">
                    {session.start_time
                      ? `${formatClockTime(session.start_time, locale)} · ${session.time_zone ?? "UTC"}`
                      : t("clubSessionTimeNotSet")}
                  </p>
                  {session.location_name ? (
                    <p className="mb-0 mt-1 text-xs font-semibold text-text-muted">
                      {session.location_name}
                    </p>
                  ) : null}
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
                      className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_7rem_auto]"
                      onSubmit={(event) => void addPlayer(event)}
                    >
                      <Label className={fieldClass} htmlFor="club-player-name">
                        <span>{t("clubSessionPlayerName")}</span>
                        <Input
                          id="club-player-name"
                          value={playerName}
                          maxLength={30}
                          placeholder={t("clubSessionPlayerPlaceholder")}
                          onChange={(event) =>
                            setPlayerName(event.target.value)
                          }
                          required
                        />
                      </Label>
                      <Label className={fieldClass}>
                        <span>{t("clubSessionPlayerGender")}</span>
                        <SelectControl
                          value={playerGender}
                          onChange={(event) =>
                            setPlayerGender(
                              event.target.value as ClubSessionGender,
                            )
                          }
                        >
                          <option value="man">
                            {t("clubSessionGenderMan")}
                          </option>
                          <option value="woman">
                            {t("clubSessionGenderWoman")}
                          </option>
                          <option value="other">
                            {t("clubSessionGenderOther")}
                          </option>
                          <option value="unspecified">
                            {t("clubSessionGenderUnspecified")}
                          </option>
                        </SelectControl>
                      </Label>
                      <Label className={fieldClass}>
                        <span>{t("clubSessionSkillLevel")}</span>
                        <SelectControl
                          value={playerSkillLevel}
                          onChange={(event) =>
                            setPlayerSkillLevel(event.target.value)
                          }
                        >
                          {[1, 2, 3, 4, 5].map((level) => (
                            <option key={level} value={level}>
                              {level}
                            </option>
                          ))}
                        </SelectControl>
                      </Label>
                      <Button
                        className="min-h-11 self-end sm:min-w-28"
                        type="submit"
                        disabled={busy || offline}
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
                            <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-3">
                              <Label className="grid gap-1 text-xs font-bold text-text-muted">
                                <span>{t("clubSessionPlayerGender")}</span>
                                <SelectControl
                                  value={player.gender ?? "unspecified"}
                                  disabled={busy || offline}
                                  aria-label={`${t("clubSessionPlayerGender")}: ${player.display_name}`}
                                  onChange={(event) =>
                                    void updatePlayerProfile(player.id, {
                                      gender: event.target
                                        .value as ClubSessionGender,
                                    })
                                  }
                                >
                                  <option value="man">
                                    {t("clubSessionGenderMan")}
                                  </option>
                                  <option value="woman">
                                    {t("clubSessionGenderWoman")}
                                  </option>
                                  <option value="other">
                                    {t("clubSessionGenderOther")}
                                  </option>
                                  <option value="unspecified">
                                    {t("clubSessionGenderUnspecified")}
                                  </option>
                                </SelectControl>
                              </Label>
                              <Label className="grid gap-1 text-xs font-bold text-text-muted">
                                <span>{t("clubSessionSkillLevel")}</span>
                                <SelectControl
                                  value={String(player.skill_level ?? 3)}
                                  disabled={busy || offline}
                                  aria-label={`${t("clubSessionSkillLevel")}: ${player.display_name}`}
                                  onChange={(event) =>
                                    void updatePlayerProfile(player.id, {
                                      skillLevel: Number(event.target.value),
                                    })
                                  }
                                >
                                  {[1, 2, 3, 4, 5].map((level) => (
                                    <option key={level} value={level}>
                                      {level}
                                    </option>
                                  ))}
                                </SelectControl>
                              </Label>
                              <Label className="grid gap-1 text-xs font-bold text-text-muted">
                                <span>{t("clubSessionAvailability")}</span>
                                <SelectControl
                                  value={player.availability ?? "available"}
                                  disabled={busy || offline}
                                  aria-label={`${t("clubSessionAvailability")}: ${player.display_name}`}
                                  onChange={(event) =>
                                    void updatePlayerProfile(player.id, {
                                      availability: event.target
                                        .value as ClubSessionAvailability,
                                    })
                                  }
                                >
                                  <option value="available">
                                    {t("clubSessionAvailable")}
                                  </option>
                                  <option value="late">
                                    {t("clubSessionLate")}
                                  </option>
                                  <option value="resting">
                                    {t("clubSessionResting")}
                                  </option>
                                  <option value="unavailable">
                                    {t("clubSessionUnavailable")}
                                  </option>
                                </SelectControl>
                              </Label>
                            </div>
                            <details className="w-full rounded-lg border border-line bg-paper px-3 py-2">
                              <summary className="min-h-11 cursor-pointer content-center text-sm font-bold text-ink">
                                {t("clubSessionRotationPreferences")}
                              </summary>
                              <p className="mb-2 mt-1 text-xs leading-5 text-text-muted">
                                {t("clubSessionAvoidPlayersBody")}
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {players
                                  .filter((other) => other.id !== player.id)
                                  .map((other) => {
                                    const checked = (
                                      player.avoid_player_ids ?? []
                                    ).includes(other.id);
                                    return (
                                      <label
                                        className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink"
                                        key={other.id}
                                      >
                                        <input
                                          className="size-5 accent-cobalt"
                                          type="checkbox"
                                          checked={checked}
                                          disabled={busy || offline}
                                          onChange={(event) => {
                                            const next = new Set(
                                              player.avoid_player_ids ?? [],
                                            );
                                            if (event.target.checked) {
                                              next.add(other.id);
                                            } else {
                                              next.delete(other.id);
                                            }
                                            void updatePlayerProfile(
                                              player.id,
                                              {
                                                avoidPlayerIds: [...next],
                                              },
                                            );
                                          }}
                                        />
                                        <span>{other.display_name}</span>
                                      </label>
                                    );
                                  })}
                              </div>
                            </details>
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-11"
                              type="button"
                              disabled={busy || offline}
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
                        disabled={busy || offline}
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
                            disabled={busy || offline}
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

                  <section
                    className={sectionClass}
                    aria-labelledby="club-standings-title"
                  >
                    <div className="mb-4">
                      <h2
                        id="club-standings-title"
                        className="m-0 text-xl font-extrabold text-ink"
                      >
                        {t("clubSessionStandingsTitle")}
                      </h2>
                      <p className="mb-0 mt-1 text-sm leading-6 text-text-muted">
                        {t("clubSessionStandingsBody")}
                      </p>
                    </div>
                    {hasCompletedResults ? (
                      <ol className="m-0 grid list-none gap-2 p-0">
                        {standings.map((standing) => (
                          <li
                            key={standing.playerId}
                            className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-line bg-paper px-3 py-3"
                          >
                            <span className="text-center text-sm font-black text-cobalt-dark">
                              {standing.rank}
                            </span>
                            <div className="min-w-0">
                              <p className="m-0 truncate font-extrabold text-ink">
                                {playerById.get(standing.playerId) ?? "—"}
                              </p>
                              <p className="m-0 mt-1 text-xs font-semibold text-text-muted">
                                {standing.played}{" "}
                                {t("clubSessionStandingRecord")} ·{" "}
                                {standing.won}–{standing.lost}
                              </p>
                            </div>
                            <span className="text-right text-sm font-black tabular-nums text-ink">
                              {standing.winRate}%
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="m-0 rounded-lg bg-paper p-4 text-sm leading-6 text-text-muted">
                        {t("clubSessionStandingEmpty")}
                      </p>
                    )}
                  </section>
                </div>

                <div className="grid gap-5">
                  <section
                    className={sectionClass}
                    aria-labelledby="club-queue-title"
                  >
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h2
                          id="club-queue-title"
                          className="m-0 text-xl font-extrabold text-ink"
                        >
                          {t("clubSessionQueueTitle")}
                        </h2>
                        <p className="mb-0 mt-1 text-sm leading-6 text-text-muted">
                          {t("clubSessionQueueBody")}
                        </p>
                      </div>
                      {session.status === "active" ? (
                        <Button
                          variant="outline"
                          className="min-h-11"
                          type="button"
                          disabled={
                            busy ||
                            offline ||
                            activePlayers.length < requiredPlayersPerMatch ||
                            activeCourts.length === 0
                          }
                          onClick={() => void previewNextCourts()}
                        >
                          {t("clubSessionFillNextCourts")}
                        </Button>
                      ) : null}
                    </div>
                    {session.status === "active" ? (
                      <p className="mb-4 rounded-lg border border-line bg-paper p-3 text-xs leading-5 text-text-muted">
                        {t("clubSessionSmartRotationBody")}
                      </p>
                    ) : null}
                    {mixedFallbackPrompt ? (
                      <div
                        className="mb-4 grid gap-3 rounded-lg border-2 border-orange-700 bg-paper p-3 text-sm leading-6 text-ink"
                        role="alert"
                      >
                        <p className="m-0">
                          {t("clubSessionMixedFallbackRequired")}
                        </p>
                        <Button
                          variant="outline"
                          className="min-h-11 justify-self-start"
                          type="button"
                          disabled={busy || offline}
                          onClick={() => void previewNextCourts(true)}
                        >
                          {t("clubSessionUseOpenFallback")}
                        </Button>
                      </div>
                    ) : null}
                    {rotationPreview ? (
                      <div
                        className="mb-4 grid gap-3 rounded-lg border-2 border-cobalt bg-paper p-3"
                        role="status"
                        aria-live="polite"
                      >
                        <div>
                          <h3 className="m-0 text-base font-extrabold text-ink">
                            {t("clubSessionRotationPreviewTitle")}
                          </h3>
                          <p className="mb-0 mt-1 text-sm leading-6 text-text-muted">
                            {t("clubSessionRotationPreviewBody")}
                          </p>
                          <p className="mb-0 mt-2 text-xs leading-5 text-text-muted">
                            {t("clubSessionRotationWhy")}
                          </p>
                        </div>
                        <ol className="m-0 grid list-none gap-2 p-0">
                          {rotationPreview.matches.map((match, index) => (
                            <li
                              className="grid gap-1 rounded-lg border border-line px-3 py-2"
                              key={`${match.courtId}-${index}`}
                            >
                              <span className="text-xs font-extrabold uppercase tracking-wide text-text-muted">
                                {courtById.get(match.courtId) ??
                                  t("clubSessionCourtName")}
                                {match.isOpenFallback
                                  ? ` · ${t("clubSessionOpenFallback")}`
                                  : ""}
                              </span>
                              <span className="text-sm font-bold text-ink">
                                {match.playerIds
                                  .map(
                                    (playerId) =>
                                      playerById.get(playerId) ?? playerId,
                                  )
                                  .join(" · ")}
                              </span>
                              {match.explanation ? (
                                <div className="grid gap-1 text-xs leading-5 text-text-muted">
                                  <span>
                                    {fillMessage(
                                      t("clubSessionRotationPlayed"),
                                      {
                                        players: match.playerIds
                                          .map(
                                            (playerId, playerIndex) =>
                                              `${playerById.get(playerId) ?? playerId} ${match.explanation!.playerCounts[playerIndex]}`,
                                          )
                                          .join(" · "),
                                      },
                                    )}
                                  </span>
                                  <span>
                                    {fillMessage(
                                      t("clubSessionRotationFairnessGap"),
                                      {
                                        count: match.explanation.fairnessGap,
                                      },
                                    )}
                                    {" · "}
                                    {fillMessage(
                                      t("clubSessionRotationTieBreakers"),
                                      {
                                        avoid: match.explanation.avoidPenalty,
                                        repeat: match.explanation.repeatPenalty,
                                        skill: match.explanation.skillGap,
                                      },
                                    )}
                                  </span>
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="min-h-11"
                            type="button"
                            disabled={busy || offline}
                            onClick={() => void confirmSmartRotation()}
                          >
                            {t("clubSessionConfirmRotation")}
                          </Button>
                          <Button
                            variant="outline"
                            className="min-h-11"
                            type="button"
                            disabled={busy}
                            onClick={rejectSmartRotation}
                          >
                            {t("clubSessionRejectRotation")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    {session.status === "active" ? (
                      <form
                        className="grid gap-3 rounded-lg border border-line bg-paper p-3"
                        onSubmit={(event) => void addQueuedMatch(event)}
                      >
                        <Label className={fieldClass}>
                          <span>{t("clubSessionCourtName")}</span>
                          <SelectControl
                            aria-label={t("clubSessionSelectCourt")}
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
                            <span>{queuePlayerLabel(index)}</span>
                            <SelectControl
                              aria-label={queuePlayerLabel(index)}
                              value={selected}
                              disabled={offline}
                              onChange={(event) =>
                                setSelectedPlayers((current) =>
                                  current.map((id, playerIndex) =>
                                    playerIndex === index
                                      ? event.target.value
                                      : id,
                                  ),
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
                            offline ||
                            activePlayers.length < requiredPlayersPerMatch ||
                            !activeCourts.length
                          }
                        >
                          {t("clubSessionAddToQueue")}
                        </Button>
                        {activePlayers.length < requiredPlayersPerMatch ||
                        !activeCourts.length ? (
                          <p className="m-0 text-xs leading-5 text-text-muted">
                            {fillMessage(
                              t("clubSessionQueueRequirementsDynamic"),
                              { players: requiredPlayersPerMatch },
                            )}
                          </p>
                        ) : null}
                        {manualFallbackPrompt ? (
                          <div
                            className="grid gap-2 rounded-lg border-2 border-orange-700 p-3 text-sm leading-6 text-ink"
                            role="alert"
                          >
                            <p className="m-0">
                              {t("clubSessionMixedManualFallbackRequired")}
                            </p>
                            <Button
                              variant="outline"
                              className="min-h-11 justify-self-start"
                              type="button"
                              disabled={busy || offline}
                              onClick={() =>
                                void addQueuedMatch(undefined, true)
                              }
                            >
                              {t("clubSessionUseOpenFallback")}
                            </Button>
                          </div>
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
                              {entry.is_open_fallback ? (
                                <span className="rounded-full border border-orange-700 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-orange-800">
                                  {t("clubSessionOpenFallback")}
                                </span>
                              ) : null}
                              {!entry.started_at ? (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="min-h-11 px-2 text-text-muted"
                                  type="button"
                                  disabled={busy || offline}
                                  onClick={() =>
                                    void removeQueuedMatch(entry.id)
                                  }
                                >
                                  {t("remove")}
                                </Button>
                              ) : null}
                            </div>
                            <p className="m-0 text-sm font-bold leading-6 text-ink">
                              {[entry.team_a_player_1, entry.team_a_player_2]
                                .filter((playerId): playerId is string =>
                                  Boolean(playerId),
                                )
                                .map(
                                  (playerId) => playerById.get(playerId) ?? "—",
                                )
                                .join(" + ")}
                              <span className="px-2 text-text-muted">vs</span>
                              {[entry.team_b_player_1, entry.team_b_player_2]
                                .filter((playerId): playerId is string =>
                                  Boolean(playerId),
                                )
                                .map(
                                  (playerId) => playerById.get(playerId) ?? "—",
                                )
                                .join(" + ")}
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
                                  (session.status !== "active" &&
                                    !entry.started_at) ||
                                  (offline && !entry.linked_match_id)
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
                        {t(item.sport)} ·{" "}
                        {formatDateOnly(item.session_date, locale)}
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
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Label className={fieldClass} htmlFor="club-session-time">
                      <span>{t("clubSessionTime")}</span>
                      <Input
                        id="club-session-time"
                        type="time"
                        value={sessionTime}
                        onChange={(event) => setSessionTime(event.target.value)}
                      />
                    </Label>
                    <Label
                      className={fieldClass}
                      htmlFor="club-session-location"
                    >
                      <span>{t("clubSessionLocation")}</span>
                      <Input
                        id="club-session-location"
                        value={sessionLocation}
                        onChange={(event) =>
                          setSessionLocation(event.target.value)
                        }
                        maxLength={120}
                        placeholder={t("clubSessionLocationPlaceholder")}
                      />
                    </Label>
                  </div>
                  <p className="-mt-2 text-xs font-semibold leading-5 text-text-muted">
                    {fillMessage(t("clubSessionTimeZoneHint"), {
                      timeZone:
                        Intl.DateTimeFormat().resolvedOptions().timeZone ||
                        "UTC",
                    })}
                  </p>
                  <Label className={fieldClass} htmlFor="club-session-sport">
                    <span>{t("sport")}</span>
                    <SelectControl
                      id="club-session-sport"
                      aria-label={t("sport")}
                      value={sessionSport}
                      onChange={(event) =>
                        setSessionSport(event.target.value as ClubSessionSport)
                      }
                    >
                      <option value="badminton">{t("badminton")}</option>
                      <option value="pickleball">{t("pickleball")}</option>
                      <option value="tennis">{t("tennis")}</option>
                      <option value="padel">{t("padel")}</option>
                      <option value="table_tennis">{t("table_tennis")}</option>
                      <option value="squash">{t("squash")}</option>
                    </SelectControl>
                  </Label>
                  {clubSessionPlayProfileForSport(sessionSport).format ===
                  "doubles" ? (
                    <Label className={fieldClass}>
                      <span>{t("clubSessionPairingMode")}</span>
                      <SelectControl
                        value={pairingMode}
                        onChange={(event) =>
                          setPairingMode(
                            event.target.value as ClubSessionPairingMode,
                          )
                        }
                      >
                        <option value="open">
                          {t("clubSessionOpenDoubles")}
                        </option>
                        <option value="mixed">
                          {t("clubSessionMixedDoubles")}
                        </option>
                      </SelectControl>
                    </Label>
                  ) : (
                    <div className="rounded-lg border border-line bg-paper p-3 text-sm font-semibold leading-6 text-text-muted">
                      <span className="font-extrabold text-ink">
                        {t("clubSessionPlayProfile")}: {t("singles")}
                      </span>
                      <br />
                      {fillMessage(t("clubSessionSinglesRound"), {
                        players:
                          clubSessionPlayProfileForSport(sessionSport)
                            .playersPerMatch,
                      })}
                      {clubSessionPlayProfileForSport(sessionSport)
                        .roundMinutes ? (
                        <>
                          <br />
                          {fillMessage(t("clubSessionShortRound"), {
                            minutes:
                              clubSessionPlayProfileForSport(sessionSport)
                                .roundMinutes ?? 10,
                          })}
                        </>
                      ) : null}
                    </div>
                  )}
                  <Button
                    className="min-h-11"
                    type="submit"
                    disabled={busy || offline}
                  >
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
