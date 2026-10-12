import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const hcaptchaDevHost = process.env.HCAPTCHA_DEV_HOST?.trim();
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(projectRoot, "index.html"),
        indonesian: resolve(projectRoot, "id/index.html"),
      },
    },
  },
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
