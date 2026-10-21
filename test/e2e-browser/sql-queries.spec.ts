import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  PAGE_SWAP_LOGGED_PATH,
  rewriteUntilServerLogs,
} from "../lib/write-until-logged.js";
import {
  collectConsoleErrors,
  expect,
  resultTables,
  test,
} from "./dev-server.fixture.js";
import { openWeeklyReviewCharts, optionAt } from "./echart-hosts.js";

test("index page runs the named sql block and renders its live result", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  // The wasm module downloads inside the worker — out of reach of the
  // page's resource timing — so the size comes from the response itself.
  const wasmBytes: number[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith(".wasm")) {
      void response
        .body()
        .then((body) => wasmBytes.push(body.length))
        .catch(() => {});
    }
  });
  const start = Date.now();
  await page.goto(biacDev.url);

  // The `echo` fence shows its highlighted source; the `<Table>` reading
  // `orders` is the page's only live table.
  const fence = page.locator("pre.shiki");
  await expect(fence).toContainText("{{/queries/region_orders}}");
  await expect(fence).toContainText("{{params.region}}");

  const result = resultTables(page).first();
  await expect(result.getByRole("row")).toHaveCount(4);
  const firstQueryMs = Date.now() - start;
  test.info().annotations.push({
    type: "first-query-ms",
    description: String(firstQueryMs),
  });

  // Rows match data/orders.parquet's aggregates, revenue desc.
  expect(await result.locator("tbody td").allTextContents()).toEqual([
    "West",
    "140",
    "6,100",
    "North",
    "120",
    "4,800",
    "South",
    "95",
    "3,700",
  ]);

  // The wasm module actually shipped over the wire this page load.
  expect(wasmBytes).toHaveLength(1);
  expect(wasmBytes[0]).toBeGreaterThan(1_000_000);
  test.info().annotations.push({
    type: "wasm-bytes",
    description: String(wasmBytes[0]),
  });
  expect(errors).toEqual([]);
});

test("{{params.region}} binds the URL search param through a prepared arg", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}?region=West`);

  const result = resultTables(page).first();
  await expect(result.getByRole("row")).toHaveCount(2);
  expect(await result.locator("tbody td").allTextContents()).toEqual([
    "West",
    "140",
    "6,100",
  ]);

  // Param absent → NULL → the authored `is null or …` baseline returns all rows.
  await page.goto(biacDev.url);
  await expect(result.getByRole("row")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("weekly-review's region_share builds on {{/queries/region_orders}} and runs the 39-row trend", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const results = resultTables(page);
  // Live tables in document order: region_share (a fence opting into
  // `display`), the <Table> widget in the Order-mix tabs, the order_detail
  // <Table> widget, the weekly_trend <Table> widget in Quarter detail, then
  // the west_orders fence in Takeaways.
  // The trend's 39 rows paginate at pageSize 10, so the DOM holds the
  // first page plus the pager caption.
  await expect(results.nth(3).getByRole("row")).toHaveCount(11);
  // The caption appears twice: the tab <Table data="region_week" /> and
  // the <Table data="weekly_trend" /> — the fences behind them stay hidden.
  await expect(page.getByText("Page 1 of 4 · 39 rows")).toHaveCount(2);
  // region_share builds pct_of_total on queries/region_orders.sql.
  await expect(results.nth(0).getByRole("row")).toHaveCount(4);
  expect(await results.nth(0).locator("tbody td").allTextContents()).toEqual([
    ...["West", "140", "39"],
    ...["North", "120", "34"],
    ...["South", "95", "27"],
  ]);
  // Result headers read humanized: `pct_of_total` → "Pct of Total".
  await expect(
    results.nth(0).getByRole("columnheader", { name: "Pct of Total" }),
  ).toBeVisible();
  expect(
    await results
      .nth(0)
      .locator("tbody tr")
      .first()
      .locator("td")
      .allTextContents(),
  ).toEqual(["West", "140", "39"]);

  // Deterministic order by week, region — week 1 opens North/South/West;
  // the <Column> children list region before week and format share pct1.
  expect(
    await results
      .nth(3)
      .locator("tbody tr")
      .first()
      .locator("td")
      .allTextContents(),
  ).toEqual(["North", "1", "14", "53.8%"]);

  // The fences stay raw under the param — the widgets that declare
  // filters=["region"] are the filters spec's subject: region_share still
  // reads all three regions out of queries/region_orders.sql.
  await page.goto(`${biacDev.url}weekly-review?region=West`);
  await expect(results.nth(0).getByRole("row")).toHaveCount(4);
  expect(
    await results
      .nth(0)
      .locator("tbody tr")
      .first()
      .locator("td")
      .allTextContents(),
  ).toEqual(["West", "140", "39"]);
  expect(errors).toEqual([]);
});

test("allocation page queries the config-declared channels table", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}nested/allocation`);

  const result = resultTables(page).first();
  await expect(result.getByRole("row")).toHaveCount(4);
  expect(await result.locator("tbody tr td").allTextContents()).toEqual([
    "Direct",
    "46",
    "163",
    "Marketplace",
    "32",
    "113",
    "Partner",
    "22",
    "79",
  ]);
  expect(errors).toEqual([]);
});

