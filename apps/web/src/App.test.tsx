import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { overrideState, type MatchJournal } from "@skor-lapangan/scoring-core";
import { App } from "./App";
import { LocaleProvider } from "./lib/i18n";

function completedMatch(): MatchJournal {
  const createdAt = "2026-10-08T00:00:00.000Z";
  let match: MatchJournal = {
    definition: {
      id: "completed-match",
      sport: "badminton",
      rulesetId: "bwf-doubles-3x21-2025",
      mode: "casual",
      createdAt,
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

  match = overrideState(
    match,
    { A: 21, B: 8 },
    {
      id: "game-one",
      createdAt,
    },
  );
  return overrideState(
    match,
    { A: 21, B: 9 },
    {
      id: "game-two",
      createdAt,
    },
  );
}

describe("quick start", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(cleanup);

  it("defaults to English and can switch to Indonesian", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Clear score. Keep the game moving.",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "ID" }));
    expect(
      screen.getByRole("heading", { name: "Skor jelas. Laga tetap jalan." }),
    ).toBeVisible();
  });

  it("restores a saved Indonesian preference", () => {
    window.localStorage.setItem("skor-lapangan:locale", "id");
    render(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Skor jelas. Laga tetap jalan." }),
    ).toBeVisible();
  });

  it("stores the selected local setup before navigation", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("radio", {
        name: "Pickleball Doubles · 3-number score",
      }),
    );
    await user.click(
      screen.getByRole("radio", { name: "Referee More match controls" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to player setup" }),
    );

    expect(
      screen.getByRole("heading", { name: "Who is playing?" }),
    ).toBeVisible();
    expect(window.sessionStorage.getItem("skor-lapangan:setup-draft")).toBe(
      JSON.stringify({ sport: "pickleball", mode: "referee" }),
    );
  });

  it("runs as guest without offering account sign-in", () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        "Guest matches stay in this tab and disappear when the tab is closed.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /google|sign in|login/i }),
    ).not.toBeInTheDocument();
  });

  it("disables score correction after the match is complete", () => {
    const match = completedMatch();
    window.sessionStorage.setItem(
      `skor-lapangan:match:${match.definition.id}`,
      JSON.stringify(match),
    );

    render(
      <MemoryRouter initialEntries={[`/match/${match.definition.id}`]}>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Match complete")).toBeVisible();
    for (const button of screen.getAllByRole("button", {
      name: /Correct score/,
    })) {
      expect(button).toBeDisabled();
    }
  });
});
