import type { Locator, Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PAGE_SWAP_LOGGED_PATH,
  rewriteUntilServerLogs,
} from "../lib/write-until-logged.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { readyCharts } from "./echart-hosts.js";

/** Whether the document root currently carries the `dark` class. */
function isDark(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );
}

/** Opens the index page and returns its site navigation once it has rendered. */
async function openSiteNav(page: Page, url: string): Promise<Locator> {
  await page.goto(url);
  const nav = page.getByRole("navigation", { name: "Site navigation" });
  await expect(nav.getByRole("link", { name: "biac" })).toBeVisible();
  return nav;
}

test("sidebar lists the nav tree in config order and highlights the active route", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const nav = await openSiteNav(page, biacDev.url);
  await expect(
    nav.getByRole("link", { name: "Orders overview" }),
  ).toHaveAttribute("aria-current", "page");

  // pages/nested, titled Breakdowns in biac.config.ts, starts closed on
  // `/` (no active page inside); opening it shows sidebar_position
  // order — Region detail before the alphabetically-earlier Allocation.
  await nav.getByText("Breakdowns").click();
  const dirLinks = nav.locator("details li a");
  await expect(dirLinks).toHaveCount(2);
  expect(await dirLinks.allTextContents()).toEqual([
    "Region detail",
    "Allocation",
  ]);

  await nav.getByRole("link", { name: "Region detail" }).click();
  await expect(page).toHaveURL(/\/nested\/page\/$/);
  await expect(
    nav.getByRole("link", { name: "Region detail" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.getByRole("link", { name: "Orders overview" }),
  ).not.toHaveAttribute("aria-current", "page");
  expect(errors).toEqual([]);
});

test("breadcrumbs follow the nav tree from the current route", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(biacDev.url);

  const crumbs = page.getByRole("navigation", { name: "breadcrumb" });
  await expect(crumbs.getByRole("listitem")).toHaveCount(1);
  await expect(crumbs).toHaveText("Orders overview");
  await expect(crumbs.getByRole("link")).toHaveCount(0);

  await page.goto(`${biacDev.url}nested/page`);
  await expect(crumbs.getByRole("listitem")).toHaveCount(3);
  await expect(crumbs).toHaveText(
    /Orders overview\s*\/\s*Breakdowns\s*\/\s*Region detail/,
  );
  // Only the home crumb navigates: the directory has no route and the
  // leaf is the current page.
  await expect(crumbs.getByRole("link")).toHaveCount(1);
  await expect(crumbs.getByRole("link")).toHaveAttribute("href", "/");
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText(
    "Region detail",
  );
  expect(errors).toEqual([]);
});

test("table of contents lists h2/h3 and tracks scroll position", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const toc = page.getByRole("navigation", { name: "On this page" });
  await expect(toc).toBeVisible();
  await expect(toc.getByRole("link")).toHaveCount(7);
  await expect(toc.locator('[aria-current="location"]')).toHaveText("Overview");

  // The last section is tall enough for its heading to scroll above the
  // viewport center — at max scroll it is the lowest heading over the
  // center line, so it lights.
  await toc.getByRole("link", { name: "Takeaways" }).click();
  await expect(page).toHaveURL(/#takeaways$/);
  await expect(toc.locator('[aria-current="location"]')).toHaveText(
    "Takeaways",
  );

  // Scroll-driven spy: position "Trend lines" just above the center
  // (720px viewport → 350px is inside the top half) — it becomes the
  // current section regardless of surrounding content heights.
  await page.evaluate(() => {
    const el = document.getElementById("trend-lines")!;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 350);
  });
  await expect(toc.locator('[aria-current="location"]')).toHaveText(
    "Trend lines",
  );

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(toc.locator('[aria-current="location"]')).toHaveText("Overview");
  expect(errors).toEqual([]);
});

test("theme toggle persists across reloads and falls back to the OS", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(biacDev.url);
  expect(await isDark(page)).toBe(false);

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect.poll(() => isDark(page)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("biac.theme"))).toBe(
    "dark",
  );

  await page.reload();
  await expect.poll(() => isDark(page)).toBe(true);

  // A fresh profile has no stored choice — it follows the OS.
  await page.evaluate(() => localStorage.clear());
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect.poll(() => isDark(page)).toBe(true);
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect.poll(() => isDark(page)).toBe(false);
  expect(errors).toEqual([]);
});

