import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const hcaptchaDevHost = process.env.HCAPTCHA_DEV_HOST?.trim();

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    setupFiles: "./src/test/setup.ts",
  },
  server: {
    host: hcaptchaDevHost || "127.0.0.1",
    ...(hcaptchaDevHost ? { allowedHosts: [hcaptchaDevHost] } : {}),
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
