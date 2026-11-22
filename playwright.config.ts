import { defineConfig } from "@playwright/test";

const database = process.env.E2E_DATABASE_URL ?? "postgresql://langkah@127.0.0.1:55432/langkahbelajar_test";
const integrationKey = "e2e-integration-key";

// Uses a browser already on the machine (Edge on Windows) instead of downloading one.
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:4300", channel: process.env.E2E_BROWSER_CHANNEL ?? "msedge" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 375, height: 812 }, hasTouch: true } },
  ],
  webServer: [
    { command: "node apps/provider-sim/dist/server.cjs", url: "http://127.0.0.1:4301/health", env: { PORT: "4301" }, reuseExistingServer: false },
    {
      command: "node apps/integration/dist/server.cjs",
      url: "http://127.0.0.1:4302/health",
      env: { PORT: "4302", INTEGRATION_API_KEY: integrationKey, MATERIAL_PROVIDER_URL: "http://127.0.0.1:4301", ACTIVITY_PROVIDER_URL: "http://127.0.0.1:4301", PROVIDER_TIMEOUT_MS: "800", PROVIDER_RETRIES: "0", CACHE_TTL_MINUTES: "0.001" },
      reuseExistingServer: false,
    },
    {
      command: "npx prisma migrate deploy && node dist/server.cjs",
      cwd: "apps/api",
      url: "http://127.0.0.1:4300/api/health",
      env: { NODE_ENV: "production", PORT: "4300", DATABASE_URL: database, COOKIE_SECURE: "false", AUTH_RATE_LIMIT_MAX: "1000", INTEGRATION_URL: "http://127.0.0.1:4302", INTEGRATION_API_KEY: integrationKey, INTEGRATION_TIMEOUT_MS: "1500", WEB_DIST: "../web/dist" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
