import type { Locator, Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectConsoleErrors,
  expect,
  instrumentWorkerPosts,
  resultTables,
  test,
  workerPosts,
} from "./dev-server.fixture.js";
import { expectMinTargetSize } from "./target-size.js";
import { textBounds } from "./text-bounds.js";

/**
 * A `DataTable` root — `div.py-2` wraps the scrollable table and the pager.
 * Filtering on the inner table (not the caption text) keeps the locator
 * stable while the pager caption changes between "Page 1/2/4 of 4".
 */
function tableRegions(page: Page) {
  return page
    .locator("div.py-2")
    .filter({ has: page.locator("div.overflow-x-auto table") });
}

/**
 * How far a header label's text ends from its first-row figure's text, in
 * px: 0 when the label sits flush over its column.
 */
async function headerOffset(table: Locator, title: string): Promise<number> {
  const headers = await table.locator("th").allTextContents();
  const index = headers.indexOf(title);
  if (index < 0) {
    throw new Error(`no header "${title}"; expected one of ${headers}`);
  }
  const label = table.locator("th").nth(index).getByRole("button");
  const cell = table.locator("tbody tr").first().locator("td").nth(index);
  return (await textBounds(cell)).right - (await textBounds(label)).right;
}

/** weekly-review's last `<Table>` widget, loaded at `width` px. */
async function weeklyReviewWidget(
  page: Page,
  baseUrl: string,
  width: number,
): Promise<Locator> {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`${baseUrl}weekly-review`);
  const table = tableRegions(page).last().locator("table");
  await expect(table.getByRole("row")).toHaveCount(11);
  return table;
}

function firstRowCells(table: Locator) {
  return table.locator("tbody tr").first().locator("td").allTextContents();
}

test.beforeEach(async ({ page }) => {
  // Sort and pagination are client-side transforms — every worker post
  // after first render would mean a re-query leaked in.
  await instrumentWorkerPosts(page);
});

test("weekly-review's <Table> sorts client-side through the 3-state cycle", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  // The widget is the last live table region — the named fences' results
  // render ahead of it in document order.
  const widget = tableRegions(page).last();
  const table = widget.locator("table");
  await expect(table.getByRole("row")).toHaveCount(11);

  const ordersHeader = widget.locator("th", {
    has: page.getByRole("button", { name: "Orders" }),
  });
  await expect(ordersHeader).toHaveAttribute("aria-sort", "none");
  // Authored `order by week, region` — week 1 opens North/South/West.
  expect(await firstRowCells(table)).toEqual(["North", "1", "14", "53.8%"]);

  const postsBefore = await workerPosts(page);

  // Click-to-sorted latency, measured inside the page: dispatch the click
  // and wait on the tbody mutation React commits for the re-sorted rows.
  const sortMs = await page.evaluate(() => {
    const regions = document.querySelectorAll("div.overflow-x-auto table");
    const table = regions[regions.length - 1];
    if (!table) throw new Error("widget table not found");
    const tbody = table.querySelector("tbody");
    if (!tbody) throw new Error("widget tbody not found");
    const button = [
      ...tbody.closest("table")!.querySelectorAll("th button"),
    ].find((b) => b.textContent?.startsWith("Orders"));
    if (!button) throw new Error("Orders header button not found");
    const t0 = performance.now();
    return new Promise<number>((resolve) => {
      new MutationObserver(() => resolve(performance.now() - t0)).observe(
        tbody,
        { childList: true, subtree: true, characterData: true },
      );
      (button as HTMLButtonElement).click();
    });
  });
  test.info().annotations.push({
    type: "sort-ms",
    description: String(Math.round(sortMs)),
  });

  await expect(ordersHeader).toHaveAttribute("aria-sort", "descending");
  // Desc by orders: week 13 West (22) tops the set.
  expect(await firstRowCells(table)).toEqual(["West", "13", "22", "64.7%"]);

  await widget.getByRole("button", { name: "Orders" }).click();
  await expect(ordersHeader).toHaveAttribute("aria-sort", "ascending");
  // Asc: week 1 West (4) is the minimum.
  expect(await firstRowCells(table)).toEqual(["West", "1", "4", "15.4%"]);

  await widget.getByRole("button", { name: "Orders" }).click();
  await expect(ordersHeader).toHaveAttribute("aria-sort", "none");
  // Third click restores the authored query order.
  expect(await firstRowCells(table)).toEqual(["North", "1", "14", "53.8%"]);

  // Sorting never touched the engine: zero messages reached the worker.
  expect(await workerPosts(page)).toBe(postsBefore);
  expect(errors).toEqual([]);
});

