import type { Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expect,
  resultTables,
  test,
  urlParam,
} from "./dev-server.fixture.js";
import {
  binCounts,
  chartPoint,
  dragAcross,
  legendItemPoint,
  optionAt,
  readyCharts,
} from "./echart-hosts.js";

test.use({ biacProject: "docs" });

// Chart hosts in document order on the page: the species bars, the bill
// scatter that brushes, the flipper histogram it narrows, the island legend.
const BARS = 0;
const BILL_SCATTER = 1;
const FLIPPER_HISTOGRAM = 2;
const ISLAND_SCATTER = 3;
const CHART_COUNT = 4;

async function openPage(page: Page, url: string): Promise<void> {
  await page.goto(`${url}/crossfilter/select-on-a-chart`);
  await expect(readyCharts(page)).toHaveCount(CHART_COUNT);
}

const tableRows = (page: Page, table: number) =>
  resultTables(page).nth(table).locator("tbody tr");

async function histogramTotal(page: Page): Promise<number> {
  const option = await optionAt(page, FLIPPER_HISTOGRAM);
  return binCounts(option.series[0]!).reduce((sum, n) => sum + n, 0);
}

test("clicking and shift-clicking bars narrows the table beside them, and clicking a lone bar again clears it", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openPage(page, biacDev.url);
  const rows = tableRows(page, 0);
  // Five island × species pairs; Adelie lives on three islands, Gentoo on one.
  await expect(rows).toHaveCount(5);
  await page.locator("[data-echarts-theme]").nth(BARS).scrollIntoViewIfNeeded();
  const adelie = await chartPoint(page, BARS, [0, 20]);
  const gentoo = await chartPoint(page, BARS, [1, 20]);

  await page.mouse.click(adelie.x, adelie.y);
  await expect(rows).toHaveCount(3);

  await page.keyboard.down("Shift");
  await page.mouse.click(gentoo.x, gentoo.y);
  await page.keyboard.up("Shift");
  await expect(rows).toHaveCount(4);

  // A plain click replaces the pair with the one bar, a second clears it.
  await page.mouse.click(gentoo.x, gentoo.y);
  await expect(rows).toHaveCount(1);
  await page.mouse.click(gentoo.x, gentoo.y);
  await expect(rows).toHaveCount(5);

  // A chart pick is session state: the URL stays bare, the bars all stay.
  expect(urlParam(page, "species")).toBeNull();
  expect((await optionAt(page, BARS)).series[0]?.data).toHaveLength(3);
  expect(errors).toEqual([]);
});

test("dragging across a scatter chart narrows the histogram beside it, and clicking the plot clears it", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openPage(page, biacDev.url);
  const whole = await histogramTotal(page);
  await page
    .locator("[data-echarts-theme]")
    .nth(BILL_SCATTER)
    .scrollIntoViewIfNeeded();
  const from = await chartPoint(page, BILL_SCATTER, [40, 14]);
  const to = await chartPoint(page, BILL_SCATTER, [48, 20]);

  await dragAcross(page, from, to);

  await expect.poll(() => histogramTotal(page)).toBeLessThan(whole);
  expect(await histogramTotal(page)).toBeGreaterThan(0);
  expect(urlParam(page, "bill_length_mm")).toBeNull();

  // A click outside the dragged range clears it.
  const outside = await chartPoint(page, BILL_SCATTER, [56, 14]);
  await page.mouse.click(outside.x, outside.y);
  await expect.poll(() => histogramTotal(page)).toBe(whole);
  expect(errors).toEqual([]);
});

test("clicking a legend entry narrows the table to the islands still on, and clicking it again restores them", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openPage(page, biacDev.url);
  const rows = tableRows(page, 1);
  await expect(rows).toHaveCount(5);

  // Dream off leaves Biscoe (two species) and Torgersen (one).
  const dream = await legendItemPoint(page, ISLAND_SCATTER, "Dream");
  await page.mouse.click(dream.x, dream.y);
  await expect(rows).toHaveCount(3);
  expect(urlParam(page, "island")).toBeNull();
  expect(
    (await optionAt(page, ISLAND_SCATTER)).legend[0]?.selected?.Dream,
  ).toBe(false);

  await page.mouse.click(dream.x, dream.y);
  await expect(rows).toHaveCount(5);
  expect(errors).toEqual([]);
});
