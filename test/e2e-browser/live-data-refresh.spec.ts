import type { Page } from "@playwright/test";
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectConsoleErrors,
  expect,
  test,
  urlParam,
} from "./dev-server.fixture.js";

/**
 * The shipped `data/orders.parquet`'s first 100 rows, 20 of them West —
 * written by duckdb-wasm's node bindings with
 * `COPY (FROM 'data/orders.parquet' LIMIT 100) TO '…' (FORMAT parquet)`.
 * Smaller than the original, so a reader that kept the old file's size
 * would look for the footer past the new end.
 */
const FIRST_100_ORDERS = join(
  import.meta.dirname,
  "fixtures/orders-first-100.parquet",
);
const WEST_IN_FIRST_100 = "20.0";

/** The "Quarter orders" `<BigValue>` figure on /weekly-review. */
function quarterOrders(page: Page) {
  return page
    .locator("span.block")
    .filter({ has: page.getByText("Quarter orders", { exact: true }) })
    .locator("span.text-xl");
}

test("rewriting a data file a page reads refreshes its figures in place, keeping filters", async ({
  page,
  biacDev,
}) => {
  // Arrange
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);
  const region = page.getByRole("combobox", { name: "Region" });
  await expect(region).toBeEnabled();
  await region.click();
  await page.getByRole("option", { name: "West" }).click();
  await expect(quarterOrders(page)).toHaveText("140");
  await page.evaluate(() => ((window as { __mark?: number }).__mark = 1));

  // Act
  copyFileSync(
    FIRST_100_ORDERS,
    join(biacDev.projectDir, "data/orders.parquet"),
  );

  // Assert: the figure re-queries against the new rows with no reload.
  await expect(quarterOrders(page)).toHaveText(WEST_IN_FIRST_100, {
    timeout: 15_000,
  });
  expect(
    await page.evaluate(() => (window as { __mark?: number }).__mark),
  ).toBe(1);
  expect(urlParam(page, "region")).toBe("West");
  await expect(region).toHaveText("West");
  expect(errors).toEqual([]);
});
