import type { Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";

/** Live result tables render inside `div.overflow-x-auto`; static gfm tables don't. */
function resultTables(page: Page) {
  return page.locator("div.overflow-x-auto table");
}

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
  await expect(results.nth(2).getByRole("row")).toHaveCount(40, {
    timeout: 30_000,
  });
  // orders (region rollup) and region_share ({{orders}} + pct_of_total).
  await expect(results.nth(0).getByRole("row")).toHaveCount(4);
  await expect(results.nth(1).getByRole("row")).toHaveCount(4);
  await expect(results.nth(1)).toContainText("pct_of_total");
  expect(
    await results
      .nth(1)
      .locator("tbody tr")
      .first()
      .locator("td")
      .allTextContents(),
  ).toEqual(["West", "140", "39.4"]);

  // Deterministic order by week, region — week 1 opens North/South/West.
  expect(
    await results
      .nth(2)
      .locator("tbody tr")
      .first()
      .locator("td")
      .allTextContents(),
  ).toEqual(["1", "North", "14"]);

  // {{params.region}} lives in the `orders` block, so the param filters
  // region_share through the composed subquery; weekly_trend reads the raw
  // table and keeps its 39 rows either way.
  await page.goto(`${biacDev.url}weekly-review?region=West`);
  await expect(results.nth(0).getByRole("row")).toHaveCount(2, {
    timeout: 30_000,
  });
  await expect(results.nth(1).getByRole("row")).toHaveCount(2);
  expect(
    await results
      .nth(1)
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

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toContainText("orders");
  await expect(alert).toContainText("data/missing.parquet");
  // The failed registration lands inline and quiet — no console errors, no
  // unhandled rejections, the rest of the page still renders.
  await expect(
    page.getByRole("heading", { name: "Orders overview" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
