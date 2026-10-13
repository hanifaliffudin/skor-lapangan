import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../lib/i18n";
import { MatchHistoryPage } from "./MatchHistoryPage";

const historyQuery = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  return {
    query,
    from: vi.fn(() => query),
    user: { id: "history-user" },
  };
});

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    user: historyQuery.user,
    isAnonymous: false,
  }),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: { from: historyQuery.from },
}));

describe("Tennis match history", () => {
  beforeEach(() => {
    historyQuery.query.order.mockResolvedValue({
      data: [
        {
          id: "tennis-history-match",
          sport: "tennis",
          status: "active",
          winner: null,
          current_state: {
            sport: "tennis",
            format: "mixed_doubles",
            points: { A: 10, B: 8 },
            gamesWon: { A: 1, B: 0 },
            tennis: {
              setNumber: 3,
              setsWon: { A: 1, B: 0 },
              gamesInSet: { A: 6, B: 6 },
              pointScore: { A: 0, B: 0 },
              advantage: null,
              phase: "match_tiebreak",
              tieBreakScore: { A: 10, B: 8 },
            },
          },
          created_at: "2026-10-12T00:00:00.000Z",
          updated_at: "2026-10-12T01:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  afterEach(cleanup);

  it("renders Tennis sets, games, and a match tie-break in history", async () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <MatchHistoryPage />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Tennis · Mixed doubles/)).toBeVisible();
    expect(screen.getByText("Sets 1–0")).toBeVisible();
    const detailLine = screen.getByText(/Match tie-break: 10–8/);
    expect(detailLine).toHaveTextContent("Games in set: 6–6");
  });

  it("renders the Padel format, set, games, and deciding point", async () => {
    historyQuery.query.order.mockResolvedValue({
      data: [
        {
          id: "padel-history-match",
          sport: "padel",
          status: "active",
          winner: null,
          current_state: {
            sport: "padel",
            format: "mixed_doubles",
            points: { A: 3, B: 3 },
            gamesWon: { A: 1, B: 0 },
            padel: {
              gameScoring: "golden_point",
              setNumber: 2,
              setsWon: { A: 1, B: 0 },
              gamesInSet: { A: 6, B: 6 },
              pointScore: { A: 3, B: 3 },
              advantage: null,
              starDeuces: 0,
              phase: "game",
              tieBreakScore: null,
            },
          },
          created_at: "2026-10-12T00:00:00.000Z",
          updated_at: "2026-10-12T01:00:00.000Z",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter>
        <LocaleProvider>
          <MatchHistoryPage />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Padel · Mixed doubles/)).toBeVisible();
    expect(screen.getByText("Sets 1–0")).toBeVisible();
    expect(screen.getByText(/Games in set: 6–6/)).toBeVisible();
    expect(screen.getByText(/Score: Golden–Golden/)).toBeVisible();
  });

  it("renders Squash games and numeric rally score in history", async () => {
    historyQuery.query.order.mockResolvedValue({
      data: [
        {
          id: "squash-history-match",
          sport: "squash",
          status: "active",
          winner: null,
          current_state: {
            sport: "squash",
            format: "doubles",
            points: { A: 10, B: 8 },
            gamesWon: { A: 1, B: 0 },
          },
          created_at: "2026-10-12T00:00:00.000Z",
          updated_at: "2026-10-12T01:00:00.000Z",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter>
        <LocaleProvider>
          <MatchHistoryPage />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Squash · Doubles/)).toBeVisible();
    expect(screen.getByText("Games won 1–0")).toBeVisible();
    expect(screen.getByText("Game · Score: 10–8")).toBeVisible();
  });

  it("confirms and deletes a match from the account history", async () => {
    const user = userEvent.setup();
    historyQuery.query.order.mockResolvedValue({
      data: [
        {
          id: "deletable-history-match",
          sport: "badminton",
          status: "complete",
          winner: "A",
          current_state: {
            sport: "badminton",
            format: "doubles",
            points: { A: 21, B: 12 },
            gamesWon: { A: 1, B: 0 },
          },
          created_at: "2026-10-12T00:00:00.000Z",
          updated_at: "2026-10-12T01:00:00.000Z",
        },
      ],
      error: null,
    });
    historyQuery.query.eq.mockResolvedValue({ data: [], error: null });

    render(
      <MemoryRouter>
        <LocaleProvider>
          <MatchHistoryPage />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Delete from history" }),
    );
    expect(
      screen.getByRole("button", { name: "Yes, delete match" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Yes, delete match" }));

    expect(historyQuery.query.delete).toHaveBeenCalledTimes(1);
    expect(historyQuery.query.eq).toHaveBeenCalledWith(
      "id",
      "deletable-history-match",
    );
    expect(screen.queryByText(/Badminton · Doubles/)).not.toBeInTheDocument();
  });
});
