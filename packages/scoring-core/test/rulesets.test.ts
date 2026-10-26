import { describe, expect, it } from "vitest";
import {
  findRulesetById,
  listOfficialRulesets,
  listRulesetCatalog,
  officialRulesetSnapshotFor,
} from "../src/rulesets";

describe("ruleset catalog", () => {
  it("exposes source metadata for every catalog entry", () => {
    const catalog = listRulesetCatalog();

    expect(catalog).toHaveLength(11);
    expect(new Set(catalog.map((ruleset) => ruleset.id)).size).toBe(
      catalog.length,
    );
    expect(
      catalog.every((ruleset) => ruleset.sourceUrl && ruleset.checkedAt),
    ).toBe(true);
    expect(findRulesetById("itf-tennis-2026")?.federation).toBe("ITF");
  });

  it("keeps local variants separate from official rulesets", () => {
    expect(listOfficialRulesets()).toHaveLength(10);
    expect(findRulesetById("club-padel-singles-2026")?.source).toBe(
      "local_variant",
    );
  });

  it("preserves metadata when creating a match snapshot", () => {
    const snapshot = officialRulesetSnapshotFor("tennis", "singles");

    expect(snapshot).toMatchObject({
      id: "itf-tennis-2026",
      federation: "ITF",
      sourceUrl: expect.stringContaining("itftennis.com"),
      checkedAt: "2026-10-12",
    });
  });
});