test("weekly-review's <Column> children order, title and format the table", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const table = tableRegions(page).last().locator("table");
  await expect(table.getByRole("row")).toHaveCount(11);

  // The fence selects week, region, orders, share; the <Column> list puts
  // region first and titles every header.
  expect(await table.locator("th").allTextContents()).toEqual([
    "Region",
    "Week",
    "Orders",
    "Share of week",
  ]);
  // `share` is a 0–1 ratio; fmt="pct1" renders it with one decimal.
  expect(await firstRowCells(table)).toEqual(["North", "1", "14", "53.8%"]);
  expect(errors).toEqual([]);
});

test("allocation's <Table> sits numeric headers flush over their figures", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${biacDev.url}nested/allocation`);

  const table = tableRegions(page).last().locator("table");
  await expect(table.getByRole("button", { name: "Share" })).toBeVisible();

  expect(Math.abs(await headerOffset(table, "Share"))).toBeLessThanOrEqual(1);
  expect(Math.abs(await headerOffset(table, "Orders"))).toBeLessThanOrEqual(1);
  const channel = table.getByRole("columnheader", { name: "Channel" });
  await expect(channel).toHaveCSS("text-align", "left");
  expect(errors).toEqual([]);
});

test("a sorted numeric header keeps its edge over the figures", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const table = await weeklyReviewWidget(page, biacDev.url, 1280);
  expect(Math.abs(await headerOffset(table, "Orders"))).toBeLessThanOrEqual(1);

  await table.getByRole("button", { name: "Orders" }).click();

  const orders = table.getByRole("columnheader", { name: "Orders" });
  await expect(orders).toHaveAttribute("aria-sort", "descending");
  expect(Math.abs(await headerOffset(table, "Orders"))).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("a numeric header that wraps at 375 px still ends flush over its figures", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const table = await weeklyReviewWidget(page, biacDev.url, 375);
  // A <button> centres its own lines, so a wrapped label drifts off the
  // column's edge unless the button carries the column's alignment too.
  const label = table.getByRole("button", { name: "Share of week" });
  expect((await label.boundingBox())!.height).toBeGreaterThan(30);

  const offset = await headerOffset(table, "Share of week");
  expect(Math.abs(offset)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("the widget pager walks the 39 rows in pages of 10", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const widget = tableRegions(page).last();
  const table = widget.locator("table");
  await expect(table.getByRole("row")).toHaveCount(11);
  await expect(widget).toContainText("Page 1 of 4 · 39 rows");
  await expect(
    widget.getByRole("button", { name: "First page" }),
  ).toBeDisabled();

  await widget.getByRole("button", { name: "Next page" }).click();
  await expect(widget).toContainText("Page 2 of 4 · 39 rows");
  // Row 11 of the authored order: week 4's middle row (South).
  expect(await firstRowCells(table)).toEqual(["South", "4", "7", "28.0%"]);

  await widget.getByRole("button", { name: "Last page" }).click();
  await expect(widget).toContainText("Page 4 of 4 · 39 rows");
  // Rows 31–39: 9 data rows + the header row.
  await expect(table.getByRole("row")).toHaveCount(10);
  expect(await firstRowCells(table)).toEqual(["North", "11", "7", "24.1%"]);
  await expect(
    widget.getByRole("button", { name: "Next page" }),
  ).toBeDisabled();

  await widget.getByRole("button", { name: "First page" }).click();
  await expect(widget).toContainText("Page 1 of 4 · 39 rows");
  expect(await firstRowCells(table)).toEqual(["North", "1", "14", "53.8%"]);
  expect(errors).toEqual([]);
});

test("the order-grain pager's buttons are at least 24×24", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const pager = tableRegions(page).filter({ hasText: "Page 1 of 36" });
  await expect(pager).toHaveCount(1);
  for (const name of ["First page", "Previous page", "Next page", "Last page"])
    await expectMinTargetSize(pager.getByRole("button", { name }), 24);

  await pager.getByRole("button", { name: "Next page" }).click();
  await expect(
    tableRegions(page).filter({ hasText: "Page 2 of 36" }),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("?region=Atlantis empties the index page's <Table> with its fence", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}?region=Atlantis`);

  // The param re-runs `orders` to zero rows: the `<Table data="orders" />`
  // and the `<BarChart>`'s empty face each render the shared empty state —
  // the fence opts into `echo` only, so it adds none — and no live table
  // remains on the page.
  await expect(page.getByText("0 rows", { exact: true })).toHaveCount(2);
  await expect(resultTables(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a data name no sql fence declares renders an inline error", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const indexFile = join(biacDev.projectDir, "pages/index.md");
  writeFileSync(
    indexFile,
    readFileSync(indexFile, "utf8").replace(
      'data="orders"',
      'data="no_such_query"',
    ),
  );
  await page.goto(biacDev.url);

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("no_such_query");
  await expect(alert).toContainText(
    "no sql fence on this page declares this name",
  );
  // One bad widget must not take down the page: the `orders` fence result
  // still renders beside the error.
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();
  await expect(resultTables(page).first().getByRole("row")).toHaveCount(4);
  expect(errors).toEqual([]);
});
