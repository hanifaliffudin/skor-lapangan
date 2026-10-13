import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  awardRally,
  createInitialState,
  deriveJournal,
  type MatchDefinition,
  type MatchJournal,
} from "@skor-lapangan/scoring-core";
import { LocaleProvider } from "../../lib/i18n";
import { Court } from "./Court";

const definition: MatchDefinition = {
  id: "court-orientation",
  sport: "pickleball",
  rulesetId: "usap-doubles-sideout-2026",
  mode: "casual",
  createdAt: "2026-10-08T00:00:00.000Z",
  initialServingTeam: "B",
  initialServingPlayer: 0,
  teams: {
    A: {
      name: "Team A",
      players: [
        { id: "a1", name: "A1" },
        { id: "a2", name: "A2" },
      ],
    },
    B: {
      name: "Team B",
      players: [
        { id: "b1", name: "B1" },
        { id: "b2", name: "B2" },
      ],
    },
  },
};

afterEach(cleanup);

describe("court service positions", () => {
  it("mirrors the far team's left and right from the spectator viewpoint", () => {
    const journal: MatchJournal = { definition, events: [] };
    const initialState = createInitialState(definition);
    const afterPoint = deriveJournal(
      awardRally(journal, "B", {
        id: "b-point",
        createdAt: definition.createdAt,
      }),
    ).state;

    const { container, rerender } = render(
      <LocaleProvider>
        <Court definition={definition} state={initialState} />
      </LocaleProvider>,
    );

    const initialSpots = [
      ...container.querySelectorAll('[data-team="B"] [data-side]'),
    ];
    expect(initialSpots.map((spot) => spot.getAttribute("data-side"))).toEqual([
      "right",
      "left",
    ]);
    expect(
      initialSpots.map((spot) => spot.getAttribute("data-serving")),
    ).toEqual(["true", "false"]);

    rerender(
      <LocaleProvider>
        <Court definition={definition} state={afterPoint} />
      </LocaleProvider>,
    );

    const updatedTeamB = container.querySelector('[data-team="B"]')!;
    const spots = [...updatedTeamB.querySelectorAll("[data-side]")];
    expect(spots.map((spot) => spot.getAttribute("data-side"))).toEqual([
      "right",
      "left",
    ]);
    expect(spots.map((spot) => spot.getAttribute("data-serving"))).toEqual([
      "false",
      "true",
    ]);
  });

  it("shows one player per side in singles at the server's service court", () => {
    const singles: MatchDefinition = {
      ...definition,
      id: "singles-court",
      format: "singles",
      rulesetId: "usap-singles-sideout-2026",
      teams: {
        A: { name: "Player A", players: [{ id: "a1", name: "A1" }] },
        B: { name: "Player B", players: [{ id: "b1", name: "B1" }] },
      },
    };
    const state = createInitialState(singles);
    const { container, rerender } = render(
      <LocaleProvider>
        <Court definition={singles} state={state} />
      </LocaleProvider>,
    );

    expect(container.querySelectorAll("[data-side]")).toHaveLength(2);
    expect(
      [...container.querySelectorAll("[data-team] [data-side]")].map((spot) =>
        spot.getAttribute("data-side"),
      ),
    ).toEqual(["right", "right"]);
    expect(screen.queryByText("A2")).not.toBeInTheDocument();
    expect(screen.queryByText("B2")).not.toBeInTheDocument();

    const afterApoint = deriveJournal(
      awardRally({ definition: singles, events: [] }, "B", {
        id: "singles-point",
        createdAt: definition.createdAt,
      }),
    ).state;
    rerender(
      <LocaleProvider>
        <Court definition={singles} state={afterApoint} />
      </LocaleProvider>,
    );
    expect(
      [...container.querySelectorAll("[data-team] [data-side]")].map((spot) =>
        spot.getAttribute("data-side"),
      ),
    ).toEqual(["left", "left"]);
  });

  it("marks the fixed Squash doubles server and receiver positions", () => {
    const squash: MatchDefinition = {
      ...definition,
      id: "squash-court",
      sport: "squash",
      format: "doubles",
      rulesetId: "wsf-squash-doubles-2022",
      initialServingTeam: "A",
      initialServingPlayer: 1,
      squashGameOrders: {
        serviceOrder: { A: [1, 0], B: [0, 1] },
        receiverBySide: {
          A: { left: 0, right: 1 },
          B: { left: 0, right: 1 },
        },
        openingServiceBox: "left",
      },
    };
    const state = createInitialState(squash);

    const { container } = render(
      <LocaleProvider>
        <Court definition={squash} state={state} />
      </LocaleProvider>,
    );

    const servingSpots = [
      ...container.querySelectorAll('[data-team="A"] [data-side]'),
    ];
    expect(
      servingSpots.map((spot) => spot.getAttribute("data-serving")),
    ).toEqual(["true", "false"]);
    expect(servingSpots.map((spot) => spot.textContent)).toEqual(["A2S", "A1"]);

    const receivingSpots = [
      ...container.querySelectorAll('[data-team="B"] [data-side]'),
    ];
    expect(
      receivingSpots.map((spot) => spot.getAttribute("data-receiving")),
    ).toEqual(["false", "true"]);
    expect(receivingSpots.map((spot) => spot.textContent)).toEqual([
      "B2",
      "B1R",
    ]);
  });
});
