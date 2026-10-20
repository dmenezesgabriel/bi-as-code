import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PAGE_SWAP_LOGGED_PATH,
  rewriteUntilServerLogs,
} from "../lib/write-until-logged.js";
import {
  collectConsoleErrors,
  expect,
  openOrderMixRow,
  test,
} from "./dev-server.fixture.js";

test("renders the index page: title, prose, gfm table, highlighted sql fence", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(biacDev.url);

  await expect(page).toHaveTitle("Orders overview");
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();
  await expect(
    page.getByText("Weekly order volume across regions."),
  ).toBeVisible();

  // index.md carries a static gfm table and — once its ` ```sql orders `
  // block resolves — a live result table beside it; the static one is first.
  const table = page.getByRole("table").first();
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table).toContainText("West");

  const fence = page.locator("pre.shiki");
  await expect(fence).toBeVisible();
  await expect(fence).toContainText("{{/queries/region_orders}}");
  await expect(fence.locator('span[style*="color"]').first()).toBeAttached();

  expect(errors).toEqual([]);
});

test("navigates to a linked page client-side, with no reload", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(biacDev.url);
  await page.evaluate(() => Object.assign(window, { __navMarker: "kept" }));

  await page.getByRole("link", { name: "region detail page" }).click();

  await expect(page).toHaveURL(/\/nested\/page$/);
  await expect(
    page.getByRole("heading", { name: "Region detail" }),
  ).toBeVisible();
  // A full reload would have wiped the marker; its survival proves the
  // router navigated inside the live SPA.
  expect(await page.evaluate(() => Reflect.get(window, "__navMarker"))).toBe(
    "kept",
  );
  expect(errors).toEqual([]);
});

test("updates on page edit and serves a page added while running", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(biacDev.url);
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();

  const indexFile = join(biacDev.projectDir, "pages/index.md");
  const original = readFileSync(indexFile, "utf8");
  // Under load one update outlasts any short retry, so each file is written
  // only until the server logs it — a later write would restart the update
  // the test then awaits once.
  await rewriteUntilServerLogs({
    rewrite: () =>
      writeFileSync(
        indexFile,
        original.replace("# Orders overview", "# Edited overview"),
      ),
    log: biacDev.log,
    loggedPath: PAGE_SWAP_LOGGED_PATH,
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: "Edited overview" }),
  ).toBeVisible();

  // An added page changes the manifest, a full reload; a `goto` while it
  // runs is aborted, so the reloaded sidebar listing the page comes first.
  await rewriteUntilServerLogs({
    rewrite: () =>
      writeFileSync(
        join(biacDev.projectDir, "pages/new-page.md"),
        "---\ntitle: Fresh page\n---\n# Fresh page\n",
      ),
    log: biacDev.log,
    loggedPath: "pages/new-page.md",
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  await expect(
    page
      .getByRole("navigation", { name: "Site navigation" })
      .getByRole("link", { name: "Fresh page" }),
  ).toBeVisible();
  await page.goto(`${biacDev.url}new-page`);
  await expect(page.getByRole("heading", { name: "Fresh page" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("a content edit swaps the page in place: no reload, filters kept", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review?region=West`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Weekly review" }),
  ).toBeVisible();
  // Edit only once every widget settled: the Amount slider then holds its
  // silent bounds correction, which a swap must not publish into the
  // Region dropdown it narrows.
  expect(await openOrderMixRow(page, "Page 1 of 2 · 13 rows")).toEqual([
    "1",
    "West",
    "4",
    "175",
  ]);
  // A full reload discards every window property, so the marker surviving
  // the edit proves the page updated in place.
  await page.evaluate(() => {
    (window as unknown as { __probe: string }).__probe = "kept";
  });

  const file = join(biacDev.projectDir, "pages/weekly-review.md");
  const original = readFileSync(file, "utf8");
  await rewriteUntilServerLogs({
    rewrite: () =>
      writeFileSync(
        file,
        original.replace("# Weekly review", "# Weekly review, edited"),
      ),
    log: biacDev.log,
    loggedPath: PAGE_SWAP_LOGGED_PATH,
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
  await expect(
    page.getByRole("heading", { level: 1, name: "Weekly review, edited" }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => (window as unknown as { __probe?: string }).__probe,
    ),
  ).toBe("kept");
  expect(new URL(page.url()).searchParams.get("region")).toBe("West");
  await expect(page.getByRole("combobox", { name: "Region" })).toContainText(
    "West",
  );
  expect(await openOrderMixRow(page, "Page 1 of 2 · 13 rows")).toEqual([
    "1",
    "West",
    "4",
    "175",
  ]);
  expect(errors).toEqual([]);
});

test("renders a styled 404 for an unknown route", async ({ page, biacDev }) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}no-such-page`);

  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Page not found");

  await page.getByRole("link", { name: "Back to index" }).click();
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
