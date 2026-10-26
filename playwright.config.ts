import { defineConfig } from "@playwright/test";

const usePreview = process.env.E2E_USE_PREVIEW === "1";
const baseURL =
  process.env.E2E_BASE_URL ??
  (usePreview ? "http://127.0.0.1:4173" : "http://127.0.0.1:5173");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  workers: usePreview ? 1 : undefined,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL,
    ...(process.env.CI ? {} : { channel: "chrome" as const }),
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: usePreview
          ? "pnpm build && pnpm --filter @skor-lapangan/web preview -- --host 127.0.0.1"
          : "pnpm dev -- --host 127.0.0.1",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
