import type { Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expect,
  instrumentWorkerPosts,
  test,
  workerPosts,
} from "./dev-server.fixture.js";
import {
  chartHosts,
  chartPoint,
  openWeeklyReviewCharts,
  optionAt,
  type PagePoint,
} from "./echart-hosts.js";

test.beforeEach(async ({ page }) => {
  // The selection tests assert a gesture's re-query reached the worker.
  await instrumentWorkerPosts(page);
});

/**
 * The page-space center of legend item `name` on chart host `hostIndex`.
 * The canvas renderer draws the legend as zrender text, so the label is
 * found in the display list and its transformed rect lifted to viewport
 * space. The host scrolls to the viewport's bottom edge first — centered,
 * the sticky filter bar covers the chart's top-docked legend.
 */
async function legendItemPoint(
  page: Page,
  hostIndex: number,
  name: string,
): Promise<PagePoint> {
  return page.evaluate(
    ([hi, label]) => {
      interface TextElement {
        style?: { text?: string };
        getBoundingRect(): {
          clone(): {
            applyTransform(m: unknown): void;
            x: number;
            y: number;
            width: number;
            height: number;
          };
        };
        getComputedTransform(): unknown;
      }
      const host = document.querySelectorAll<HTMLElement>(
        "[data-echarts-theme]",
      )[hi];
      if (!host) throw new Error(`chart host ${hi} not in the document`);
      host.scrollIntoView({ block: "end" });
      const chart = (
        host as unknown as {
          echartsInstance?: {
            getZr(): { storage: { getDisplayList(): TextElement[] } };
          };
        }
      ).echartsInstance;
      if (!chart) throw new Error(`chart host ${hi} has no echartsInstance`);
      const text = chart
        .getZr()
        .storage.getDisplayList()
        .find((el) => el.style?.text === label);
      if (!text) throw new Error(`no legend label "${label}" on host ${hi}`);
      const box = text.getBoundingRect().clone();
      box.applyTransform(text.getComputedTransform());
      const rect = host.getBoundingClientRect();
      return {
        x: rect.left + box.x + box.width / 2,
        y: rect.top + box.y + box.height / 2,
      };
    },
    [hostIndex, name] as const,
  );
}

/**
 * The order_id table — the `order_detail` `<Table>` widget; its fence opts
 * into no `display` — same shape as `filter-inputs.spec.ts`'s helper.
 */
function orderDetailTable(page: Page) {
  return page
    .locator("div.overflow-x-auto", {
      has: page.getByRole("columnheader", { name: "Order ID" }),
    })
    .locator("..");
}

test("a bar click cross-filters the region consumers while the bar chart holds its rows", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);
  const posts = await workerPosts(page);

  // Baseline: three bars; two pagers read "39 rows" — the region_week
  // and weekly_trend <Table>s — and none reads "13 rows" yet.
  expect((await optionAt(page, 0)).series[0]?.data).toHaveLength(3);
  await expect(page.getByText("Page 1 of 4 · 39 rows")).toHaveCount(2);
  await expect(page.getByText("Page 1 of 2 · 13 rows")).toHaveCount(0);

  await chartHosts(page).nth(0).scrollIntoViewIfNeeded();
  const westBar = await chartPoint(page, 0, [0, 3000]);
  await page.mouse.click(westBar.x, westBar.y);

  // The publisher's own clause skips it — all three bars hold — while
  // every filters={["region"]} consumer re-queries: the scatter keeps
  // only West's 13 weeks, the keepMounted region_week <Table> pages "13
  // rows", and order_detail pages down to West's 140 rows; the unfiltered
  // weekly_trend <Table> keeps its 39.
  const bar = await optionAt(page, 0);
  expect(bar.xAxis[0]?.data).toEqual(["West", "North", "South"]);
  expect(bar.series[0]?.data).toHaveLength(3);
  await expect
    .poll(async () => (await optionAt(page, 1)).series.map((s) => s.name))
    .toEqual(["West"]);
  expect((await optionAt(page, 1)).series[0]?.data).toHaveLength(13);
  await expect(page.getByText("Page 1 of 4 · 39 rows")).toHaveCount(1);
  await expect(page.getByText("Page 1 of 2 · 13 rows")).toHaveCount(1);
  await expect(page.getByText("Page 1 of 14 · 140 rows")).toHaveCount(1);

  // Session state — the URL stays bare — and the consumers' re-query did
  // reach the worker.
  await expect(page).toHaveURL(/weekly-review$/);
  expect(await workerPosts(page)).toBeGreaterThan(posts);

  // Clicking the same bar clears: every consumer re-queries unfiltered.
  await page.mouse.click(westBar.x, westBar.y);
  await expect
    .poll(async () => (await optionAt(page, 1)).series.map((s) => s.name))
    .toEqual(["North", "South", "West"]);
  await expect(page.getByText("Page 1 of 4 · 39 rows")).toHaveCount(2);
  await expect(page.getByText("Page 1 of 14 · 140 rows")).toHaveCount(0);
  // The Amount slider's seed followed West's narrower bounds without
  // publishing, so it widens back with them — no stale 43–44 window.
  await expect(page.getByRole("slider", { name: "Minimum" })).toHaveAttribute(
    "aria-valuenow",
    "38",
  );

  expect(errors).toEqual([]);
});

