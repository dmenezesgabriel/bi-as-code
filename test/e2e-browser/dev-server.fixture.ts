import { test as base, expect, type Page } from "@playwright/test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
 * A slider thumb's box — the `slider` role sits on a visually hidden range
 * input inside the thumb, whose own box is not where a pointer grabs.
 */
export async function sliderThumbBox(page: Page, name: string) {
  const box = await page
    .getByRole("slider", { name })
    .locator("..")
    .boundingBox();
  if (!box) throw new Error(`slider thumb "${name}" has no box`);
  return box;
}

/** Live result tables render inside `div.overflow-x-auto`; static gfm tables don't. */
export function resultTables(page: Page) {
  return page.locator("div.overflow-x-auto table");
}

/** The first data row's cells of a live result table. */
export async function firstRowCells(table: ReturnType<typeof resultTables>) {
  return table.locator("tbody tr").first().locator("td").allTextContents();
}

/**
 * Opens the Order-mix Table tab — the <Table> widget's panel is mounted but
 * hidden until selected — and returns its first data row's cells once the
 * panel's pager shows `caption`.
 */
export async function openOrderMixRow(
  page: Page,
  caption: string,
): Promise<string[]> {
  await page.getByRole("tab", { name: "Table" }).click();
  const panel = page.getByRole("tabpanel", { name: "Table" });
  await expect(panel).toContainText(caption, { timeout: 30_000 });
  return panel.locator("tbody tr").first().locator("td").allTextContents();
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
 * Wraps the prototype the duckdb-wasm worker is later constructed against —
 * every query is a worker post, so a client-side interaction that re-queries
 * leaks through `workerPosts`. Call before the first `page.goto`.
 */
export async function instrumentWorkerPosts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const counter = window as unknown as { __workerPosts: number };
    counter.__workerPosts = 0;
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, ...args: unknown[]) {
      counter.__workerPosts++;
      return original.apply(this, args as [unknown]);
    };
  });
}

/** Counts messages posted to the duckdb worker — every query is a post. */
export function workerPosts(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __workerPosts: number }).__workerPosts,
  );
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

/**
 * One author-error mutation: `from` (first occurrence in the page file) is
 * replaced by `to`, and the rendered page must show exactly one
 * `role=alert` carrying every `want` fragment.
 */
export interface BadRefCase {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly want: readonly string[];
}

/**
 * Parametrized bad-reference coverage for `data`/`column`/`x`/`y`/`series`/
 * `fmt` typos: each case rewrites the page file on the test's temp project
 * copy, navigates to `route`, and asserts the alert names the offender
 * while `stands` proves the rest of the page still renders.
 */
export function testBadRefs(
  route: string,
  pageFile: string,
  cases: readonly BadRefCase[],
  stands: (page: Page) => Promise<void>,
): void {
  for (const { name, from, to, want } of cases) {
    test(`${name} renders an inline alert without breaking the page`, async ({
      page,
      biacDev,
    }) => {
      const errors = collectConsoleErrors(page);
      const file = join(biacDev.projectDir, pageFile);
      writeFileSync(file, readFileSync(file, "utf8").replace(from, to));
      await page.goto(`${biacDev.url}${route}`);

      const alert = page.getByRole("alert");
      await expect(alert).toHaveCount(1, { timeout: 30_000 });
      for (const text of want) await expect(alert).toContainText(text);
      await stands(page);
      expect(errors).toEqual([]);
    });
  }
}

export { expect } from "@playwright/test";
