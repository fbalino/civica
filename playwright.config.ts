import { defineConfig, devices } from "@playwright/test";

/**
 * QA-009 — canonical Playwright/browser test harness.
 *
 * One command drives the real app: `npm run test:e2e`.
 * - Reuses a running dev server on :3000 (the MCP/preview server or a
 *   locally started `next dev`); starts one if none is up.
 * - Captures console + network failures via the `errors` fixture
 *   (`e2e/harness/fixtures.ts`).
 * - Supports theme (`setTheme`), viewport (`VIEWPORTS`), and admin-auth
 *   (`loginAsAdmin`) fixtures/helpers.
 * - Saves evidence (traces on failure, screenshots on failure, HTML +
 *   JSON reports) under the gitignored `output/playwright/`.
 * - The seeded-failure gate is proven by `e2e/harness.selftest.spec.ts`.
 *
 * Evidence and browsers are gitignored (`/output/`, ms-playwright cache).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Server management. IMPORTANT: never auto-spawn `next dev` here — a second
 * dev server sharing `.next/dev/cache/turbopack` corrupts the running one
 * (missing SST files, "Compaction failed: Another write batch already
 * active"). So:
 *  - Local: assume a dev server is already running at BASE_URL (the one you
 *    already have open). No `webServer` block → Playwright just uses it.
 *  - CI / explicit: set `E2E_WEBSERVER_CMD` (e.g. `npm run start` after a
 *    production build) to have Playwright start and own that server.
 */
const webServer = process.env.E2E_WEBSERVER_CMD
  ? {
      command: process.env.E2E_WEBSERVER_CMD,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "ignore" as const,
      stderr: "pipe" as const,
    }
  : undefined;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./output/playwright/results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/playwright/report", open: "never" }],
    ["json", { outputFile: "output/playwright/results.json" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(webServer ? { webServer } : {}),
});
