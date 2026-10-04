import { defineConfig, devices } from "@playwright/test";

// Browser e2e tier: chromium project, trace on first retry, screenshot on
// failure. Each worker boots its own `biac serve` (hosting the built SPA +
// pages fixture) on an ephemeral port and points `baseURL` at it — workers
// never share state, so specs run in parallel.
export default defineConfig({
  testDir: "./test/e2e-browser",
  outputDir: "./test/e2e-browser/test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The line reporter writes a title line on every test start and overwrites
  // it with cursor escapes, which a captured (non-TTY) log keeps as one line
  // per test; dot writes one character per test instead.
  reporter: [["dot"]],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
