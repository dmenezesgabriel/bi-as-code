import { test as base, type Page } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDevServer } from "../lib/dev-server.js";
import { copyShippedProject } from "../lib/shipped-project.js";

export interface BiacDev {
  /** Base URL of the spawned dev server, e.g. "http://localhost:51234/". */
  url: string;
  /** Temp project dir holding a copy of the shipped example project. */
  projectDir: string;
}

/**
 * Console errors and page errors fail every test — a clean console is part
 * of "renders correctly", not an optional extra. Wire this before the first
 * `page.goto` and assert it empties by the end of the test.
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

/**
 * Test-scoped server: each test gets its own `biac dev` over a fresh copy of
 * the shipped `pages/` example, so the suite exercises what users clone and
 * hot-reload mutations never touch the repo (or leak between tests).
 */
export const test = base.extend<{ biacDev: BiacDev }>({
  // Playwright reads fixture dependencies from the destructured signature —
  // `page` is named only to satisfy that pattern, the eslint ignore covers
  // the unused binding.
  biacDev: async ({ page: _page }, use) => {
    const projectDir = mkdtempSync(join(tmpdir(), "biac-browser-"));
    copyShippedProject(projectDir);
    const server = await startDevServer(projectDir);
    await use({ url: server.url, projectDir });
    server.kill();
    rmSync(projectDir, { recursive: true, force: true });
  },
});

export { expect } from "@playwright/test";
