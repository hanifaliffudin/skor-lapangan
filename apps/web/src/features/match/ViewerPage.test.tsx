import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../lib/i18n";
import { ViewerPage } from "./ViewerPage";

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
  });
});
