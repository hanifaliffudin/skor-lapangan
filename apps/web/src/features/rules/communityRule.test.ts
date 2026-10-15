import { describe, expect, it } from "vitest";
import { officialRulesetFor } from "@skor-lapangan/scoring-core";
import {
  decodeCommunityRuleConfiguration,
  defaultCommunityRuleConfiguration,
  snapshotForCommunityRule,
} from "./communityRule";

describe("community rule configuration", () => {
  it.each([
    "badminton",
    "pickleball",
    "tennis",
    "padel",
    "table_tennis",
    "squash",
  ] as const)("decodes canonical v2 configuration for %s", (sport) => {
    const configuration = defaultCommunityRuleConfiguration(sport);

    expect(decodeCommunityRuleConfiguration(configuration, sport)).toEqual(
      configuration,
    );
  });

  it.each([
    "badminton",
    "pickleball",
    "tennis",
    "padel",
    "table_tennis",
    "squash",
  ] as const)("wraps legacy flat scoring rules for %s", (sport) => {
    const legacy = officialRulesetFor(sport, "doubles").configuration;

    expect(decodeCommunityRuleConfiguration(legacy, sport)).toEqual({
      ...defaultCommunityRuleConfiguration(sport),
      scoring: legacy,
    });
  });

  it.each([
    ["tennis", "tennis"],
    ["padel", "padel"],
    ["table_tennis", "tableTennis"],
    ["squash", "squash"],
  ] as const)(
    "rejects %s without its sport-specific configuration",
    (sport, section) => {
      const configuration = defaultCommunityRuleConfiguration(sport);
      const malformed = { ...configuration, [section]: undefined };

      expect(decodeCommunityRuleConfiguration(malformed, sport)).toBeNull();
    },
  );

  it.each([
    "badminton",
    "pickleball",
    "tennis",
    "padel",
    "table_tennis",
    "squash",
  ] as const)(
    "snapshots %s singles with one server and opening server one",
    (sport) => {
      const configuration = defaultCommunityRuleConfiguration(sport);
      configuration.scoring.serversPerTurn = 2;
      configuration.scoring.openingServerNumber = 2;

      expect(
        snapshotForCommunityRule(
          {
            id: "rule-1",
            title: `Club ${sport}`,
            sport,
            current_version: 4,
          },
          configuration,
          "singles",
        ),
      ).toMatchObject({
        id: "rule-1",
        source: "community",
        version: 4,
        format: "singles",
        configuration: {
          serversPerTurn: 1,
          openingServerNumber: 1,
        },
      });
    },
  );
});