test("a missing sql: source shows an inline error, not a page crash", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const indexFile = join(biacDev.projectDir, "pages/index.md");
  writeFileSync(
    indexFile,
    readFileSync(indexFile, "utf8").replace(
      "data/orders.parquet",
      "data/missing.parquet",
    ),
  );
  await page.goto(biacDev.url);

  // The failed registration lands inline in every call site that renders
  // the `orders` result — the fence's own table, the `<Table>` widget, the
  // prose `<Value>` and the `<BarChart>` — and quiet: no app console
  // errors, no unhandled rejections, the rest of the page still renders.
  const alerts = page.getByRole("alert");
  await expect(alerts).toHaveCount(4);
  await expect(alerts.first()).toContainText("orders");
  await expect(alerts.first()).toContainText(
    "/data/missing.parquet → HTTP 404",
  );
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();
  // The one line is Chromium's own report of the diagnostic GET that
  // recovers the status duckdb's reader drops; the app logs nothing.
  expect(errors).toEqual([
    "Failed to load resource: the server responded with a status of 404 (Not Found)",
  ]);
});

test("weekly-review's region chart and region_share read queries/region_orders.sql", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  const queryFile = join(biacDev.projectDir, "queries/region_orders.sql");
  writeFileSync(
    queryFile,
    readFileSync(queryFile, "utf8").replace(
      "group by region",
      "where region <> 'West'\ngroup by region",
    ),
  );
  await openWeeklyReviewCharts(page, biacDev.url);

  // Chart 0 is "Revenue by region" and result table 0 is region_share:
  // both follow the file's edit.
  const { series } = await optionAt(page, 0);
  expect(series[0]?.data).toEqual([
    ["North", 4800],
    ["South", 3700],
  ]);
  await expect(resultTables(page).nth(0).getByRole("row")).toHaveCount(3);
  expect(errors).toEqual([]);
});

/**
 * Saves `queries/region_orders.sql` under the running dev server, rewritten
 * by `edit`, until vite logs the page swap it causes.
 */
async function saveRegionOrders(
  biacDev: { projectDir: string; log(): readonly string[] },
  edit: (sql: string) => string,
): Promise<void> {
  const queryFile = join(biacDev.projectDir, "queries/region_orders.sql");
  const sql = edit(readFileSync(queryFile, "utf8"));
  await rewriteUntilServerLogs({
    rewrite: () => writeFileSync(queryFile, sql),
    log: biacDev.log,
    loggedPath: PAGE_SWAP_LOGGED_PATH,
    attemptMs: 3_000,
    timeoutMs: 20_000,
  });
}

/** Marks the window; a full reload would discard the mark. */
async function markWindow(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __probe: string }).__probe = "kept";
  });
}

function windowMark(page: Page): Promise<string | undefined> {
  return page.evaluate(
    () => (window as unknown as { __probe?: string }).__probe,
  );
}

test("saving queries/region_orders.sql updates weekly-review in place", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);
  await markWindow(page);

  await saveRegionOrders(biacDev, (sql) =>
    sql.replace("group by region", "where region <> 'West'\ngroup by region"),
  );

  await expect(resultTables(page).nth(0).getByRole("row")).toHaveCount(3);
  await expect
    .poll(async () => (await optionAt(page, 0)).series[0]?.data)
    .toEqual([
      ["North", 4800],
      ["South", 3700],
    ]);
  expect(await windowMark(page)).toBe("kept");
  expect(errors).toEqual([]);
});

test("a broken query file shows the error state of the chart that reads it, named by the file", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);
  const original = readFileSync(
    join(biacDev.projectDir, "queries/region_orders.sql"),
    "utf8",
  );

  await saveRegionOrders(biacDev, (sql) =>
    sql.replace("select region", "selec region"),
  );

  const alert = page
    .getByRole("alert")
    .filter({ hasText: "/queries/region_orders:" });
  await expect(alert).toContainText(
    "/queries/region_orders: queries/region_orders.sql: query failed (",
  );
  await expect(alert).toContainText("syntax error at or near");

  await saveRegionOrders(biacDev, () => original);

  await expect(alert).toHaveCount(0);
  await expect
    .poll(async () => (await optionAt(page, 0)).series[0]?.data)
    .toEqual([
      ["West", 6100],
      ["North", 4800],
      ["South", 3700],
    ]);
  expect(errors).toEqual([]);
});

test("a misspelled query file reference fails the page at its line", async ({
  page,
  biacDev,
}) => {
  const pageFile = join(biacDev.projectDir, "pages/weekly-review.md");
  writeFileSync(
    pageFile,
    readFileSync(pageFile, "utf8").replace(
      'data="/queries/region_orders"',
      'data="/queries/region_order"',
    ),
  );
  await page.goto(`${biacDev.url}weekly-review`);

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("This page failed to compile");
  await expect(alert).toContainText(/pages\/weekly-review\.md:104:\d+/);
  await expect(alert).toContainText(
    'Query file queries/region_order.sql not found for data="/queries/region_order" (did you mean /queries/region_orders?)',
  );
});

test("a misspelled query file token fails the page at its fence", async ({
  page,
  biacDev,
}) => {
  const pageFile = join(biacDev.projectDir, "pages/weekly-review.md");
  writeFileSync(
    pageFile,
    readFileSync(pageFile, "utf8").replace(
      "from {{/queries/region_orders}}",
      "from {{/queries/region_order}}",
    ),
  );
  await page.goto(`${biacDev.url}weekly-review`);

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("This page failed to compile");
  await expect(alert).toContainText(/pages\/weekly-review\.md:106:1/);
  await expect(alert).toContainText(
    "Query file queries/region_order.sql not found for {{/queries/region_order}} (did you mean /queries/region_orders?)",
  );
});
