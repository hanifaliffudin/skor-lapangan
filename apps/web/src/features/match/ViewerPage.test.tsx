import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../lib/i18n";
import { DisplayModePage, ViewerPage } from "./ViewerPage";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: rpcMock },
  hasSupabaseConfig: false,
}));

const viewerState = {
  matchId: "server-match-uuid",
  sport: "badminton",
  gameNumber: 1,
  gamesWon: { A: 0, B: 0 },
  points: { A: 7, B: 4 },
  servingTeam: "A",
  currentServer: 0,
  serverNumber: null,
  positions: {
    A: { left: 1, right: 0 },
    B: { left: 0, right: 1 },
  },
  status: "active",
  winner: null,
  completedGames: [],
};

const singlesViewerState = {
  ...viewerState,
  format: "singles",
  positions: {
    A: { left: 0, right: 0 },
    B: { left: 0, right: 0 },
  },
};

const mixedTennisViewerState = {
  ...singlesViewerState,
  sport: "tennis",
  format: "mixed_doubles",
  tennisLocalRoles: { A: ["woman", "man"], B: ["man", "woman"] },
  tennis: {
    setNumber: 1,
    setsWon: { A: 0, B: 0 },
    gamesInSet: { A: 0, B: 0 },
    pointScore: { A: 1, B: 2 },
    advantage: null,
    gamePointCount: 3,
    tieBreakScore: null,
    phase: "game",
    courtEndsSwapped: false,
    noAdReceivingSide: null,
  },
};

const mixedPadelViewerState = {
  ...singlesViewerState,
  sport: "padel",
  format: "mixed_doubles",
  padel: {
    gameScoring: "golden_point",
    setNumber: 2,
    setsWon: { A: 1, B: 0 },
    gamesInSet: { A: 6, B: 6 },
    pointScore: { A: 3, B: 3 },
    advantage: null,
    starDeuces: 0,
    gamePointCount: 6,
    tieBreakScore: null,
    phase: "game",
    setOpeningServer: "A",
    setOrders: {
      serviceOrder: { A: [0, 1], B: [1, 0] },
      deuceReceiver: { A: 0, B: 1 },
    },
    serviceTurns: { A: 3, B: 3 },
    tieBreakFirstServer: null,
    tieBreakStartCourtEndsSwapped: false,
    decidingReceivingSide: "left",
    awaitingSetOrders: false,
    courtEndsSwapped: true,
    completedSets: [],
    roleLabels: ["woman", "man"],
  },
  padelLocalRoles: { A: ["woman", "man"], B: ["man", "woman"] },
};

const squashViewerState = {
  ...viewerState,
  sport: "squash",
  format: "doubles",
  points: { A: 10, B: 8 },
  gamesWon: { A: 1, B: 0 },
  servingTeam: "A",
  currentServer: 1,
  serverNumber: 1,
  positions: {
    A: { left: 0, right: 1 },
    B: { left: 0, right: 1 },
  },
  squash: {
    gameOrders: {
      serviceOrder: { A: [1, 0], B: [0, 1] },
      receiverBySide: {
        A: { left: 0, right: 1 },
        B: { left: 0, right: 1 },
      },
      openingServiceBox: "left",
    },
    currentServiceBox: "left",
    serviceBoxChoiceRequired: false,
    awaitingGameOrders: false,
    serviceRotationStartTeam: "A",
    serviceRotationIndex: 0,
  },
};

