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

  test("starts Table tennis singles and restores the score after reload", async ({
    page,
  }) => {
    await page
      .getByRole("radio", { name: /Table tennis Track 11-point games/i })
      .click();
    await page
      .getByRole("radio", { name: "Singles · 1 player per side" })
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
    ).toHaveTextContent("1");

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Correct score: Team A" }),
    ).toHaveTextContent("1");
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
      .getByRole("radio", { name: "Doubles · 2 players per side" })
      .click();
    await page
      .getByRole("button", { name: "Continue to player setup" })
      .click();
    await expect(page.getByText("Squash format · WSF rules")).toBeVisible();
    await page
      .getByLabel("Opening service box")
      .selectOption({ label: "Left box" });
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
