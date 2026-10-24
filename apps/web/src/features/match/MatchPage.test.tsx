import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { awardRally, type MatchJournal } from "@skor-lapangan/scoring-core";
import { loadMatch, saveMatch } from "../../lib/session";
import { LocaleProvider } from "../../lib/i18n";
import { MatchPage } from "./MatchPage";

const { authValue, lifecycle } = vi.hoisted(() => {
  const auth = {
    loading: false,
    action: "idle",
    session: null,
    user: { id: "account-user", email: "player@example.com" },
    isAnonymous: false,
    authError: null,
    authErrorKind: null,
    authNotice: null,
    retryGuestSession: vi.fn(async () => undefined),
    signInWithGoogle: vi.fn(async () => null),
    signOut: vi.fn(async () => true),
    deleteAccount: vi.fn(async () => null),
  };

  const lifecycleValue = {
    loadRemote: vi.fn(),
    watchRemote: vi.fn(() => () => undefined),
    watchSync: vi.fn(() => () => undefined),
    synchronize: vi.fn(),
    finish: vi.fn(),
    pollRemote: vi.fn(),
  };

  return {
    authValue: auth,
    lifecycle: lifecycleValue,
  };
});

const baseJournal: MatchJournal = {
  definition: {
    id: "conflict-match",
    sport: "badminton",
    rulesetId: "bwf-doubles-3x21-2025",
    mode: "casual",
    createdAt: "2026-10-20T00:00:00.000Z",
    initialServingTeam: "A",
    initialServingPlayer: 0,
    teams: {
      A: {
        name: "Team A",
        players: [
          { id: "a-1", name: "A1" },
          { id: "a-2", name: "A2" },
        ],
      },
      B: {
        name: "Team B",
        players: [
          { id: "b-1", name: "B1" },
          { id: "b-2", name: "B2" },
        ],
      },
    },
  },
  events: [],
};

const localJournal = awardRally(baseJournal, "A", {
  id: "local-event",
  createdAt: "2026-10-20T00:01:00.000Z",
});
const remoteJournal = awardRally(baseJournal, "B", {
  id: "remote-event",
  createdAt: "2026-10-20T00:01:00.000Z",
});

vi.mock("../../lib/auth", () => ({
  useAuth: () => authValue,
}));

vi.mock("../../lib/auth-context", () => ({
  useAuth: () => authValue,
}));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock("../../lib/sync", () => ({
  isLocalOnlyRulesJournal: () => false,
  syncJournal: vi.fn(),
}));

vi.mock("../../lib/match-remote", () => ({
  appendRemoteEvents: vi.fn(),
  journalSequence: () => 0,
  matchHeadHasSameState: vi.fn(),
  readRemoteMatch: vi.fn(),
  readRemoteMatchEventsSince: vi.fn(),
  readRemoteMatchHead: vi.fn(),
}));

vi.mock("./matchLifecycle", () => ({
  createMatchLifecycle: () => lifecycle,
}));

vi.mock("./useMatchControl", () => ({
  useMatchControl: () => ({
    status: "disabled",
    canControl: false,
    controlToken: null,
    retry: vi.fn(),
    takeOver: vi.fn(),
  }),
}));

function renderMatch() {
  return render(
    <MemoryRouter initialEntries={["/match/conflict-match"]}>
      <LocaleProvider>
        <Routes>
          <Route path="/match/:matchId" element={<MatchPage />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  );
}

describe("MatchPage conflict recovery", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    lifecycle.loadRemote.mockClear();
    lifecycle.loadRemote.mockResolvedValue({
      status: "conflict",
      journal: localJournal,
      snapshot: {
        journal: remoteJournal,
        sequence: 1,
        status: "active",
        updatedAt: "2026-10-20T00:02:00.000Z",
      },
    });
    lifecycle.watchRemote.mockClear();
    lifecycle.watchSync.mockClear();
    saveMatch(localJournal, {
      ownerId: "account-user",
      persistent: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lets the operator keep the server version", async () => {
    const user = userEvent.setup();
    renderMatch();

    await user.click(
      await screen.findByRole("button", { name: "Use server version" }),
    );

    await waitFor(() => {
      expect(loadMatch("conflict-match")?.events).toEqual(remoteJournal.events);
    });
    expect(
      screen.queryByRole("button", { name: "Use server version" }),
    ).toBeNull();
    expect(loadMatch("conflict-match")?.definition.id).toBe("conflict-match");
  });

  it("saves the local branch as a new Match and keeps the server version intact", async () => {
    const user = userEvent.setup();
    const randomUuid = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
    renderMatch();

    await user.click(
      await screen.findByRole("button", { name: "Save as a new Match" }),
    );

    await waitFor(() => {
      expect(loadMatch("11111111-1111-4111-8111-111111111111")).not.toBeNull();
    });
    expect(randomUuid).toHaveBeenCalledTimes(2);
    expect(loadMatch("11111111-1111-4111-8111-111111111111")?.events).toEqual(
      localJournal.events.map((event) => ({
        ...event,
        id: "22222222-2222-4222-8222-222222222222",
        matchId: "11111111-1111-4111-8111-111111111111",
      })),
    );
    expect(loadMatch("conflict-match")).toBeNull();
    expect(lifecycle.synchronize).not.toHaveBeenCalled();
  });
});
