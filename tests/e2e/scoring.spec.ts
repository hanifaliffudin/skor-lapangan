import { expect, test } from "@playwright/test";

test.describe("scorekeeper browser smoke flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();
  });

  const sportSmokeCases = [
    {
      name: "Badminton",
      sport: /Badminton Rally scoring and service/i,
      format: /Singles 1 player per side/i,
      point: /Point for Team A/,
      score: "1",
    },
    {
      name: "Pickleball",
      sport: /Pickleball Service, rallies, and court positions/i,
      format: /Singles 1 player per side/i,
      point: /Rally won by Team A/,
      score: "1",
    },
    {
      name: "Tennis",
      sport: /Tennis Track games, sets, service, and tie-breaks/i,
      format: /Singles 1 player per side/i,
      point: /Tennis point won by Team A/,
      score: "15",
    },
    {
      name: "Padel",
      sport: /Padel Track games, service, receivers, and FIP tie-breaks/i,
      format: /Doubles 2 players per side/i,
      point: /Padel point won by Team A/,
      score: "15",
    },
  ] as const;

  for (const scenario of sportSmokeCases) {
    test(`starts ${scenario.name} and records a point`, async ({ page }) => {
      await page.getByRole("radio", { name: scenario.sport }).click();
      await page.getByRole("radio", { name: scenario.format }).click();
      await page
        .getByRole("button", { name: "Continue to player setup" })
        .click();
      await expect(
        page.getByRole("heading", { name: "Who is playing?" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Start match" }).click();

      const pointForA = page.getByRole("button", { name: scenario.point });
      await expect(pointForA).toBeVisible();
      await pointForA.click();
      await expect(
        page.getByRole("button", { name: "Correct score: Team A" }),
      ).toHaveText(scenario.score);
    });
  }

  test("starts Table tennis singles and restores the score after reload", async ({
    page,
  }) => {
    await page
      .getByRole("radio", { name: /Table tennis Track 11-point games/i })
      .click();
    await page
      .getByRole("radio", { name: /Singles 1 player per side/i })
      .click();
    await page
      .getByRole("button", { name: "Continue to player setup" })
      .click();
    await expect(
      page.getByText("Table tennis format · 2022 ITTF rules"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start match" }).click();

    const pointForA = page.getByRole("button", {
      name: /Table tennis point won by Team A/,
    });
    await expect(pointForA).toBeVisible();
    await pointForA.click();
    await expect(
      page.getByRole("button", { name: "Correct score: Team A" }),
    ).toHaveText("1");

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Correct score: Team A" }),
    ).toHaveText("1");
  });

  test("starts Squash doubles and requires an opening service box", async ({
    page,
  }) => {
    await page
      .getByRole("radio", {
        name: /Squash Track PARS 11, service, receivers, and service boxes/,
      })
      .click();
    await page
      .getByRole("radio", { name: /Doubles 2 players per side/i })
      .click();
    await page
      .getByRole("button", { name: "Continue to player setup" })
      .click();
    await expect(page.getByText("Squash format · WSF rules")).toBeVisible();
    await page.getByRole("combobox", { name: "Opening service box" }).click();
    await page.getByRole("option", { name: "Left box" }).click();
    await page.getByRole("button", { name: "Start match" }).click();

    const pointForB = page.getByRole("button", {
      name: /Squash rally won by Team B/,
    });
    await expect(pointForB).toBeVisible();
    await pointForB.click();
    await expect(pointForB).toBeDisabled();
    await expect(page.getByRole("button", { name: "Right box" })).toBeVisible();
    await page.getByRole("button", { name: "Right box" }).click();
    await expect(pointForB).toBeEnabled();
  });
});
