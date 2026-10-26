import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { overrideState, type MatchJournal } from "@skor-lapangan/scoring-core";
import { App } from "./App";
import { LocaleProvider } from "./lib/i18n";
import { listGuestMatches, loadMatch, saveMatch } from "./lib/session";
import { ThemeProvider } from "./lib/theme";

async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  optionName: string,
) {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole("option", { name: optionName }));
}

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

function activeMatch(id: string): MatchJournal {
  const match = completedMatch();
  return {
    definition: { ...match.definition, id },
    events: [],
  };
}

const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");

function restoreLocks() {
  if (originalLocks) {
    Object.defineProperty(navigator, "locks", originalLocks);
  } else {
    Reflect.deleteProperty(navigator, "locks");
  }
}

async function renderApp(ui: Parameters<typeof render>[0]) {
  render(<ThemeProvider>{ui}</ThemeProvider>);
  await screen.findByRole("banner", undefined, { timeout: 5000 });
}

describe("quick start", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    restoreLocks();
    vi.restoreAllMocks();
  });

  it("defaults to English and can switch to Indonesian", async () => {
    const user = userEvent.setup();
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Keep score for racket sports",
      }),
    ).toBeVisible();
    expect(
      screen
        .getAllByRole("link", { name: "Community Rules" })
        .every((link) => link.getAttribute("href") === "/rules"),
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "ID" }));
    expect(
      screen.getByRole("heading", {
        name: "Catat skor olahraga raket",
      }),
    ).toBeVisible();
  });

  it("uses the Indonesian locale for its dedicated URL", async () => {
    window.localStorage.setItem("skor-lapangan:locale", "en");
    await renderApp(
      <MemoryRouter initialEntries={["/id/"]}>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Catat skor olahraga raket",
      }),
    ).toBeVisible();
  });

  it("offers mixed doubles and ITF format settings when Tennis is selected", async () => {
    const user = userEvent.setup();
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByText("Tennis"));
    expect(await screen.findByText("Mixed doubles")).toBeVisible();
    await user.click(await screen.findByText("Mixed doubles"));
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    expect(
      await screen.findByText("Tennis format · 2026 ITF rules"),
    ).toBeVisible();
    expect(screen.getAllByText(/Mixed-doubles roles/)).toHaveLength(2);
    await user.click(screen.getByLabelText("Deciding set"));
    expect(
      await screen.findByRole("option", {
        name: "Match tie-break replaces the set",
      }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    const startButton = screen.getByRole("button", { name: "Start match" });
    fireEvent.submit(startButton.closest("form")!);

    const saved = listGuestMatches()[0]!;
    expect(saved.definition).toMatchObject({
      sport: "tennis",
      format: "mixed_doubles",
      ruleset: {
        id: "itf-tennis-2026",
        tennisConfiguration: {
          bestOf: 3,
          gameScoring: "advantage",
          setScoring: "tiebreak",
          finalSetScoring: "tiebreak",
        },
      },
      tennisLocalRoles: { A: ["woman", "man"], B: ["woman", "man"] },
    });
    await user.click(
      await screen.findByRole("button", { name: /Tennis point won by Team A/ }),
    );
    expect(
      screen.getByRole("button", { name: "Correct score: Team A" }),
    ).toHaveTextContent("15");
    expect(listGuestMatches()[0]?.events).toHaveLength(1);
  });

  it("restores the selected sport and format after returning from setup", async () => {
    const user = userEvent.setup();
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByText("Padel"));
    const singles = screen.getByRole("radio", { name: /Club singles/i });
    await user.click(singles);
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    await screen.findByRole("heading", { name: "Who is playing?" });

    await user.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", {
      name: "Keep score for racket sports",
    });

    expect(screen.getByRole("radio", { name: /Padel Track/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("radio", { name: /Club singles/i }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("lets a Community Rules entry point choose the match format", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(
      "skor-lapangan:setup-draft",
      JSON.stringify({
        sport: "tennis",
        format: "doubles",
        mode: "casual",
        communityRuleId: "community-tennis-rule",
      }),
    );

    await renderApp(
      <MemoryRouter initialEntries={["/setup"]}>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    const formatSelect = screen.getByLabelText("Choose match format");
    expect(formatSelect).toHaveTextContent("Doubles");
    await selectOption(user, "Choose match format", "Mixed doubles");

    expect(formatSelect).toHaveTextContent("Mixed doubles");
    expect(
      JSON.parse(window.sessionStorage.getItem("skor-lapangan:setup-draft")!),
    ).toMatchObject({
      format: "mixed_doubles",
      communityRuleId: "community-tennis-rule",
    });
  });

  it("scores a Tennis doubles point with the selected service and receiver order", async () => {
    const user = userEvent.setup();
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("radio", {
        name: "Tennis Track games, sets, service, and tie-breaks",
      }),
    );
    await user.click(
      screen.getByRole("radio", {
        name: "Doubles 2 players per side",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to player setup" }),
    );
    expect(
      await screen.findAllByLabelText("Player who serves first for this team"),
    ).toHaveLength(2);
    expect(
      await screen.findAllByLabelText("Deuce-court receiver"),
    ).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Start match" }));
    await user.click(
      await screen.findByRole("button", {
        name: /Tennis point won by Team B/,
      }),
    );

    expect(
      screen.getByRole("button", { name: "Correct score: Team B" }),
    ).toHaveTextContent("15");
    expect(listGuestMatches()[0]?.events).toHaveLength(1);
    expect(listGuestMatches()[0]?.definition.tennisSetOrders).toMatchObject({
      serviceOrder: { A: [0, 1], B: [0, 1] },
      deuceReceiver: { A: 0, B: 0 },
    });
  });

  it("sets up mixed Padel with FIP options and enforces the deciding receiver", async () => {
    const user = userEvent.setup();
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("radio", {
        name: "Padel Track games, service, receivers, and FIP tie-breaks",
      }),
    );
    await user.click(screen.getByRole("radio", { name: /Mixed doubles/i }));
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    expect(
      await screen.findByText("Padel format · 2026 FIP rules"),
    ).toBeVisible();
    await selectOption(user, "Game scoring", "Golden Point");
    await selectOption(
      user,
      "First two set format",
      "Four-game mini-set · tie-break at 4–4",
    );
    await selectOption(
      user,
      "Deciding set",
      "Match tie-break replaces the set",
    );
    await selectOption(user, "Match tie-break target", "10 points, win by two");
    expect(
      screen.getAllByText(/Mixed receiver-role labels stay on the device/i),
    ).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Start match" }));

    let saved = listGuestMatches()[0]!;
    expect(saved.definition).toMatchObject({
      sport: "padel",
      format: "mixed_doubles",
      ruleset: {
        id: "fip-padel-2026",
        source: "official",
        padelConfiguration: {
          gameScoring: "golden_point",
          setScoring: "mini",
          finalSetScoring: "match_tiebreak",
          matchTieBreakPoints: 10,
        },
      },
      padelLocalRoles: { A: ["woman", "man"], B: ["woman", "man"] },
    });

    for (let index = 0; index < 3; index += 1) {
      await user.click(
        screen.getByRole("button", { name: /Padel point won by Team A/ }),
      );
      await user.click(
        screen.getByRole("button", { name: /Padel point won by Team B/ }),
      );
    }
    expect(screen.getByRole("button", { name: "right" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "left" })).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: /Padel point won by Team B/ }),
    );

    saved = listGuestMatches()[0]!;
    expect(saved.events).toHaveLength(7);
    expect(JSON.stringify(saved.events)).not.toContain("woman");
    expect(saved.events[6]).toMatchObject({ type: "rally_awarded", team: "B" });
  });

  it("labels club Padel singles as a local variant", async () => {
    const user = userEvent.setup();
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("radio", {
        name: "Padel Track games, service, receivers, and FIP tie-breaks",
      }),
    );
    await user.click(
      screen.getByRole("radio", {
        name: "Club singles Local 6 × 20 m variant with FIP-derived scoring",
      }),
    );
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    expect(
      await screen.findByText("Club singles format · local variant"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "FIP does not define singles. This is an unofficial FIP-derived scoring option.",
      ),
    ).toBeVisible();
    fireEvent.submit(
      screen.getByRole("button", { name: "Start match" }).closest("form")!,
    );

    const saved = listGuestMatches()[0]!;
    expect(saved.definition).toMatchObject({
      sport: "padel",
      format: "singles",
      rulesetId: "club-padel-singles-2026",
      ruleset: { source: "local_variant" },
    });
    expect(screen.getByText("Club singles · local variant")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /Padel point won by Team A/ }),
    );
    expect(
      screen.getByRole("button", { name: "Correct score: Team A" }),
    ).toHaveTextContent("15");
  });

  it("starts a keyboard-selected pickleball singles match with the chosen scoring mode", async () => {
    const user = userEvent.setup();
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("radio", {
        name: "Pickleball Service, rallies, and court positions",
      }),
    );
    const singlesFormat = screen.getByRole("radio", {
      name: "Singles 1 player per side",
    });
    singlesFormat.focus();
    await user.keyboard(" ");
    expect(singlesFormat).toBeChecked();
    expect(
      screen.queryByRole("radio", { name: /referee/i }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Continue to player setup" }),
    );

    expect(
      screen.getByRole("heading", { name: "Who is playing?" }),
    ).toBeVisible();
    expect(window.sessionStorage.getItem("skor-lapangan:setup-draft")).toBe(
      JSON.stringify({
        sport: "pickleball",
        format: "singles",
        mode: "casual",
      }),
    );
    expect(screen.getAllByLabelText("Player 1")).toHaveLength(2);
    expect(screen.queryByLabelText("Player 2")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Scoring system")).toHaveTextContent(
      "Standard side-out",
    );

    const [playerA, playerB] = screen.getAllByLabelText("Player 1");
    await user.type(playerA!, "Rina");
    await user.type(playerB!, "Bima");
    await selectOption(user, "Scoring system", "A point on every rally");
    await selectOption(user, "First server", "Bima");
    await user.click(screen.getByRole("button", { name: "Start match" }));

    const match = listGuestMatches()[0]!.definition;
    expect(match.sport).toBe("pickleball");
    expect(match.format).toBe("singles");
    expect(match.teams.A.players).toHaveLength(1);
    expect(match.teams.B.players).toHaveLength(1);
    expect(match.teams.A.players[0]?.name).toBe("Rina");
    expect(match.teams.B.players[0]?.name).toBe("Bima");
    expect(match.initialServingTeam).toBe("B");
    expect(match.ruleset?.id).toBe("usap-singles-rally-2026");
  });

  it("sets up table tennis doubles with best-of-five and order choices", async () => {
    const user = userEvent.setup();
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("radio", {
        name: /Table tennis Track 11-point games/i,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to player setup" }),
    );

    expect(
      screen.getByRole("heading", { name: "Who is playing?" }),
    ).toBeVisible();
    expect(
      screen.getByText("Table tennis format · 2022 ITTF rules"),
    ).toBeVisible();
    expect(screen.getByText("Best of three")).toBeVisible();
    expect(screen.getByLabelText("First receiver")).toBeVisible();

    await selectOption(user, "Games per match", "Best of five");
    await selectOption(user, "Team serving first", "Team B");
    await selectOption(user, "Player serving first", "Player 2");
    await selectOption(user, "First receiver", "Player 2");
    await user.click(screen.getByRole("button", { name: "Start match" }));

    const match = listGuestMatches()[0]!.definition;
    expect(match.sport).toBe("table_tennis");
    expect(match.format).toBe("doubles");
    expect(match.ruleset?.tableTennisConfiguration?.bestOf).toBe(5);
    expect(match.tableTennisOrders).toEqual({
      firstServer: { team: "B", player: 1 },
      firstReceiver: { team: "A", player: 1 },
    });
  });

  it("sets up Squash singles with best-of-three and service-box choice", async () => {
    const user = userEvent.setup();
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("radio", {
        name: "Squash Track PARS 11, service, receivers, and service boxes",
      }),
    );
    await user.click(
      screen.getByRole("radio", { name: "Singles 1 player per side" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to player setup" }),
    );

    expect(await screen.findByText("Squash format · WSF rules")).toBeVisible();
    await selectOption(user, "Games per match", "Best of three");
    await selectOption(user, "Team serving first", "Team B");
    await selectOption(user, "Opening service box", "Left box");
    await selectOption(user, "First server for this team", "Player 1");
    fireEvent.submit(
      screen.getByRole("button", { name: "Start match" }).closest("form")!,
    );

    const saved = listGuestMatches()[0]!;
    expect(saved.definition).toMatchObject({
      sport: "squash",
      format: "singles",
      rulesetId: "wsf-squash-singles-2025",
      ruleset: { squashConfiguration: { bestOf: 3 } },
      initialServingTeam: "B",
      squashGameOrders: {
        serviceOrder: { A: [0, 0], B: [0, 0] },
        receiverBySide: {
          A: { left: 0, right: 0 },
          B: { left: 0, right: 0 },
        },
        openingServiceBox: "left",
      },
    });

    await screen.findByRole("button", { name: /Squash rally won by Team A/ });
    await user.click(
      screen.getByRole("button", { name: /Squash rally won by Team A/ }),
    );
    expect(
      screen.getByRole("button", { name: /Squash rally won by Team A/ }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Right box" }));
    await user.click(
      screen.getByRole("button", { name: /Squash rally won by Team A/ }),
    );

    expect(listGuestMatches()[0]?.events).toHaveLength(3);
    expect(listGuestMatches()[0]?.events[1]).toMatchObject({
      type: "squash_service_box_selected",
      side: "right",
    });
    expect(
      screen.getByRole("button", { name: "Correct score: Team A" }),
    ).toHaveTextContent("2");
  });

  it("opens the Squash doubles order dialog after a completed game", async () => {
    const user = userEvent.setup();
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("radio", {
        name: "Squash Track PARS 11, service, receivers, and service boxes",
      }),
    );
    await user.click(
      screen.getByRole("radio", { name: "Doubles 2 players per side" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to player setup" }),
    );
    await selectOption(user, "Games per match", "Best of three");
    await selectOption(user, "Opening service box", "Left box");
    const firstServers = screen.getAllByLabelText("First server for this team");
    await user.click(firstServers[0]!);
    await user.click(await screen.findByRole("option", { name: "Player 2" }));
    await user.click(firstServers[1]!);
    await user.click(await screen.findByRole("option", { name: "Player 1" }));
    fireEvent.submit(
      screen.getByRole("button", { name: "Start match" }).closest("form")!,
    );
    await screen.findByRole("button", { name: /Squash rally won by Team B/ });

    const pointForTeamB = screen.getByRole("button", {
      name: /Squash rally won by Team B/,
    });
    await user.click(pointForTeamB);
    expect(pointForTeamB).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Right box" }));
    for (let index = 0; index < 10; index += 1) {
      await user.click(pointForTeamB);
    }

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Squash service, receiving, and service-box order",
    );
    expect(dialog).toHaveTextContent("Confirm the next game's order");
    expect(screen.getByLabelText("Opening service box")).toBeVisible();
    expect(
      screen.getAllByLabelText("Receiver from the left side"),
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Start game" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Start game" }));

    const events = listGuestMatches()[0]?.events ?? [];
    expect(events.at(-1)).toMatchObject({
      type: "squash_game_orders_confirmed",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts without requiring an account", async () => {
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        "Guest matches stay on this device. If server sync is available, synced data expires after 12 hours without activity (24-hour maximum).",
      ),
    ).toBeVisible();
  });

  it.each([
    ["/rules", "Community Rules"],
    ["/rules/new", "Sign in to publish a ruleset."],
  ])("opens Community Rules route %s", async (path, heading) => {
    await renderApp(
      <MemoryRouter initialEntries={[path]}>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: heading,
      }),
    ).toBeVisible();
  });

  it.each(["/history", "/id/history"])(
    "opens the match history route %s",
    async (path) => {
      await renderApp(
        <MemoryRouter initialEntries={[path]}>
          <LocaleProvider>
            <App />
          </LocaleProvider>
        </MemoryRouter>,
      );

      expect(
        screen.getByRole("heading", {
          name: path.startsWith("/id/")
            ? "Riwayat pertandingan"
            : "Match history",
        }),
      ).toBeVisible();
      expect(
        screen.getByRole("button", {
          name: path.startsWith("/id/")
            ? "Masuk dengan Google"
            : "Sign in with Google",
        }),
      ).toBeVisible();
    },
  );

  it("offers an active match after the tab is reopened on the same device", async () => {
    const user = userEvent.setup();
    const match = completedMatch();
    saveMatch({ definition: match.definition, events: [] });

    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByRole("heading", { name: "Game 1" })).toBeVisible();
  });

  it("shows match context and keeps the match when the end dialog is canceled", async () => {
    const user = userEvent.setup();
    const id = "active-end-dialog-match";
    saveMatch(activeMatch(id));

    await renderApp(
      <MemoryRouter initialEntries={[`/match/${id}`]}>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Close on this device" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Badminton · Doubles");
    expect(dialog).toHaveTextContent("0:0");
    expect(
      screen.getByRole("heading", {
        name: "Close this match on this device?",
      }),
    ).toBeVisible();
    expect(dialog).toHaveTextContent("The match remains in progress");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(loadMatch(id)).not.toBeNull();
  });

  it("removes the local match only after the end action is confirmed", async () => {
    const user = userEvent.setup();
    const id = "active-confirm-end-match";
    saveMatch(activeMatch(id));

    await renderApp(
      <MemoryRouter initialEntries={[`/match/${id}`]}>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Close on this device" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Close on this device" }),
    );

    expect(loadMatch(id)).toBeNull();
    expect(
      await screen.findByRole("heading", {
        name: "Keep score for racket sports",
      }),
    ).toBeVisible();
  });

  it("keeps the end dialog open and offers a retry when removal fails", async () => {
    const user = userEvent.setup();
    const id = "active-failed-end-match";
    saveMatch(activeMatch(id));
    const removeSpy = vi
      .spyOn(window.localStorage, "removeItem")
      .mockImplementation(() => {
        throw new Error("Storage is unavailable.");
      });

    await renderApp(
      <MemoryRouter initialEntries={[`/match/${id}`]}>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Close on this device" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Close on this device" }),
    );

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The match was not closed. Try again.",
    );
    expect(loadMatch(id)).not.toBeNull();

    removeSpy.mockRestore();
    await user.click(
      screen.getByRole("button", { name: "Close on this device" }),
    );

    expect(loadMatch(id)).toBeNull();
    expect(
      await screen.findByRole("heading", {
        name: "Keep score for racket sports",
      }),
    ).toBeVisible();
  });

  it("shows a temporary status after removing a match from this device", async () => {
    const user = userEvent.setup();
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    const match = completedMatch();
    saveMatch({
      definition: { ...match.definition, id: "active-delete-match" },
      events: [],
    });

    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Delete Badminton/i }));
    await user.click(
      screen.getByRole("button", { name: "Remove from device" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Match removed from this device.",
    );
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 4000);
    const dismissToast = timeoutSpy.mock.calls.find(
      ([, delay]) => delay === 4000,
    )?.[0];
    if (typeof dismissToast === "function") act(() => dismissToast());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("creates a match with a local-only custom rules snapshot", async () => {
    const user = userEvent.setup();
    await renderApp(
      <MemoryRouter>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Continue to player setup" }),
    );
    expect(screen.getByRole("radio", { name: /Official Rules/ })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Custom rules/ })).toBeVisible();
    expect(
      screen.getByRole("radio", { name: /Community Rules/ }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("radio", { name: /Custom rules for this match/ }),
    );
    await user.clear(screen.getByLabelText("Points to win"));
    await user.type(screen.getByLabelText("Points to win"), "15");
    expect(screen.getByLabelText("Points to win")).toHaveValue("15");
    await user.click(screen.getByRole("button", { name: "Start match" }));

    expect(screen.getByText("Custom rules for this match only")).toBeVisible();
    const saved = listGuestMatches()[0]!.definition;
    expect(saved.ruleset?.configuration?.pointsToWin).toBe(15);
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("removes guest rule settings when a custom-rules match completes", async () => {
    const user = userEvent.setup();
    await renderApp(
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
    await selectOption(user, "Games per match", "One game");
    await user.click(screen.getByRole("button", { name: "Start match" }));
    await user.click(
      screen.getByRole("button", { name: "Point for Team A (+1)" }),
    );

    expect(screen.getByText("Match complete")).toBeVisible();
    const saved = listGuestMatches()[0]!;
    expect(saved.definition.ruleset?.source).toBe("guest_custom");
    expect(saved.definition.ruleset?.configuration).toBeUndefined();
    expect(saved.finalState?.status).toBe("complete");
  });

  it("rejects invalid custom scoring values before starting a match", async () => {
    const user = userEvent.setup();
    await renderApp(
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
    await user.type(screen.getByLabelText("Points to win"), "21");
    await user.clear(screen.getByLabelText("Point cap (optional)"));
    await user.type(screen.getByLabelText("Point cap (optional)"), "10");
    const startButton = screen.getByRole("button", { name: "Start match" });
    fireEvent.submit(startButton.closest("form")!);

    expect(
      screen.getByText("The point cap must be at least the target score."),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Who is playing?" }),
    ).toBeVisible();
  });

  it("disables score correction after the match is complete", async () => {
    const match = completedMatch();
    window.sessionStorage.setItem(
      `skor-lapangan:match:${match.definition.id}`,
      JSON.stringify(match),
    );

    await renderApp(
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

    await renderApp(
      <MemoryRouter initialEntries={[`/match/${match.definition.id}`]}>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MemoryRouter>,
    );

    const rallyButton = screen.getByRole("button", {
      name: "Point for Team A (+1)",
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
