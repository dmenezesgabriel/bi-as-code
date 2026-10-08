import {
  collectConsoleErrors,
  expect,
  firstRowCells,
  openOrderMixRow,
  resultTables,
  test,
} from "./dev-server.fixture.js";

/**
 * The filter model's user interaction is the URL itself: `?region=West` seeds
 * the page's `region` filter, every widget that declares `filters=["region"]`
 * wraps its fence's sql with the filter's bound predicate, and the fences
 * keep their raw read. These tests drive the URL and read the tables the
 * widgets and the fences render — live tables in document order on
 * weekly-review: kpi, orders, region_share, region_week (fence), the
 * region_week <Table> in the Order-mix tabs, order_amounts, order_detail
 * (fence), the order_detail <Table>, weekly_trend (fence), weekly_revenue,
 * then the <Table> in Quarter detail.
 */
test("?region=West narrows the filter-declaring widgets while their fences stay raw", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review?region=West`);
  await expect(page.locator("[data-echarts-ready]")).toHaveCount(6, {
    timeout: 30_000,
  });

  const results = resultTables(page);

  // The fences the widgets filter keep their raw reads: orders' three
  // regions, region_share over all of them, the full 39-row region_week
  // (week 1 opens North/South/West) and all 355 amounts.
  await expect(results.nth(1).getByRole("row")).toHaveCount(4);
  await expect(results.nth(2).getByRole("row")).toHaveCount(4);
  await expect(results.nth(3).getByRole("row")).toHaveCount(11);
  expect(await firstRowCells(results.nth(3))).toEqual([
    "1",
    "North",
    "14",
    "560",
  ]);
  await expect(page.getByText("Page 1 of 4 · 39 rows")).toHaveCount(3);
  // order_amounts' and order_detail's previews keep their raw 355; the
  // order_detail <Table> is the one consumer narrowing to West's 140.
  await expect(page.getByText("Page 1 of 36 · 355 rows")).toHaveCount(2);
  await expect(page.getByText("Page 1 of 14 · 140 rows")).toHaveCount(1);

  // The Order-mix <Table> declares the same filter: with the fence param
  // gone, only the filter's wrapped query can hold the 13 West weeks —
  // week 1 opening at 4 orders.
  expect(await openOrderMixRow(page, "Page 1 of 2 · 13 rows")).toEqual([
    "1",
    "West",
    "4",
    "175",
  ]);
  expect(errors).toEqual([]);
});

test("the filtered read survives a reload and clears when the param is removed", async ({
  page,
  biacDev,
}) => {
  test.slow();
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review?region=West`);
  expect(await openOrderMixRow(page, "Page 1 of 2 · 13 rows")).toEqual([
    "1",
    "West",
    "4",
    "175",
  ]);

  // The URL is read at filter construction, so a reload lands filtered.
  await page.reload();
  expect(await openOrderMixRow(page, "Page 1 of 2 · 13 rows")).toEqual([
    "1",
    "West",
    "4",
    "175",
  ]);

  // Dropping the param clears the filter — the registry's full read returns.
  await page.goto(`${biacDev.url}weekly-review`);
  expect(await openOrderMixRow(page, "Page 1 of 4 · 39 rows")).toEqual([
    "1",
    "North",
    "14",
    "560",
  ]);
  expect(errors).toEqual([]);
});

test("?region=Atlantis is pruned by the Region dropdown and the page renders unfiltered", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review?region=Atlantis`);

  // The Region dropdown validates the URL value once its options load:
  // Atlantis matches none of them, so the filter normalizes the stale
  // value away and the param drops from the URL. The settled page is the
  // unfiltered read — every fence preview and the <Table> widgets at
  // their full counts (the mounted-but-hidden Order-mix table included).
  await expect(page).toHaveURL(/weekly-review$/, { timeout: 30_000 });
  await expect(page.getByText("Page 1 of 4 · 39 rows")).toHaveCount(4);
  await expect(page.getByText("Page 1 of 36 · 355 rows")).toHaveCount(3);
  await expect(page.locator("[data-chart-empty]")).toHaveCount(0);
  await expect(resultTables(page)).toHaveCount(11);
  expect(errors).toEqual([]);
});
