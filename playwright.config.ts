import { defineConfig, devices } from "@playwright/test";

// Browser e2e tier: chromium project, trace on first retry, screenshot on
// failure. The global setup builds the CLI once; each test then boots its
// own `biac dev` over a temp copy of the shipped `pages/` example on an
// ephemeral port (see dev-server.fixture.ts), so tests never share state
// and hot-reload mutations stay disposable.
//
// Storybook deliberately binds 6175, not the 6006 default — other projects
// on this machine run their own instances there, and one storybook serving
// another project's stories would pass a sweep against the wrong build.
const storybookPort = Number(process.env.BIAC_STORYBOOK_PORT ?? 6175);

export default defineConfig({
  testDir: "./test/e2e-browser",
  outputDir: "./test/e2e-browser/test-results",
  globalSetup: "./test/e2e-browser/global-setup.ts",
  webServer: [
    {
      // storybook-stories.spec.ts sweeps every story against one shared
      // instance — stories are read-only, so workers cannot race it. A
      // developer's already-running Storybook is reused when present.
      // `--ci` keeps the daemon from opening a browser on this desktop.
      command: `pnpm storybook --ci --port ${storybookPort}`,
      url: `http://localhost:${storybookPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
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
