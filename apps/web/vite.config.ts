import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const hcaptchaDevHost = process.env.HCAPTCHA_DEV_HOST?.trim();
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(projectRoot, "src"),
    },
  },
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
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 55,
        branches: 70,
      },
    },
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
