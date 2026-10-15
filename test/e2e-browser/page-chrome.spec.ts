import type { Locator, Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { rewriteUntilServerLogs } from "../lib/write-until-logged.js";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

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

  // Nested starts closed on `/` (no active page inside); opening it
  // shows sidebar_position order — Region detail before the
  // alphabetically-earlier Allocation.
  await nav.getByText("Nested").click();
  const dirLinks = nav.locator("details li a");
  await expect(dirLinks).toHaveCount(2);
  expect(await dirLinks.allTextContents()).toEqual([
    "Region detail",
    "Allocation",
  ]);

  await nav.getByRole("link", { name: "Region detail" }).click();
  await expect(page).toHaveURL(/\/nested\/page$/);
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
    /Orders overview\s*\/\s*Nested\s*\/\s*Region detail/,
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
    fileTail: "biac.config.ts",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  await expect(nav.getByRole("link", { name: "ACME" })).toBeVisible();
  expect(errors).toEqual([]);
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
