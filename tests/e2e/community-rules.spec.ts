import { expect, test } from "@playwright/test";

test.describe("community rules browser flows", () => {
  test("opens the public directory with a sport filter", async ({ page }) => {
    await page.goto("/rules");

    await expect(
      page.getByRole("heading", { name: "Community Rules" }),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Sport" })).toBeVisible();
  });

  test("protects publishing and gives unavailable viewers a way home", async ({
    page,
  }) => {
    await page.goto("/rules/new");
    await expect(
      page.getByRole("heading", {
        name: "Sign in with Google to publish a ruleset.",
      }),
    ).toBeVisible();

    await page.goto("/view/e2e-missing-viewer-token");
    await expect(
      page.getByRole("heading", { name: "Viewer link unavailable" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Back to home" }),
    ).toBeVisible();
  });
});
