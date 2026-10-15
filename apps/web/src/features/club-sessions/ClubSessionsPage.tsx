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
import { supabase } from "../../lib/supabase";

type SessionRow = {
  id: string;
  name: string;
  session_date: string;
  status: string;
  created_at: string;
};
type PlayerRow = {
  id: string;
  display_name: string;
  sort_order: number;
  is_active: boolean;
};
type CourtRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};
type SessionMatchRow = {
  id: string;
  match_id: string;
  linked_match_id: string | null;
  court_id: string;
  team_a_player_1: string;
  team_a_player_2: string;
  team_b_player_1: string;
  team_b_player_2: string;
  queue_order: number;
  started_at: string | null;
};
type MatchResultRow = { id: string; status: string; winner: string | null };

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
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [courts, setCourts] = useState<CourtRow[]>([]);
  const [queue, setQueue] = useState<SessionMatchRow[]>([]);
  const [results, setResults] = useState<Record<string, MatchResultRow>>({});
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

  const activePlayers = useMemo(
    () => players.filter((player) => player.is_active),
    [players],
  );
  const activeCourts = useMemo(
    () => courts.filter((court) => court.is_active),
    [courts],
  );

  const loadData = useCallback(async () => {
    if (!supabase || !user || !isAccount) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    if (!sessionId) {
      const { data, error: loadError } = await supabase
        .from("club_sessions")
        .select("id,name,session_date,status,created_at")
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (loadError) {
        setError(t("clubSessionLoadError"));
        setSessions([]);
      } else {
        setSessions(data ?? []);
      }
      setSession(null);
      setPlayers([]);
      setCourts([]);
      setQueue([]);
      setResults({});
      setLoading(false);
      return;
    }

    const [sessionResult, playerResult, courtResult, queueResult] =
      await Promise.all([
        supabase
          .from("club_sessions")
          .select("id,name,session_date,status,created_at")
          .eq("id", sessionId)
          .maybeSingle(),
        supabase
          .from("club_session_players")
          .select("id,display_name,sort_order,is_active")
          .eq("session_id", sessionId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("club_session_courts")
          .select("id,name,sort_order,is_active")
          .eq("session_id", sessionId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("club_session_matches")
          .select(
            "id,match_id,linked_match_id,court_id,team_a_player_1,team_a_player_2,team_b_player_1,team_b_player_2,queue_order,started_at",
          )
          .eq("session_id", sessionId)
          .order("queue_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

    if (
      sessionResult.error ||
      playerResult.error ||
      courtResult.error ||
      queueResult.error ||
      !sessionResult.data
    ) {
      setError(t("clubSessionLoadError"));
      setSession(null);
      setPlayers([]);
      setCourts([]);
      setQueue([]);
      setResults({});
      setLoading(false);
      return;
    }

    const loadedQueue = queueResult.data ?? [];
    const linkedIds = loadedQueue
      .map((entry) => entry.linked_match_id)
      .filter((id): id is string => Boolean(id));
    let loadedResults: Record<string, MatchResultRow> = {};
    if (linkedIds.length) {
      const { data: matchRows } = await supabase
        .from("matches")
        .select("id,status,winner")
        .in("id", linkedIds);
      loadedResults = Object.fromEntries(
        (matchRows ?? []).map((match) => [match.id, match]),
      );
    }

    setSession(sessionResult.data);
    setPlayers(playerResult.data ?? []);
    setCourts(courtResult.data ?? []);
    setQueue(loadedQueue);
    setResults(loadedResults);
    setSelectedCourt((current) =>
      (courtResult.data ?? []).some(
        (court) => court.is_active && court.id === current,
      )
        ? current
        : (courtResult.data?.find((court) => court.is_active)?.id ?? ""),
    );
    setLoading(false);
  }, [isAccount, sessionId, t, user]);

  useEffect(() => {
    setDeletePrompt(false);
    void loadData();
  }, [loadData]);

  useEffect(() => {
    document.title = session
      ? `${session.name} · ${t("clubSessions")}`
      : t("clubSessionsPageTitle");
  }, [session, t]);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !isAccount || busy) return;
    setBusy(true);
    setError("");
    const { data, error: createError } = await supabase
      .from("club_sessions")
      .insert({
        owner_id: user.id,
        name: sessionName.trim(),
        session_date: sessionDate,
      })
      .select("id")
      .single();
    setBusy(false);
    if (createError || !data) {
      setError(t("clubSessionSaveError"));
      return;
    }
    setSessionName("");
    setSessionDate(today());
    navigate(localizedPath(`/sessions/${data.id}`, locale));
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !session || busy) return;
    const displayName = playerName.trim();
    if (!displayName) return;
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase
      .from("club_session_players")
      .insert({
        session_id: session.id,
        owner_id: user.id,
        display_name: displayName,
        sort_order: players.length,
      });
    setBusy(false);
    if (insertError) {
      setError(t("clubSessionSaveError"));
      return;
    }
    setPlayerName("");
    await loadData();
  }

  async function addCourt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !session || busy) return;
    const name = courtName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase
      .from("club_session_courts")
      .insert({
        session_id: session.id,
        owner_id: user.id,
        name,
        sort_order: courts.length,
      });
    setBusy(false);
    if (insertError) {
      setError(t("clubSessionSaveError"));
      return;
    }
    setCourtName("");
    await loadData();
  }

  async function setRosterStatus(
    kind: "player" | "court",
    id: string,
    isActive: boolean,
  ) {
    if (!supabase || !session || busy) return;
    setBusy(true);
    setError("");
    const table =
      kind === "player" ? "club_session_players" : "club_session_courts";
    const { error: updateError } = await supabase
      .from(table)
      .update({ is_active: isActive })
      .eq("id", id)
      .eq("session_id", session.id);
    setBusy(false);
    if (updateError) {
      setError(t("clubSessionSaveError"));
      return;
    }
    await loadData();
  }

  async function addQueuedMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !session || busy) return;
    if (
      !selectedCourt ||
      selectedPlayers.some((id) => !id) ||
      new Set(selectedPlayers).size !== 4
    ) {
      setError(t("clubSessionAssignmentError"));
      return;
    }
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase
      .from("club_session_matches")
      .insert({
        session_id: session.id,
        owner_id: user.id,
        match_id: crypto.randomUUID(),
        court_id: selectedCourt,
        team_a_player_1: selectedPlayers[0],
        team_a_player_2: selectedPlayers[1],
        team_b_player_1: selectedPlayers[2],
        team_b_player_2: selectedPlayers[3],
        queue_order:
          queue.reduce(
            (highest, entry) => Math.max(highest, entry.queue_order),
            -1,
          ) + 1,
      });
    setBusy(false);
    if (insertError) {
      setError(t("clubSessionSaveError"));
      return;
    }
    setSelectedPlayers(["", "", "", ""]);
    await loadData();
  }

  async function removeQueuedMatch(id: string) {
    if (!supabase || !session || busy) return;
    setBusy(true);
    const { error: deleteError } = await supabase
      .from("club_session_matches")
      .delete()
      .eq("id", id)
      .eq("session_id", session.id)
      .is("started_at", null);
    setBusy(false);
    if (deleteError) {
      setError(t("clubSessionSaveError"));
      return;
    }
    await loadData();
  }

  async function toggleSessionStatus() {
    if (!supabase || !session || busy) return;
    setBusy(true);
    const nextStatus = session.status === "active" ? "completed" : "active";
    const { error: updateError } = await supabase
      .from("club_sessions")
      .update({ status: nextStatus })
      .eq("id", session.id);
    setBusy(false);
    if (updateError) {
      setError(t("clubSessionSaveError"));
      return;
    }
    await loadData();
  }

  async function deleteSession() {
    if (!supabase || !session || busy) return;
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase
      .from("club_sessions")
      .delete()
      .eq("id", session.id);
    setBusy(false);
    if (deleteError) {
      setError(t("clubSessionSaveError"));
      setDeletePrompt(false);
      return;
    }
    navigate(localizedPath("/sessions", locale));
  }

  function startMatch(entry: SessionMatchRow) {
    if (!session) return;
    const linkedResult = entry.linked_match_id
      ? results[entry.linked_match_id]
      : null;
    if (linkedResult || entry.started_at) {
      if (entry.linked_match_id) {
        navigate(
          localizedPath(
            `/match/${entry.linked_match_id}?clubSessionId=${session.id}`,
            locale,
          ),
        );
        return;
      }
    }
    saveDraft({ sport: "badminton", format: "doubles", mode: "casual" });
    navigate(
      localizedPath(
        `/setup?clubSessionId=${session.id}&clubMatchId=${entry.match_id}`,
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
    const records = new Map<
      string,
      { played: number; won: number; lost: number }
    >();
    for (const player of players)
      records.set(player.id, { played: 0, won: 0, lost: 0 });
    for (const entry of queue) {
      if (!entry.linked_match_id) continue;
      const result = results[entry.linked_match_id];
      if (!result || result.status !== "complete" || !result.winner) continue;
      const sideA = [entry.team_a_player_1, entry.team_a_player_2];
      const sideB = [entry.team_b_player_1, entry.team_b_player_2];
      for (const playerId of sideA) {
        const record = records.get(playerId);
        if (!record) continue;
        record.played += 1;
        result.winner === "A" ? (record.won += 1) : (record.lost += 1);
      }
      for (const playerId of sideB) {
        const record = records.get(playerId);
        if (!record) continue;
        record.played += 1;
        result.winner === "B" ? (record.won += 1) : (record.lost += 1);
      }
    }
    return records;
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
                                <option key={player.id} value={player.id}>
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
