import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../lib/i18n";
import { ClubSessionRoundTimer } from "./ClubSessionRoundTimer";

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: supabaseState,
}));

function query(data: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return chain;
}

describe("ClubSessionRoundTimer", () => {
  beforeEach(() => {
    supabaseState.from.mockImplementation((table: string) =>
      table === "club_session_matches"
        ? query({ started_at: new Date(Date.now() - 60_000).toISOString() })
        : query({ sport: "table_tennis" }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the configured short round for an active table-tennis match", async () => {
    render(
      <LocaleProvider>
        <ClubSessionRoundTimer
          enabled
          matchId="match-1"
          sessionId="session-1"
        />
      </LocaleProvider>,
    );

    expect(await screen.findByRole("timer")).toHaveTextContent(
      "10-minute round",
    );
    expect(screen.getByRole("timer")).toHaveTextContent("remaining");
  });
});
