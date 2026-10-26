import {
  cleanup,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../lib/i18n";
import { ThemeProvider } from "../../lib/theme";
import { ClubSessionsPage } from "./ClubSessionsPage";
import type {
  ClubSessionAdapter,
  ClubSessionDetail,
  ClubSessionMatch,
  ClubSessionPlayer,
  ClubSessionCourt,
  ClubSessionSummary,
} from "./clubSessionManagement";

const auth = vi.hoisted(() => ({
  value: {
    isAnonymous: false,
    loading: false,
    signInWithGoogle: vi.fn(),
    user: { id: "owner-1", email: "owner@example.com" },
  },
}));

const adapterState = vi.hoisted(() => ({
  adapter: null as ClubSessionAdapter | null,
  create: vi.fn(),
}));

vi.mock("../../lib/auth", () => ({
  useAuth: () => auth.value,
}));

vi.mock("./clubSessionSupabaseAdapter", () => ({
  createClubSessionSupabaseAdapter: adapterState.create,
}));

const session: ClubSessionSummary = {
  id: "session-1",
  name: "Saturday doubles",
  session_date: "2026-10-19",
  sport: "badminton",
  status: "active",
  created_at: "2026-10-19T00:00:00.000Z",
};

const players: ClubSessionPlayer[] = [
  { id: "p-1", display_name: "One", sort_order: 0, is_active: true },
  { id: "p-2", display_name: "Two", sort_order: 1, is_active: true },
  { id: "p-3", display_name: "Three", sort_order: 2, is_active: true },
  { id: "p-4", display_name: "Four", sort_order: 3, is_active: true },
];

const courts: ClubSessionCourt[] = [
  { id: "court-1", name: "Court 1", sort_order: 0, is_active: true },
];

const queue: ClubSessionMatch[] = [
  {
    id: "queue-1",
    match_id: "match-1",
    linked_match_id: "match-1",
    court_id: "court-1",
    team_a_player_1: "p-1",
    team_a_player_2: "p-2",
    team_b_player_1: "p-3",
    team_b_player_2: "p-4",
    queue_order: 0,
    started_at: "2026-10-19T10:00:00.000Z",
  },
];

const detail: ClubSessionDetail = {
  session,
  players,
  courts,
  queue,
  results: {
    "match-1": { id: "match-1", status: "complete", winner: "A" },
  },
};

function createAdapter(): ClubSessionAdapter {
  return {
    listSessions: vi.fn().mockResolvedValue([]),
    loadSession: vi.fn().mockResolvedValue(detail),
    createSession: vi.fn().mockResolvedValue({ id: "created-session" }),
    addPlayer: vi.fn().mockResolvedValue(undefined),
    addCourt: vi.fn().mockResolvedValue(undefined),
    setPlayerActive: vi.fn().mockResolvedValue(undefined),
    setCourtActive: vi.fn().mockResolvedValue(undefined),
    updatePlayerProfile: vi.fn().mockResolvedValue(undefined),
    addQueuedMatch: vi.fn().mockResolvedValue(undefined),
    addQueuedMatches: vi.fn().mockResolvedValue(undefined),
    markMatchStarted: vi.fn().mockResolvedValue(undefined),
    removeQueuedMatch: vi.fn().mockResolvedValue(undefined),
    setStatus: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
  };
}

function renderAt(path: string) {
  return rtlRender(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <LocaleProvider>
          <Routes>
            <Route path="/sessions" element={<ClubSessionsPage />} />
            <Route path="/sessions/:sessionId" element={<ClubSessionsPage />} />
            <Route path="/setup" element={<div />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

async function chooseSelect(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  option: string,
) {
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("Club Sessions page", () => {
  beforeEach(() => {
    const adapter = createAdapter();
    adapterState.adapter = adapter;
    adapterState.create.mockReturnValue(adapter);
    auth.value = {
      isAnonymous: false,
      loading: false,
      signInWithGoogle: vi.fn(),
      user: { id: "owner-1", email: "owner@example.com" },
    };
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("asks guests to sign in before exposing the private board", async () => {
    auth.value = {
      isAnonymous: true,
      loading: false,
      signInWithGoogle: vi.fn(),
      user: { id: "guest-1", email: "" },
    };

    renderAt("/sessions");

    expect(
      await screen.findByRole("heading", {
        name: "Club sessions are saved to your account",
      }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toBeVisible();
  });

  it("creates a session from the account board", async () => {
    const user = userEvent.setup();
    const adapter = adapterState.adapter!;
    renderAt("/sessions");

    expect(
      await screen.findByRole("heading", { name: "Your sessions" }),
    ).toBeVisible();
    await user.type(screen.getByLabelText("Session name"), "Friday club");
    await user.click(
      screen.getByRole("button", { name: "Create session board" }),
    );

    expect(adapter.createSession).toHaveBeenCalledWith({
      name: "Friday club",
      sessionDate: expect.any(String),
      startTime: undefined,
      timeZone: expect.any(String),
      locationName: "",
      sport: "badminton",
      playProfile: "badminton_doubles",
      pairingMode: "open",
    });
  });

  it("creates a pickleball doubles session", async () => {
    const user = userEvent.setup();
    const adapter = adapterState.adapter!;
    renderAt("/sessions");

    expect(
      await screen.findByRole("heading", { name: "Your sessions" }),
    ).toBeVisible();
    await user.type(screen.getByLabelText("Session name"), "Sunday pickleball");
    const sportSelect = screen.getByRole("combobox", { name: "Sport" });
    await user.click(sportSelect);
    await waitFor(() =>
      expect(
        within(screen.getByRole("listbox"))
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual([
        "Badminton",
        "Pickleball",
        "Tennis",
        "Padel",
        "Table tennis",
        "Squash",
      ]),
    );
    await user.click(screen.getByText("Pickleball", { exact: true }));
    await user.click(
      screen.getByRole("button", { name: "Create session board" }),
    );

    expect(adapter.createSession).toHaveBeenCalledWith({
      name: "Sunday pickleball",
      sessionDate: expect.any(String),
      startTime: undefined,
      timeZone: expect.any(String),
      locationName: "",
      sport: "pickleball",
      playProfile: "pickleball_doubles",
      pairingMode: "open",
    });
  });

  it("carries pickleball into the scoring setup", async () => {
    const user = userEvent.setup();
    const adapter = adapterState.adapter!;
    vi.mocked(adapter.loadSession).mockResolvedValue({
      ...detail,
      session: { ...session, sport: "pickleball" },
      queue: [{ ...queue[0]!, linked_match_id: null, started_at: null }],
      results: {},
    });

    renderAt("/sessions/session-1");

    await user.click(
      await screen.findByRole("button", { name: "Start scoring" }),
    );

    expect(window.sessionStorage.getItem("skor-lapangan:setup-draft")).toBe(
      JSON.stringify({
        sport: "pickleball",
        format: "doubles",
        mode: "casual",
      }),
    );
  });

  it("uses two-player singles queue entries for a squash session", async () => {
    const user = userEvent.setup();
    const adapter = adapterState.adapter!;
    vi.mocked(adapter.loadSession).mockResolvedValue({
      ...detail,
      session: {
        ...session,
        name: "Tuesday squash",
        sport: "squash",
        play_profile: "squash_singles",
      },
      players: players.slice(0, 2),
      queue: [],
      results: {},
    });

    renderAt("/sessions/session-1");

    expect(
      await screen.findByText("Squash · Singles · 2 players per match"),
    ).toBeVisible();
    expect(
      await screen.findByRole("button", { name: "Fill next courts" }),
    ).not.toBeDisabled();
    await chooseSelect(
      user,
      screen.getByRole("combobox", { name: "Select a court" }),
      "Court 1",
    );
    await chooseSelect(
      user,
      screen.getByRole("combobox", { name: "Team A · Player 1" }),
      "One",
    );
    await chooseSelect(
      user,
      screen.getByRole("combobox", { name: "Team B · Player 1" }),
      "Two",
    );
    await user.click(screen.getByRole("button", { name: "Add to queue" }));

    await waitFor(() =>
      expect(adapter.addQueuedMatch).toHaveBeenCalledWith({
        sessionId: "session-1",
        matchId: expect.any(String),
        courtId: "court-1",
        playerIds: ["p-1", "p-2"],
        queueOrder: 0,
      }),
    );
  });

  it("fills the next free court when the queue is empty", async () => {
    const user = userEvent.setup();
    const adapter = adapterState.adapter!;
    vi.mocked(adapter.loadSession).mockResolvedValue({
      ...detail,
      queue: [],
      results: {},
    });

    renderAt("/sessions/session-1");

    await user.click(
      await screen.findByRole("button", { name: "Fill next courts" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Next rotation proposal" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reject proposal" }));
    expect(adapter.addQueuedMatches).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Fill next courts" }));
    await user.click(screen.getByRole("button", { name: "Confirm rotation" }));

    await waitFor(() =>
      expect(adapter.addQueuedMatches).toHaveBeenCalledWith({
        sessionId: "session-1",
        matches: expect.arrayContaining([
          expect.objectContaining({ courtId: "court-1", queueOrder: 0 }),
        ]),
      }),
    );
    expect(adapter.addQueuedMatches).toHaveBeenCalledTimes(1);
  });

  it("cancels confirmation when the session changed after the preview", async () => {
    const user = userEvent.setup();
    const adapter = adapterState.adapter!;
    const initialDetail = { ...detail, queue: [], results: {} };
    const changedDetail = {
      ...initialDetail,
      players: players.map((player) =>
        player.id === "p-4"
          ? { ...player, availability: "resting" as const }
          : player,
      ),
    };
    vi.mocked(adapter.loadSession)
      .mockResolvedValueOnce(initialDetail)
      .mockResolvedValueOnce(changedDetail)
      .mockResolvedValue(changedDetail);

    renderAt("/sessions/session-1");

    await user.click(
      await screen.findByRole("button", { name: "Fill next courts" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm rotation" }),
    );

    expect(
      await screen.findByText(
        "The session data changed after this proposal was created. The proposal was cancelled; create a new preview to use the latest state.",
      ),
    ).toBeVisible();
    expect(adapter.addQueuedMatches).not.toHaveBeenCalled();
  });

  it("requires confirmation before using open doubles in a mixed session", async () => {
    const user = userEvent.setup();
    const adapter = adapterState.adapter!;
    vi.mocked(adapter.loadSession).mockResolvedValue({
      ...detail,
      session: { ...session, pairing_mode: "mixed" },
      players: players.map((player) => ({
        ...player,
        gender: "unspecified" as const,
      })),
      queue: [],
      results: {},
    });

    renderAt("/sessions/session-1");

    await user.click(
      await screen.findByRole("button", { name: "Fill next courts" }),
    );
    expect(
      (
        await screen.findAllByText(
          "There is no valid mixed-doubles combination among the players ready to play. You can use open doubles for this rotation.",
        )
      )[0],
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Use open doubles this time" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm rotation" }),
    );
    await waitFor(() =>
      expect(adapter.addQueuedMatches).toHaveBeenCalledWith({
        sessionId: "session-1",
        matches: [expect.objectContaining({ isOpenFallback: true })],
      }),
    );
  });

  it("explains that the private board is unavailable offline", async () => {
    const onLine = vi
      .spyOn(window.navigator, "onLine", "get")
      .mockReturnValue(false);
    const adapter = adapterState.adapter!;

    renderAt("/sessions");

    expect(
      await screen.findByText(
        "Club session management needs an internet connection. Local matches can still be continued on this device.",
      ),
    ).toBeVisible();
    expect(adapter.listSessions).not.toHaveBeenCalled();

    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(adapter.listSessions).toHaveBeenCalledTimes(1));

    onLine.mockRestore();
  });

  it("manages roster, courts, session status, and a completed match", async () => {
    const user = userEvent.setup();
    const adapter = adapterState.adapter!;
    renderAt("/sessions/session-1");

    expect(
      await screen.findByRole("heading", { name: "Saturday doubles" }),
    ).toBeVisible();
    expect(screen.getByText("Winner: Team A")).toBeVisible();

    await user.type(screen.getByLabelText("Player name"), "Five");
    await user.click(screen.getByRole("button", { name: "Add player" }));
    expect(adapter.addPlayer).toHaveBeenCalledWith({
      sessionId: "session-1",
      displayName: "Five",
      sortOrder: 4,
      gender: "unspecified",
      skillLevel: 3,
    });

    const availabilitySelect = screen.getByRole("combobox", {
      name: "Availability: One",
    });
    await user.click(availabilitySelect);
    await user.keyboard("r{Enter}");
    await waitFor(() =>
      expect(adapter.updatePlayerProfile).toHaveBeenCalledWith({
        sessionId: "session-1",
        playerId: "p-1",
        availability: "resting",
      }),
    );

    await user.type(screen.getByRole("textbox", { name: "Court" }), "Court 2");
    await user.click(screen.getByRole("button", { name: "Add court" }));
    expect(adapter.addCourt).toHaveBeenCalledWith({
      sessionId: "session-1",
      name: "Court 2",
      sortOrder: 1,
    });

    await user.click(screen.getAllByRole("button", { name: "Deactivate" })[0]!);
    expect(adapter.setPlayerActive).toHaveBeenCalledWith({
      sessionId: "session-1",
      playerId: "p-1",
      isActive: false,
    });

    await user.click(screen.getByRole("button", { name: "Complete session" }));
    expect(adapter.setStatus).toHaveBeenCalledWith({
      sessionId: "session-1",
      status: "completed",
    });
    expect(screen.getByRole("button", { name: "Open score" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Delete session" }));
    expect(
      screen.getByRole("button", { name: "Delete permanently" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    expect(adapter.deleteSession).toHaveBeenCalledWith("session-1");
    expect(
      await screen.findByRole("heading", { name: "Your sessions" }),
    ).toBeVisible();
  });
});
