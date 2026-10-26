import { expect, test } from "@playwright/test";

const viewerState = {
  matchId: "e2e-offline-viewer-match",
  sport: "badminton",
  format: "singles",
  gameNumber: 1,
  gamesWon: { A: 0, B: 0 },
  points: { A: 7, B: 4 },
  servingTeam: "A",
  currentServer: 0,
  serverNumber: null,
  positions: {
    A: { left: 0, right: 0 },
    B: { left: 0, right: 0 },
  },
  status: "active",
  winner: null,
  completedGames: [],
};

test.describe("Offline Match Continuity browser flows", () => {
  test("keeps a Live Viewer snapshot stale, then refreshes after reconnect", async ({
    page,
    context,
  }) => {
    let refreshCount = 0;
    let allowRefresh = false;

    await page.route("**/auth/v1/**", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "E2E auth stub" }),
      }),
    );
    await page.route("**/rest/v1/rpc/read_live_viewer", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-origin": "*",
          },
        });
        return;
      }

      refreshCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify([
          {
            sport: "badminton",
            status: "active",
            current_state: {
              ...viewerState,
              points: allowRefresh ? { A: 8, B: 4 } : { A: 7, B: 4 },
            },
            updated_at: `2026-10-26T10:0${refreshCount}:00.000Z`,
            expires_at: "2026-10-26T22:00:00.000Z",
          },
        ]),
      });
    });

    await page.goto("/view/e2e-offline-viewer-token");
    await expect(page.getByText(/Live · Badminton/)).toBeVisible();
    await expect(page.getByText("7")).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByText(/Stale · last synced/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Refresh score" }),
    ).toBeVisible();
    await expect(page.getByText("7")).toBeVisible();

    allowRefresh = true;
    await context.setOffline(false);
    await expect(page.getByText("8")).toBeVisible();
    await expect(page.getByText(/Live · Badminton/)).toBeVisible();
    expect(refreshCount).toBeGreaterThanOrEqual(2);
  });

  test("keeps Club Session management unavailable while offline", async ({
    page,
    context,
  }) => {
    await page.goto("/sessions");
    await expect(
      page.getByRole("heading", {
        name: "Club sessions are saved to your account",
      }),
    ).toBeVisible();

    await context.setOffline(true);
    await expect(
      page.getByText(
        "Club session management needs an internet connection. Local matches can still be continued on this device.",
      ),
    ).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByRole("button", { name: "Sign in with Google" }),
    ).toBeDisabled();
  });
});
