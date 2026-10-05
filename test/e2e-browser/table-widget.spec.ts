import type { Locator, Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectConsoleErrors,
  expect,
  resultTables,
  test,
} from "./dev-server.fixture.js";

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

function firstRowCells(table: Locator) {
  return table.locator("tbody tr").first().locator("td").allTextContents();
}

/** Counts messages posted to the duckdb worker — every query is a post. */
async function workerPosts(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __workerPosts: number }).__workerPosts,
  );
}

test.beforeEach(async ({ page }) => {
  // Wrap the prototype the duckdb-wasm worker is later constructed against:
  // sort and pagination are client-side transforms, so every worker post
  // after first render would mean a re-query leaked in.
  await page.addInitScript(() => {
    const counter = window as unknown as { __workerPosts: number };
    counter.__workerPosts = 0;
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, ...args: unknown[]) {
      counter.__workerPosts++;
      return original.apply(this, args as [unknown]);
    };
  });
});

test("weekly-review's <Table> sorts client-side through the 3-state cycle", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  // The widget is the last live table region — the three named fences'
  // results render ahead of it in document order.
  const widget = tableRegions(page).last();
  const table = widget.locator("table");
  await expect(table.getByRole("row")).toHaveCount(11, { timeout: 30_000 });

  const ordersHeader = widget.locator("th", {
    has: page.getByRole("button", { name: "orders" }),
  });
  await expect(ordersHeader).toHaveAttribute("aria-sort", "none");
  // Authored `order by week, region` — week 1 opens North/South/West.
  expect(await firstRowCells(table)).toEqual(["1", "North", "14"]);

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
    ].find((b) => b.textContent?.startsWith("orders"));
    if (!button) throw new Error("orders header button not found");
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
  expect(await firstRowCells(table)).toEqual(["13", "West", "22"]);

  await widget.getByRole("button", { name: "orders" }).click();
  await expect(ordersHeader).toHaveAttribute("aria-sort", "ascending");
  // Asc: week 1 West (4) is the minimum.
  expect(await firstRowCells(table)).toEqual(["1", "West", "4"]);

  await widget.getByRole("button", { name: "orders" }).click();
  await expect(ordersHeader).toHaveAttribute("aria-sort", "none");
  // Third click restores the authored query order.
  expect(await firstRowCells(table)).toEqual(["1", "North", "14"]);

  // Sorting never touched the engine: zero messages reached the worker.
  expect(await workerPosts(page)).toBe(postsBefore);
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
  await expect(table.getByRole("row")).toHaveCount(11, { timeout: 30_000 });
  await expect(widget).toContainText("Page 1 of 4 · 39 rows");
  await expect(
    widget.getByRole("button", { name: "First page" }),
  ).toBeDisabled();

  await widget.getByRole("button", { name: "Next page" }).click();
  await expect(widget).toContainText("Page 2 of 4 · 39 rows");
  // Row 11 of the authored order: week 4's middle row (South).
  expect(await firstRowCells(table)).toEqual(["4", "South", "7"]);

  await widget.getByRole("button", { name: "Last page" }).click();
  await expect(widget).toContainText("Page 4 of 4 · 39 rows");
  // Rows 31–39: 9 data rows + the header row.
  await expect(table.getByRole("row")).toHaveCount(10);
  expect(await firstRowCells(table)).toEqual(["11", "North", "7"]);
  await expect(
    widget.getByRole("button", { name: "Next page" }),
  ).toBeDisabled();

  await widget.getByRole("button", { name: "First page" }).click();
  await expect(widget).toContainText("Page 1 of 4 · 39 rows");
  expect(await firstRowCells(table)).toEqual(["1", "North", "14"]);
  expect(errors).toEqual([]);
});

test("?region=Atlantis empties the index page's <Table> with its fence", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}?region=Atlantis`);

  // The param re-runs `orders` to zero rows: both the fence's inline
  // result and the `<Table data="orders" />` render the shared empty
  // state, and no live table remains on the page.
  await expect(page.getByText("0 rows", { exact: true })).toHaveCount(2, {
    timeout: 30_000,
  });
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
  await expect(alert).toBeVisible({ timeout: 30_000 });
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
