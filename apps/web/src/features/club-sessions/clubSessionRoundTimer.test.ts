import { describe, expect, it } from "vitest";
import {
  clubSessionRoundRemainingMs,
  formatClubSessionCountdown,
} from "./clubSessionRoundTimerUtils";

describe("Club Session short-round timer", () => {
  it("counts down from the persisted round start and clamps after expiry", () => {
    const startedAt = "2026-10-26T10:00:00.000Z";

    expect(
      clubSessionRoundRemainingMs(
        startedAt,
        10,
        Date.parse("2026-10-26T10:03:12.500Z"),
      ),
    ).toBe(407_500);
    expect(
      clubSessionRoundRemainingMs(
        startedAt,
        10,
        Date.parse("2026-10-26T10:10:01.000Z"),
      ),
    ).toBe(0);
  });

  it("formats a compact countdown for the courtside status", () => {
    expect(formatClubSessionCountdown(8 * 60_000 + 5_000)).toBe("08:05");
    expect(formatClubSessionCountdown(0)).toBe("00:00");
  });

  it("ignores an invalid persisted start time", () => {
    expect(clubSessionRoundRemainingMs("not-a-date", 10, Date.now())).toBe(
      null,
    );
  });
});
