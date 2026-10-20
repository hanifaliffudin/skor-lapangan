import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../lib/i18n";
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
    addQueuedMatch: vi.fn().mockResolvedValue(undefined),
    markMatchStarted: vi.fn().mockResolvedValue(undefined),
    removeQueuedMatch: vi.fn().mockResolvedValue(undefined),
    setStatus: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocaleProvider>
        <Routes>
          <Route path="/sessions" element={<ClubSessionsPage />} />
          <Route path="/sessions/:sessionId" element={<ClubSessionsPage />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  );
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
    expect(
      screen.getAllByRole("button", { name: "Sign in with Google" }),
    ).toHaveLength(2);
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
    });
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
    });

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