test("editing biac.config.ts reloads the site title", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const nav = await openSiteNav(page, biacDev.url);

  // A config edit is a full reload. Under load one reload outlasts any short
  // retry, so the file is written only until the server logs it — a later
  // write would restart the reload — and the title is then awaited once.
  const configFile = join(biacDev.projectDir, "biac.config.ts");
  await rewriteUntilServerLogs({
    rewrite: () =>
      writeFileSync(
        configFile,
        'export default { title: "ACME", theme: "system", nav: { sidebar: true } };\n',
      ),
    log: biacDev.log,
    loggedPath: "biac.config.ts",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  await expect(nav.getByRole("link", { name: "ACME" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a biac.config.ts typo shows the located error and fixing it brings the page back", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openSiteNav(page, biacDev.url);
  const configFile = join(biacDev.projectDir, "biac.config.ts");
  const validConfig = readFileSync(configFile, "utf8");
  await rewriteUntilServerLogs({
    rewrite: () =>
      writeFileSync(
        configFile,
        validConfig.replace("{\n", '{\n  pagewidth: "full",\n'),
      ),
    log: biacDev.log,
    loggedPath: "biac.config.ts",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  // A tab loaded while the config is broken gets vite's error page, whose
  // only link back is the HMR socket its overlay script opens.
  await page.reload();
  const overlay = page.locator("vite-error-overlay");
  await expect(overlay.locator(".message")).toContainText(
    "pagewidth: unknown key, expected one of title, theme, nav, sql, interpreters",
  );
  await expect(overlay.locator(".file")).toHaveText(/biac\.config\.ts:2:3$/);
  // The typo's failed module request is the capability under test; only
  // the page the fix brings back must load cleanly.
  const errorsBeforeFix = errors.length;

  // Written once: the first edit after the error is the one that must
  // reload the tab, and a retry would hide an edit the server dropped.
  writeFileSync(configFile, validConfig);
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(overlay).toHaveCount(0);
  expect(errors.slice(errorsBeforeFix)).toEqual([]);
});

test("nav.sidebar:false removes the chrome and the article spans the viewport", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  writeFileSync(
    join(biacDev.projectDir, "biac.config.ts"),
    "export default { nav: { sidebar: false } };\n",
  );
  await page.goto(biacDev.url);

  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Site navigation" }),
  ).toHaveCount(0);
  await expect(page.locator("header")).toHaveCount(0);

  // With the w-72 (288px) sidebar the article starts right of it;
  // chrome-free, it begins well inside that edge.
  const box = await page.locator("main").boundingBox();
  expect(box?.x).toBeLessThan(288);
  expect(errors).toEqual([]);
});

test("front-matter sidebar: false and header: false drop a page's chrome, an edit brings the header back, and a bad value shows its error", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}embed-weekly-revenue`);
  await expect(readyCharts(page)).toHaveCount(1);
  await expect(page.locator("aside, header")).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);

  const file = join(biacDev.projectDir, "pages/embed-weekly-revenue.md");
  const original = readFileSync(file, "utf8");
  const withHeader = (value: string) =>
    original.replace("header: false\n", `header: ${value}\n`);
  writeFileSync(file, withHeader("true"));
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("aside")).toHaveCount(0);

  writeFileSync(file, withHeader("no thanks"));
  await expect(page.getByRole("alert")).toContainText(
    'header: expected a boolean, got "no thanks"',
    { timeout: 20_000 },
  );

  writeFileSync(file, original);
  await expect(readyCharts(page)).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator("aside, header")).toHaveCount(0);
  await page.goto(`${biacDev.url}weekly-review`);
  await expect(page.locator("aside")).toHaveCount(2);
  await expect(page.locator("header")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("front-matter page_width: full widens the page in place, and a bad value shows its error", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${biacDev.url}/weekly-review`);
  const heading = page.getByRole("heading", {
    level: 1,
    name: "Weekly review",
  });
  await expect(heading).toBeVisible();
  const mainWidth = async () =>
    (await page.locator("main").boundingBox())?.width ?? 0;
  // The article column: 1152px outer cap less padding and the ToC rail.
  expect(await mainWidth()).toBe(848);
  // A full reload discards every window property, so the marker surviving
  // the edit proves the page widened in place.
  await page.evaluate(() => {
    (window as unknown as { __probe: string }).__probe = "kept";
  });

  const file = join(biacDev.projectDir, "pages/weekly-review.md");
  const original = readFileSync(file, "utf8");
  const withWidth = (value: string) =>
    original.replace("title: Weekly review\n", `$&page_width: ${value}\n`);
  await rewriteUntilServerLogs({
    rewrite: () => writeFileSync(file, withWidth("full")),
    log: biacDev.log,
    loggedPath: PAGE_SWAP_LOGGED_PATH,
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  await expect.poll(mainWidth).toBeGreaterThan(848);
  await expect(
    page.getByRole("navigation", { name: "On this page" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { __probe?: string }).__probe,
    ),
  ).toBe("kept");

  writeFileSync(file, withWidth("wide"));
  await expect(page.getByRole("alert")).toContainText(
    'page_width: expected "article" | "full", got "wide"',
    { timeout: 20_000 },
  );

  writeFileSync(file, original);
  await expect(heading).toBeVisible({ timeout: 20_000 });
  expect(await mainWidth()).toBe(848);
  expect(errors).toEqual([]);
});

test("biac.config.ts layout.page_width widens every page, a page's front-matter overrides it, and a bad value is located", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const configFile = join(biacDev.projectDir, "biac.config.ts");
  const validConfig = readFileSync(configFile, "utf8");
  const withLayout = (width: string) =>
    validConfig.replace("{\n", `{\n  layout: { page_width: "${width}" },\n`);
  writeFileSync(configFile, withLayout("full"));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${biacDev.url}/weekly-review`);
  const heading = page.getByRole("heading", {
    level: 1,
    name: "Weekly review",
  });
  await expect(heading).toBeVisible();
  const mainWidth = async () =>
    (await page.locator("main").boundingBox())?.width ?? 0;
  // 848px is the article column beside the ToC rail at this viewport.
  expect(await mainWidth()).toBeGreaterThan(848);

  const file = join(biacDev.projectDir, "pages/weekly-review.md");
  const original = readFileSync(file, "utf8");
  await rewriteUntilServerLogs({
    rewrite: () =>
      writeFileSync(
        file,
        original.replace("title: Weekly review\n", "$&page_width: article\n"),
      ),
    log: biacDev.log,
    loggedPath: PAGE_SWAP_LOGGED_PATH,
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  await expect.poll(mainWidth).toBe(848);

  await rewriteUntilServerLogs({
    rewrite: () => writeFileSync(configFile, withLayout("wide")),
    log: biacDev.log,
    loggedPath: "biac.config.ts",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  // The config edit reloads the tab by itself, onto vite's error page; a
  // second reload here would race that navigation and detach the frame.
  await expect(
    page.locator("vite-error-overlay").locator(".message"),
  ).toContainText(
    'layout.page_width: expected "article" | "full", got "wide"',
    {
      timeout: 20_000,
    },
  );
  // The broken config's failed module request is the capability under
  // test; only the page the fix brings back must load cleanly.
  const errorsBeforeFix = errors.length;

  // Written once: the first edit after the error is the one that must
  // reload the tab, and a retry would hide an edit the server dropped.
  writeFileSync(configFile, withLayout("full"));
  await expect(heading).toBeVisible({ timeout: 20_000 });
  expect(await mainWidth()).toBe(848);
  expect(errors.slice(errorsBeforeFix)).toEqual([]);
});

test("biac.config.ts layout.table_of_contents: false hides every rail, a page's front-matter brings its own back, and a bad value shows its error", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const configFile = join(biacDev.projectDir, "biac.config.ts");
  writeFileSync(
    configFile,
    readFileSync(configFile, "utf8").replace(
      "{\n",
      "{\n  layout: { table_of_contents: false },\n",
    ),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${biacDev.url}/weekly-review`);
  const heading = page.getByRole("heading", {
    level: 1,
    name: "Weekly review",
  });
  await expect(heading).toBeVisible();
  const toc = page.getByRole("navigation", { name: "On this page" });
  await expect(toc).toHaveCount(0);

  const file = join(biacDev.projectDir, "pages/weekly-review.md");
  const original = readFileSync(file, "utf8");
  const withToc = (value: string) =>
    original.replace(
      "title: Weekly review\n",
      `$&table_of_contents: ${value}\n`,
    );
  await rewriteUntilServerLogs({
    rewrite: () => writeFileSync(file, withToc("true")),
    log: biacDev.log,
    loggedPath: PAGE_SWAP_LOGGED_PATH,
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  await expect(toc.getByRole("link")).toHaveCount(7, { timeout: 20_000 });

  writeFileSync(file, withToc('"no"'));
  await expect(page.getByRole("alert")).toContainText(
    'table_of_contents: expected a boolean, got "no"',
    { timeout: 20_000 },
  );

  writeFileSync(file, withToc("true"));
  await expect(toc.getByRole("link")).toHaveCount(7, { timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("biac.config.ts layout.table_of_contents_label names every rail, a page's front-matter names its own, and an empty label shows its error", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const configFile = join(biacDev.projectDir, "biac.config.ts");
  writeFileSync(
    configFile,
    readFileSync(configFile, "utf8").replace(
      "{\n",
      '{\n  layout: { table_of_contents_label: "Contents" },\n',
    ),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${biacDev.url}/regional-orders`);
  const contents = page.getByRole("navigation", { name: "Contents" });
  await expect(contents.getByText("Contents", { exact: true })).toBeVisible();
  await page.goto(`${biacDev.url}/weekly-review`);
  await expect(contents.getByRole("link")).toHaveCount(7);

  const file = join(biacDev.projectDir, "pages/weekly-review.md");
  const original = readFileSync(file, "utf8");
  const withLabel = (value: string) =>
    original.replace(
      "title: Weekly review\n",
      `$&table_of_contents_label: ${value}\n`,
    );
  await rewriteUntilServerLogs({
    rewrite: () => writeFileSync(file, withLabel("Summary")),
    log: biacDev.log,
    loggedPath: PAGE_SWAP_LOGGED_PATH,
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  const summary = page.getByRole("navigation", { name: "Summary" });
  await expect(summary.getByText("Summary", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(contents).toHaveCount(0);

  writeFileSync(file, withLabel('""'));
  await expect(page.getByRole("alert")).toContainText(
    'table_of_contents_label: expected a non-empty string, got ""',
    { timeout: 20_000 },
  );

  writeFileSync(file, withLabel("Summary"));
  await expect(summary.getByRole("link")).toHaveCount(7, { timeout: 20_000 });
  expect(errors).toEqual([]);
});
