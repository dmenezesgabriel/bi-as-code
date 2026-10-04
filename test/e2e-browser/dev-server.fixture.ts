import { test as base } from "@playwright/test";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startDevServer } from "../lib/dev-server.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export interface BiacDev {
  /** Base URL of the spawned dev server, e.g. "http://localhost:51234/". */
  url: string;
  /** Temp project dir holding a copy of the shipped `pages/` example. */
  projectDir: string;
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
    cpSync(join(repoRoot, "pages"), join(projectDir, "pages"), {
      recursive: true,
    });
    const server = await startDevServer(projectDir);
    await use({ url: server.url, projectDir });
    server.kill();
    rmSync(projectDir, { recursive: true, force: true });
  },
});

export { expect } from "@playwright/test";