describe("live viewer", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });
  afterEach(cleanup);

  it("shows only the public score and generic court positions", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          sport: "badminton",
          status: "active",
          current_state: viewerState,
          updated_at: "2026-10-09T10:00:00.000Z",
          expires_at: "2026-10-09T22:00:00.000Z",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/view/secret-capability"]}>
        <LocaleProvider>
          <Routes>
            <Route path="/view/:token" element={<ViewerPage />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("7")).toBeVisible());
    expect(screen.getByText("4")).toBeVisible();
    expect(screen.getAllByText("Player 1").length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/server-match-uuid|account|private/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /undo|correct|point for/i }),
    ).not.toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith("read_live_viewer", {
      p_token: "secret-capability",
    });
  });

  it("renders a large display mode with a fullscreen control", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          sport: "badminton",
          status: "active",
          current_state: viewerState,
          updated_at: "2026-10-09T10:00:00.000Z",
          expires_at: "2026-10-09T22:00:00.000Z",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/display/secret-capability"]}>
        <LocaleProvider>
          <Routes>
            <Route path="/display/:token" element={<DisplayModePage />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Display mode")).toBeVisible();
    expect(screen.getByRole("button", { name: "Full screen" })).toBeVisible();
    expect(screen.getByText("7")).toBeVisible();
  });

  it("shows the selected format and one generic player per side", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          sport: "badminton",
          status: "active",
          current_state: singlesViewerState,
          updated_at: "2026-10-09T10:00:00.000Z",
          expires_at: "2026-10-09T22:00:00.000Z",
        },
      ],
      error: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/view/singles-capability"]}>
        <LocaleProvider>
          <Routes>
            <Route path="/view/:token" element={<ViewerPage />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Badminton · Singles/)).toBeVisible();
    expect(container.querySelectorAll("[data-side]")).toHaveLength(2);
    expect(screen.getAllByText("Player 1").length).toBeGreaterThan(0);
    expect(screen.queryByText("Player 2")).not.toBeInTheDocument();
  });

  it("shows mixed Tennis score without exposing local role labels or names", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          sport: "tennis",
          status: "active",
          current_state: mixedTennisViewerState,
          updated_at: "2026-10-09T10:00:00.000Z",
          expires_at: "2026-10-09T22:00:00.000Z",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/view/mixed-capability"]}>
        <LocaleProvider>
          <Routes>
            <Route path="/view/:token" element={<ViewerPage />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Tennis · Mixed doubles/)).toBeVisible();
    expect(screen.getByText("15")).toBeVisible();
    expect(screen.getByText("30")).toBeVisible();
    expect(
      screen.queryByText(/woman|man|tennisLocalRoles/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/A1|B1|private name/i)).not.toBeInTheDocument();
  });

  it("shows mixed Padel score and court state without local roles or names", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          sport: "padel",
          status: "active",
          current_state: mixedPadelViewerState,
          updated_at: "2026-10-09T10:00:00.000Z",
          expires_at: "2026-10-09T22:00:00.000Z",
        },
      ],
      error: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/view/padel-capability"]}>
        <LocaleProvider>
          <Routes>
            <Route path="/view/:token" element={<ViewerPage />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Padel · Mixed doubles/)).toBeVisible();
    expect(screen.getAllByText("Golden")).toHaveLength(2);
    expect(
      container.querySelector('[data-ends-swapped="true"]'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/woman|man|padelLocalRoles|Private Mixed Player/i),
    ).not.toBeInTheDocument();
  });

  it("shows Squash score, games, service box, and public court markers", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          sport: "squash",
          status: "active",
          current_state: squashViewerState,
          updated_at: "2026-10-09T10:00:00.000Z",
          expires_at: "2026-10-09T22:00:00.000Z",
        },
      ],
      error: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/view/squash-capability"]}>
        <LocaleProvider>
          <Routes>
            <Route path="/view/:token" element={<ViewerPage />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Squash · Doubles/)).toBeVisible();
    expect(screen.getByText("10")).toBeVisible();
    expect(screen.getByText("8")).toBeVisible();
    expect(screen.getAllByText(/Games won/)).toHaveLength(2);
    expect(screen.getByText(/Receiver: Player 1/)).toBeVisible();
    expect(
      container.querySelector('[data-sport="squash"] [data-serving="true"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-sport="squash"] [data-receiving="true"]'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/squashGameOrders|private name/i),
    ).not.toBeInTheDocument();
  });

  it("shows an unavailable state for expired or revoked links", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    render(
      <MemoryRouter initialEntries={["/view/expired-capability"]}>
        <LocaleProvider>
          <Routes>
            <Route path="/view/:token" element={<ViewerPage />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Viewer link unavailable")).toBeVisible();
    expect(screen.getByRole("button", { name: "Back to home" })).toBeVisible();
  });

  it("rejects a public snapshot with negative scores", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          sport: "badminton",
          status: "active",
          current_state: {
            ...viewerState,
            points: { A: -1, B: 4 },
          },
          updated_at: "2026-10-09T10:00:00.000Z",
          expires_at: "2026-10-09T22:00:00.000Z",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/view/invalid-score"]}>
        <LocaleProvider>
          <Routes>
            <Route path="/view/:token" element={<ViewerPage />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Viewer link unavailable")).toBeVisible();
  });

  it("keeps the last server snapshot and marks it stale when the viewer goes offline", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          sport: "badminton",
          status: "active",
          current_state: viewerState,
          updated_at: "2026-10-09T10:00:00.000Z",
          expires_at: "2026-10-09T22:00:00.000Z",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/view/offline-capability"]}>
        <LocaleProvider>
          <Routes>
            <Route path="/view/:token" element={<ViewerPage />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Live · Badminton/)).toBeVisible();
    window.dispatchEvent(new Event("offline"));

    expect(
      await screen.findByText(/stale|last synced|terakhir tersinkron/i),
    ).toBeVisible();
    expect(screen.getByText("7")).toBeVisible();
    expect(screen.getByText("4")).toBeVisible();
    expect(screen.queryByText(/Live · Badminton/)).not.toBeInTheDocument();
  });

  it("refreshes from the server after connectivity returns", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [
          {
            sport: "badminton",
            status: "active",
            current_state: viewerState,
            updated_at: "2026-10-09T10:00:00.000Z",
            expires_at: "2026-10-09T22:00:00.000Z",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            sport: "badminton",
            status: "active",
            current_state: { ...viewerState, points: { A: 8, B: 4 } },
            updated_at: "2026-10-09T10:01:00.000Z",
            expires_at: "2026-10-09T22:00:00.000Z",
          },
        ],
        error: null,
      });

    render(
      <MemoryRouter initialEntries={["/view/reconnect-capability"]}>
        <LocaleProvider>
          <Routes>
            <Route path="/view/:token" element={<ViewerPage />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("7")).toBeVisible();
    window.dispatchEvent(new Event("offline"));
    expect(
      await screen.findByText(/stale|last synced|terakhir tersinkron/i),
    ).toBeVisible();

    window.dispatchEvent(new Event("online"));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("8")).toBeVisible();
    expect(screen.getByText(/Live · Badminton/)).toBeVisible();
  });

  it("renders the server snapshot instead of a different pending local value", async () => {
    window.localStorage.setItem(
      "skor-lapangan:match:server-match-uuid",
      JSON.stringify({ points: { A: 99, B: 98 }, status: "pending" }),
    );
    rpcMock.mockResolvedValue({
      data: [
        {
          sport: "badminton",
          status: "active",
          current_state: viewerState,
          updated_at: "2026-10-09T10:00:00.000Z",
          expires_at: "2026-10-09T22:00:00.000Z",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/view/server-authority"]}>
        <LocaleProvider>
          <Routes>
            <Route path="/view/:token" element={<ViewerPage />} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("7")).toBeVisible();
    expect(screen.getByText("4")).toBeVisible();
    expect(screen.queryByText("99")).not.toBeInTheDocument();
    expect(screen.queryByText("98")).not.toBeInTheDocument();
  });
});