test("a histogram brush cross-filters the amount consumers while the histogram holds its bins", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);
  const posts = await workerPosts(page);

  // Baseline: 15 bins over amounts 38..44; the order_detail <Table> pages
  // all 355 orders.
  expect((await optionAt(page, 2)).xAxis[0]?.data).toHaveLength(15);
  const table = orderDetailTable(page);
  await expect(table).toHaveCount(1);
  await expect(table).toContainText("· 355 rows");

  // Drag center-of-bin-0 → center-of-bin-3: the clause spans the covered
  // edges [38, 39.6], narrowing order_detail to the 95 orders under $40.
  await chartHosts(page).nth(2).scrollIntoViewIfNeeded();
  const from = await chartPoint(page, 2, [0, 60]);
  const to = await chartPoint(page, 2, [3, 60]);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  // The publisher's own clause skips it — all 15 bins hold — while the
  // amount-filtered order_detail re-queries to the covered rows; the
  // region-filtered scatter is untouched.
  await expect(table).toContainText("· 95 rows");
  expect((await optionAt(page, 2)).xAxis[0]?.data).toHaveLength(15);
  expect((await optionAt(page, 1)).series.map((s) => s.name)).toEqual([
    "North",
    "South",
    "West",
  ]);

  // Session state — the URL stays bare — and the consumers' re-query did
  // reach the worker.
  await expect(page).toHaveURL(/weekly-review$/);
  expect(await workerPosts(page)).toBeGreaterThan(posts);

  // A plain click on the panel clears the brush: order_detail re-queries
  // unfiltered.
  const clear = await chartPoint(page, 2, [10, 60]);
  await page.mouse.click(clear.x, clear.y);
  await expect(table).toContainText("· 355 rows");

  expect(errors).toEqual([]);
});

/** How many brush areas chart host `index` holds in its echarts model. */
function brushAreaCount(page: Page, index: number): Promise<number> {
  return page.evaluate((i) => {
    const host = document.querySelectorAll<HTMLElement>("[data-echarts-theme]")[
      i
    ];
    const chart = (
      host as unknown as {
        echartsInstance?: {
          getModel(): {
            getComponent(type: string): { areas?: unknown[] } | undefined;
          };
        };
      }
    ).echartsInstance;
    if (!chart) throw new Error(`chart host ${i} has no echartsInstance`);
    return chart.getModel().getComponent("brush")?.areas?.length ?? 0;
  }, index);
}

test("a held histogram brush survives the histogram's own re-query when a region is picked", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);
  const table = orderDetailTable(page);
  await expect(table).toContainText("· 355 rows");
  // Bins 12–13 hold 60 of West's 140 orders and nothing else — the
  // brushed amount clause is what tells the West counts apart.
  await chartHosts(page).nth(2).scrollIntoViewIfNeeded();
  const from = await chartPoint(page, 2, [12, 60]);
  const to = await chartPoint(page, 2, [13, 60]);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect(table).toContainText("· 60 rows");
  // Tag the host: a remount (the loading face swapped in) drops the tag.
  await chartHosts(page)
    .nth(2)
    .evaluate((host) => host.setAttribute("data-kept", ""));

  await page.getByRole("combobox", { name: "Region" }).click();
  await page.getByRole("option", { name: "West" }).click();

  // The region-filtered histogram repaints West's 140 orders on the same
  // mounted canvas; its brush stays held, so order_detail keeps the clause.
  await expect(page).toHaveURL(/region=West/);
  await expect
    .poll(async () =>
      (await optionAt(page, 2)).series
        .flatMap((s) => s.data ?? [])
        .reduce<number>((sum, n) => sum + Number(n), 0),
    )
    .toBe(140);
  await expect(chartHosts(page).nth(2)).toHaveAttribute("data-kept", "");
  await expect(table).toContainText("· 60 rows");
  expect(await brushAreaCount(page, 2)).toBe(1);
  expect(errors).toEqual([]);
});

test("a scatter legend toggle cross-filters the region consumers while the scatter holds its series", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);
  const posts = await workerPosts(page);
  const table = orderDetailTable(page);

  // Baseline: the scatter plots all three regions; two pagers read
  // "39 rows" and the order_detail <Table> pages all 355 orders.
  expect((await optionAt(page, 1)).series.map((s) => s.name)).toEqual([
    "North",
    "South",
    "West",
  ]);
  await expect(page.getByText("Page 1 of 4 · 39 rows")).toHaveCount(2);
  await expect(table).toContainText("· 355 rows");

  // North off → `region IN ('South', 'West')`: the keepMounted region_week
  // <Table> drops to 26 weeks and order_detail to 235 orders, while the
  // scatter's own clause skips it — every series stays in its option and
  // only the legend's native hide applies.
  const north = await legendItemPoint(page, 1, "North");
  await page.mouse.click(north.x, north.y);
  await expect(page.getByText("Page 1 of 3 · 26 rows")).toHaveCount(1);
  await expect(page.getByText("Page 1 of 4 · 39 rows")).toHaveCount(1);
  await expect(table).toContainText("· 235 rows");
  const scatter = await optionAt(page, 1);
  expect(scatter.series.map((s) => s.name)).toEqual(["North", "South", "West"]);
  expect(scatter.legend[0]?.selected?.North).toBe(false);

  // Session state — the URL stays bare — and the consumers' re-query did
  // reach the worker.
  await expect(page).toHaveURL(/weekly-review$/);
  expect(await workerPosts(page)).toBeGreaterThan(posts);

  // North back on enables every name: the clause clears and every
  // consumer re-queries unfiltered.
  await page.mouse.click(north.x, north.y);
  await expect(page.getByText("Page 1 of 4 · 39 rows")).toHaveCount(2);
  await expect(table).toContainText("· 355 rows");
  expect((await optionAt(page, 1)).legend[0]?.selected?.North).toBe(true);

  expect(errors).toEqual([]);
});
