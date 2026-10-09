import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { overrideState, type MatchJournal } from "@skor-lapangan/scoring-core";
import { App } from "./App";
import { LocaleProvider } from "./lib/i18n";
import { listGuestMatches, saveMatch } from "./lib/session";

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

const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");

function restoreLocks() {
  if (originalLocks) {
    Object.defineProperty(navigator, "locks", originalLocks);
  } else {
    Reflect.deleteProperty(navigator, "locks");
  }
}

describe("quick start", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    restoreLocks();
  });

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

  it("starts without requiring an account", () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        "Guest matches stay on this device for up to 12 hours after the last activity.",
      ),
    ).toBeVisible();
  });

  it("offers an active match after the tab is reopened on the same device", async () => {
    const user = userEvent.setup();
    const match = completedMatch();
    saveMatch({ definition: match.definition, events: [] });

    render(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Resume match/ }));
    expect(screen.getByRole("heading", { name: "Game 1" })).toBeVisible();
  });

  it("creates a match with a local-only custom rules snapshot", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Continue to player setup" }),
    );
    await user.click(
      screen.getByRole("radio", { name: /Custom rules for this match/ }),
    );
    await user.clear(screen.getByLabelText("Points to win"));
    await user.type(screen.getByLabelText("Points to win"), "15");
    await user.click(screen.getByRole("button", { name: "Start match" }));

    expect(screen.getByText("Custom rules for this match only")).toBeVisible();
    const saved = listGuestMatches()[0]!.definition;
    expect(saved.ruleset?.configuration?.pointsToWin).toBe(15);
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("removes guest rule settings when a custom-rules match completes", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Continue to player setup" }),
    );
    await user.click(
      screen.getByRole("radio", { name: /Custom rules for this match/ }),
    );
    await user.clear(screen.getByLabelText("Points to win"));
    await user.type(screen.getByLabelText("Points to win"), "1");
    await user.clear(screen.getByLabelText("Win by"));
    await user.type(screen.getByLabelText("Win by"), "1");
    await user.selectOptions(screen.getByLabelText("Games per match"), "1");
    await user.click(screen.getByRole("button", { name: "Start match" }));
    await user.click(
      screen.getByRole("button", { name: "+ Point for Team A" }),
    );

    expect(screen.getByText("Match complete")).toBeVisible();
    const saved = listGuestMatches()[0]!;
    expect(saved.definition.ruleset?.source).toBe("guest_custom");
    expect(saved.definition.ruleset?.configuration).toBeUndefined();
    expect(saved.finalState?.status).toBe("complete");
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

  it("enables match controls after a queued tab receives the Web Lock", async () => {
    const user = userEvent.setup();
    const match = completedMatch();
    const activeMatch = { definition: match.definition, events: [] };
    saveMatch(activeMatch);

    let grant: (() => void) | undefined;
    const request = vi.fn(
      (
        _name: string,
        options: LockOptions,
        callback: (lock: Lock) => unknown,
      ) =>
        new Promise<void>((resolve, reject) => {
          const abort = () =>
            reject(new DOMException("The request was aborted", "AbortError"));
          options.signal?.addEventListener("abort", abort, { once: true });
          grant = () => {
            options.signal?.removeEventListener("abort", abort);
            Promise.resolve(callback({} as Lock)).then(() => resolve(), reject);
          };
        }),
    );
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request } as unknown as LockManager,
    });

    render(
      <MemoryRouter initialEntries={[`/match/${match.definition.id}`]}>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    const rallyButton = screen.getByRole("button", {
      name: "+ Point for Team A",
    });
    expect(rallyButton).toBeDisabled();

    await act(async () => {
      grant?.();
    });
    expect(rallyButton).toBeEnabled();

    await user.click(rallyButton);
    expect(
      screen.getByRole("button", { name: "Correct score: Team A" }),
    ).toHaveTextContent("1");
  });
});
