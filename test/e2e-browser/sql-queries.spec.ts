import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectConsoleErrors,
  expect,
  resultTables,
  test,
} from "./dev-server.fixture.js";

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

  // Highlighted source stays visible above the result.
  const fence = page.locator("pre.shiki");
  await expect(fence).toContainText("select region");
  await expect(fence).toContainText("{{params.region}}");

  const result = resultTables(page).first();
  await expect(result.getByRole("row")).toHaveCount(4, { timeout: 30_000 });
  const firstQueryMs = Date.now() - start;
  test.info().annotations.push({
    type: "first-query-ms",
    description: String(firstQueryMs),
  });

  // Rows match data/orders.parquet's aggregates, revenue desc.
  expect(await result.locator("tbody td").allTextContents()).toEqual([
    "West",
    "140",
    "6100",
    "North",
    "120",
    "4800",
    "South",
    "95",
    "3700",
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
  await expect(result.getByRole("row")).toHaveCount(2, { timeout: 30_000 });
  expect(await result.locator("tbody td").allTextContents()).toEqual([
    "West",
    "140",
    "6100",
  ]);

  // Param absent → NULL → the authored `is null or …` baseline returns all rows.
  await page.goto(biacDev.url);
  await expect(result.getByRole("row")).toHaveCount(4, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test("weekly-review composes {{orders}} and runs the 39-row trend", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const results = resultTables(page);
  // Live tables in document order: kpi, orders, region_share, region_week,
  // the <Table> widget in the Order-mix tabs, order_amounts, weekly_trend
  // (fence), weekly_revenue, then the <Table> widget in Quarter detail.
  // The fence result renders the shared table core: 39 rows paginate at
  // pageSize 10, so the DOM holds the first page plus the pager caption.
  await expect(results.nth(6).getByRole("row")).toHaveCount(11, {
    timeout: 30_000,
  });
  // The caption appears four times: the region_week fence, the tab
  // <Table data="region_week" /> of the same fence, the weekly_trend
  // fence's own result, and the <Table data="weekly_trend" /> widget in
  // Quarter detail — all rendering the same 39-row core.
  await expect(page.getByText("Page 1 of 4 · 39 rows")).toHaveCount(4);
  // orders (region rollup) and region_share ({{orders}} + pct_of_total).
  await expect(results.nth(1).getByRole("row")).toHaveCount(4);
  await expect(results.nth(2).getByRole("row")).toHaveCount(4);
  await expect(results.nth(2)).toContainText("pct_of_total");
  expect(
    await results
      .nth(2)
      .locator("tbody tr")
      .first()
      .locator("td")
      .allTextContents(),
  ).toEqual(["West", "140", "39.4"]);

  // Deterministic order by week, region — week 1 opens North/South/West.
  expect(
    await results
      .nth(6)
      .locator("tbody tr")
      .first()
      .locator("td")
      .allTextContents(),
  ).toEqual(["1", "North", "14"]);

  // {{params.region}} lives in the `orders` block, so the param filters
  // region_share through the composed subquery; weekly_trend reads the raw
  // table and keeps its 39 rows either way.
  await page.goto(`${biacDev.url}weekly-review?region=West`);
  await expect(results.nth(1).getByRole("row")).toHaveCount(2, {
    timeout: 30_000,
  });
  await expect(results.nth(2).getByRole("row")).toHaveCount(2);
  expect(
    await results
      .nth(2)
      .locator("tbody tr")
      .first()
      .locator("td")
      .allTextContents(),
  ).toEqual(["West", "140", "100"]);
  expect(errors).toEqual([]);
});

test("allocation page queries the config-declared channels table", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}nested/allocation`);

  const result = resultTables(page).first();
  await expect(result.getByRole("row")).toHaveCount(4, { timeout: 30_000 });
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
  // prose `<Value>` and the `<BarChart>` — and quiet: no console errors,
  // no unhandled rejections, the rest of the page still renders.
  const alerts = page.getByRole("alert");
  await expect(alerts).toHaveCount(4, { timeout: 30_000 });
  await expect(alerts.first()).toContainText("orders");
  await expect(alerts.first()).toContainText("data/missing.parquet");
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
