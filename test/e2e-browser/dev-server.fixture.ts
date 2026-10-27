import {
  test as base,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDevServer } from "../lib/dev-server.js";
import { copyShippedProject } from "../lib/shipped-project.js";
import {
  describeBlankPage,
  rootIsEmpty,
  trackPageRequests,
} from "./pending-requests.js";

export interface BiacDev {
  /** Base URL of the spawned dev server, e.g. "http://localhost:51234/". */
  url: string;
  /** Temp project dir holding a copy of the shipped example project. */
  projectDir: string;
  /** The server's timestamped log so far — what a file write waits on. */
  log(): readonly string[];
  /**
   * The page's still-unanswered requests, each re-requested from node, plus
   * its errors and the server's log — what a failed test attaches when
   * `#root` is empty.
   */
  blankPageReport(): Promise<string>;
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

/**
 * Live result tables sort from a button in each header cell; a static GFM
 * table has none. Both scroll inside an `overflow-x-auto` div, so that class
 * no longer tells them apart.
 */
export function resultTables(page: Page) {
  return page.locator("table:has(th button)");
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
  await expect(panel).toContainText(caption);
  return panel.locator("tbody tr").first().locator("td").allTextContents();
}

/** `page.url()` keeps percent-encoding; searchParams decodes it. */
export function urlParam(page: { url(): string }, name: string): string | null {
  return new URL(page.url()).searchParams.get(name);
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
 * Every line a worker writes to the console, at any level. duckdb-wasm's
 * worker reports a request it failed to serve with `console.log`, which
 * `collectConsoleErrors` never sees. Wire this before the first `page.goto`.
 *
 * @example
 * const workerLines = collectWorkerConsoleLines(page);
 * // … drive the page …
 * expect(workerLines).toEqual([]);
 */
export function collectWorkerConsoleLines(page: Page): string[] {
  const lines: string[] = [];
  page.on("console", (message) => {
    if (message.worker()) lines.push(`${message.type()}: ${message.text()}`);
  });
  return lines;
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
/**
 * vite's per-request timing, sends and per-module transform/load hooks: the
 * lines that name the last hook a hung module entered.
 */
const VITE_REQUEST_DEBUG = "vite:time,vite:send,vite:transform,vite:load";

/**
 * Test-scoped server: each test gets its own `biac dev` over a fresh copy of
 * the shipped `pages/` example, so the suite exercises what users clone and
 * hot-reload mutations never touch the repo (or leak between tests). A test
 * that fails on a page whose app never mounted gets `blank-page.txt`.
 */
export const test = base.extend<{ biacDev: BiacDev }>({
  biacDev: async ({ page }, use, testInfo) => {
    const projectDir = mkdtempSync(join(tmpdir(), "biac-browser-"));
    copyShippedProject(projectDir);
    const server = await startDevServer(projectDir, {
      DEBUG: VITE_REQUEST_DEBUG,
    });
    const requests = trackPageRequests(page);
    const pageErrors = collectConsoleErrors(page);
    const blankPageReport = () =>
      describeBlankPage(requests, pageErrors, server.log());
    await use({
      url: server.url,
      projectDir,
      log: () => server.log(),
      blankPageReport,
    });
    await attachBlankPageReport(page, testInfo, blankPageReport);
    server.kill();
    rmSync(projectDir, { recursive: true, force: true });
  },
});

/** Runs before the server is killed, so the re-requests still reach it. */
async function attachBlankPageReport(
  page: Page,
  testInfo: TestInfo,
  blankPageReport: () => Promise<string>,
): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) return;
  if (!(await rootIsEmpty(page))) return;
  // Written to disk, not attached as a body: the dot reporter prints a path,
  // and a file under test-results/ outlives the run's terminal output.
  const path = testInfo.outputPath("blank-page.txt");
  writeFileSync(path, await blankPageReport());
  await testInfo.attach("blank-page.txt", { path, contentType: "text/plain" });
}

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
      await expect(alert).toHaveCount(1);
      for (const text of want) await expect(alert).toContainText(text);
      await stands(page);
      expect(errors).toEqual([]);
    });
  }
}

export { expect } from "@playwright/test";
