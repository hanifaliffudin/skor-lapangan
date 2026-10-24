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

  test("starts a match after the cached shell is taken offline", async ({
    page,
    context,
  }) => {
    const hasActiveServiceWorker = await page.evaluate(() =>
      Boolean(navigator.serviceWorker?.controller),
    );
    test.skip(
      !hasActiveServiceWorker,
      "requires a production preview with an active service worker",
    );

    await context.setOffline(true);
    try {
      await page
        .getByRole("radio", { name: /Badminton Rally scoring and service/i })
        .click();
      await page
        .getByRole("radio", { name: /Singles 1 player per side/i })
        .click();
      await page
        .getByRole("button", { name: "Continue to player setup" })
        .click();
      await expect(
        page.getByRole("heading", { name: "Who is playing?" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Start match" }).click();

      const pointForA = page.getByRole("button", { name: /Point for Team A/ });
      await expect(pointForA).toBeVisible();
      await pointForA.click();
      await expect(
        page.getByRole("button", { name: "Correct score: Team A" }),
      ).toHaveText("1");
    } finally {
      await context.setOffline(false);
    }
  });

  test("restores an accepted score after an offline reload", async ({
    page,
    context,
  }) => {
    const hasActiveServiceWorker = await page.evaluate(() =>
      Boolean(navigator.serviceWorker?.controller),
    );
    test.skip(
      !hasActiveServiceWorker,
      "requires a production preview with an active service worker",
    );

    await page
      .getByRole("radio", { name: /Badminton Rally scoring and service/i })
      .click();
    await page
      .getByRole("radio", { name: /Singles 1 player per side/i })
      .click();
    await page
      .getByRole("button", { name: "Continue to player setup" })
      .click();
    await page.getByRole("button", { name: "Start match" }).click();
    await page.getByRole("button", { name: /Point for Team A/ }).click();
    await expect(
      page.getByRole("button", { name: "Correct score: Team A" }),
    ).toHaveText("1");

    await context.setOffline(true);
    try {
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Correct score: Team A" }),
      ).toHaveText("1");
    } finally {
      await context.setOffline(false);
    }
  });

  test("syncs a guest match after reconnecting", async ({ page, context }) => {
    test.skip(
      process.env.E2E_SERVER_SMOKE !== "1",
      "requires E2E_SERVER_SMOKE=1 with Supabase configured",
    );

    await page
      .getByRole("radio", { name: /Badminton Rally scoring and service/i })
      .click();
    await page
      .getByRole("radio", { name: /Singles 1 player per side/i })
      .click();
    await page
      .getByRole("button", { name: "Continue to player setup" })
      .click();
    await page.getByRole("button", { name: "Start match" }).click();

    const pointForA = page.getByRole("button", { name: /Point for Team A/ });
    const scoreForA = page.getByRole("button", {
      name: "Correct score: Team A",
    });
    await expect(pointForA).toBeVisible();
    await pointForA.click();
    await expect(scoreForA).toHaveText("1");
    await expect(page.locator('[data-state="synced"]')).toBeVisible({
      timeout: 20_000,
    });

    await context.setOffline(true);
    try {
      await pointForA.click();
      await expect(scoreForA).toHaveText("2");
      await expect(page.locator('[data-state="offline"]')).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await context.setOffline(false);
    }

    await expect(page.locator('[data-state="synced"]')).toBeVisible({
      timeout: 20_000,
    });
  });

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

    const durableMatches = await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("skor-lapangan");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction("matches", "readonly");
      const request = transaction.objectStore("matches").getAll();
      return new Promise<unknown[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
    expect(durableMatches).toHaveLength(1);
    expect(
      await page.evaluate(() =>
        Object.keys(window.localStorage).some((key) =>
          key.startsWith("skor-lapangan:match:"),
        ),
      ),
    ).toBe(false);

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Correct score: Team A" }),
    ).toHaveText("1");
  });

  test("keeps a single offline Control across tabs", async ({
    page,
    context,
  }) => {
    await page
      .getByRole("radio", { name: /Badminton Rally scoring and service/i })
      .click();
    await page
      .getByRole("radio", { name: /Singles 1 player per side/i })
      .click();
    await page
      .getByRole("button", { name: "Continue to player setup" })
      .click();
    await page.getByRole("button", { name: "Start match" }).click();
    const pointForA = page.getByRole("button", { name: /Point for Team A/ });
    await expect(pointForA).toBeVisible();

    const secondTab = await context.newPage();
    await secondTab.goto(page.url());
    const secondPointForA = secondTab.getByRole("button", {
      name: /Point for Team A/,
    });
    await expect(secondPointForA).toBeVisible();

    await context.setOffline(true);
    await expect(
      secondTab.getByText("Waiting to control this match"),
    ).toBeVisible();
    await expect(secondPointForA).toBeDisabled();
    await expect(pointForA).toBeEnabled();

    await page.close();
    await expect(secondPointForA).toBeEnabled();
    await secondPointForA.click();
    await expect(
      secondTab.getByRole("button", { name: "Correct score: Team A" }),
    ).toHaveText("1");

    await context.setOffline(false);
    await secondTab.close();
  });

  test("completes a match offline and restores the pending result", async ({
    page,
    context,
  }) => {
    await page
      .getByRole("radio", { name: /Badminton Rally scoring and service/i })
      .click();
    await page
      .getByRole("radio", { name: /Singles 1 player per side/i })
      .click();
    await page
      .getByRole("button", { name: "Continue to player setup" })
      .click();
    await page.getByRole("button", { name: "Start match" }).click();
    await expect(
      page.getByRole("button", { name: /Point for Team A/ }),
    ).toBeVisible();

    await context.setOffline(true);
    const pointForA = page.getByRole("button", {
      name: /Point for Team A/,
    });
    const scoreForA = page.getByRole("button", {
      name: "Correct score: Team A",
    });
    for (let point = 0; point < 42; point += 1) {
      await expect(pointForA).toBeVisible();
      await pointForA.click();
      if (point % 21 !== 20) {
        await expect(scoreForA).toHaveText(String((point % 21) + 1));
      }
    }

    await expect(page.getByText("Match complete")).toBeVisible();
    await page.getByRole("button", { name: "Start a new match" }).click();
    await page.getByRole("button", { name: "Go to home" }).click();
    await expect(page.getByText("Pending sync")).toBeVisible();
    await expect(
      page
        .getByText(
          "The final result is saved on this device and will be sent when the connection returns.",
        )
        .first(),
    ).toBeVisible();
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByText("Pending sync")).toBeVisible();
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Open result" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open result" }).click();
    await expect(page.getByText("Match complete")).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByText("Pending sync")).toBeVisible();
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
