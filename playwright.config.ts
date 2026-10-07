import { defineConfig, devices } from "@playwright/test";

const API_PORT = 8788;
const WEB_PORT = 3100;

/**
 * E2E runs against the deterministic fake providers, so it needs no API keys and
 * gives the same result on CI. The dev server is used for the web app because
 * NEXT_PUBLIC_* values are read at runtime there.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
    video: "off"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @homeops/api start",
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        NODE_ENV: "test",
        PORT: String(API_PORT),
        MODEL_PROVIDER: "fake",
        SEARCH_PROVIDER: "fake",
        DB_PATH: "./.data/e2e.db",
        LOG_LEVEL: "silent",
        MCP_AUTH_TOKEN: "e2e-token",
        SEARCH_ENABLED: "true"
      }
    },
    {
      command: "pnpm --filter @homeops/web exec next dev",
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(WEB_PORT),
        NEXT_PUBLIC_API_BASE_URL: `http://localhost:${API_PORT}`,
        NEXT_DIST_DIR: ".next-e2e"
      }
    }
  ]
});
