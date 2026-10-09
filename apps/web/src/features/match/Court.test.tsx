import { cleanup, render } from "@testing-library/react";
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
});
