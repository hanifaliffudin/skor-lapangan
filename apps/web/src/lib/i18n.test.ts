import { describe, expect, it } from "vitest";
import {
  formatDateOnly,
  formatDateTime,
  formatTime,
  localeDirection,
  localeFromPath,
  localeTag,
  localizedPath,
} from "./i18n";

describe("locale utilities", () => {
  it("keeps the current English default and Indonesian route", () => {
    expect(localeFromPath("/")).toBe("en");
    expect(localeFromPath("/id/history")).toBe("id");
    expect(localizedPath("/history", "id")).toBe("/id/history");
    expect(localizedPath("/id/history", "en")).toBe("/history");
  });

  it("exposes locale metadata for browser and future locale support", () => {
    expect(localeTag("en")).toBe("en-US");
    expect(localeTag("id")).toBe("id-ID");
    expect(localeDirection("en")).toBe("ltr");
  });

  it("formats instant and date-only values with the selected locale", () => {
    expect(formatDateOnly("2026-10-26", "en")).toContain("Oct");
    expect(formatDateOnly("2026-10-26", "id")).toContain("Okt");
    expect(formatDateTime("2026-10-26T09:05:00.000Z", "en")).toContain("2026");
    expect(formatTime("2026-10-26T09:05:00.000Z", "id")).toMatch(/\d/);
  });

  it("does not turn invalid date input into a misleading value", () => {
    expect(formatDateTime("not-a-date", "en")).toBe("");
    expect(formatTime("not-a-date", "id")).toBe("");
    expect(formatDateOnly("not-a-date", "en")).toBe("not-a-date");
  });
});
