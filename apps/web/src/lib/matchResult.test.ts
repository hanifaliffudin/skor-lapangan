import { describe, expect, it, vi } from "vitest";
import {
  formatMatchResultShare,
  shareMatchResult,
  type MatchResultSummary,
} from "./matchResult";

const summary = (sport: MatchResultSummary["sport"]): MatchResultSummary => ({
  id: crypto.randomUUID(),
  sport,
  format: sport === "tennis" ? "singles" : "doubles",
  status: "complete",
  winner: "A",
  teamAName: "",
  teamBName: "Team B",
  finalScore: { A: sport === "tennis" || sport === "padel" ? 2 : 21, B: 0 },
  completedAt: "2026-10-26T10:00:00.000Z",
});

describe("match result sharing", () => {
  it.each([
    "badminton",
    "pickleball",
    "tennis",
    "padel",
    "table_tennis",
    "squash",
  ] as const)("formats %s", (sport) => {
    const result = formatMatchResultShare(summary(sport), {
      appName: "Skor Lapangan",
      sport,
      format: "doubles",
      playedAt: "Date",
    });
    expect(result.text).toContain("Skor Lapangan");
    expect(result.text).toContain("Team A");
    expect(result.text).toContain("Team B");
  });

  it("uses native share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    await expect(
      shareMatchResult({ title: "title", text: "text" }, { share }),
    ).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "title", text: "text" });
  });

  it("does not copy after native share cancellation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const error = Object.assign(new Error("cancel"), { name: "AbortError" });
    await expect(
      shareMatchResult(
        { title: "title", text: "text" },
        {
          share: vi.fn().mockRejectedValue(error),
          writeText,
        },
      ),
    ).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to clipboard without native share", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(
      shareMatchResult({ title: "title", text: "text" }, { writeText }),
    ).resolves.toBe("copied");
  });
});
