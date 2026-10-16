import type { Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import {
  chartHosts,
  openWeeklyReviewCharts,
  optionAt,
  paintedTexts,
  type PaintedText,
  WEEKLY_REVIEW_CHART_COUNT,
} from "./echart-hosts.js";

const WEEKLY_REVIEW_TITLES = [
  ["Revenue by region", "Sum of order amounts, US dollars"],
  [
    "Orders and revenue per region-week",
    "One point per region and week; revenue in US dollars",
  ],
  ["Order amounts", "Orders per amount bin, US dollars"],
  ["Orders by region and weekday", "One bar per weekday, Monday first"],
] as const;

/** The `title` component of every chart's live echarts model, flattened. */
function canvasTitles(page: Page): Promise<unknown[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-echarts-theme]")].flatMap((host) => {
      const chart = (
        host as unknown as {
          echartsInstance?: { getOption(): { title?: unknown[] } };
        }
      ).echartsInstance;
      return chart?.getOption().title ?? [];
    }),
  );
}

test("weekly-review titles its charts in text above the plot", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);

  for (const [title, subtitle] of WEEKLY_REVIEW_TITLES) {
    const figure = page.getByRole("figure", { name: title });
    await expect(figure.getByText(subtitle, { exact: true })).toBeVisible();
    const host = figure.locator("[data-echarts-theme]");
    const subtitleBox = await figure.getByText(subtitle).boundingBox();
    const hostBox = await host.boundingBox();
    expect(subtitleBox!.y + subtitleBox!.height).toBeLessThanOrEqual(
      hostBox!.y,
    );
  }
  // The trend charts carry no title, so no figure wraps them.
  await expect(page.getByRole("figure")).toHaveCount(
    WEEKLY_REVIEW_TITLES.length,
  );
  await expect(chartHosts(page)).toHaveCount(WEEKLY_REVIEW_CHART_COUNT);
  expect(await canvasTitles(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("chart titles stay out of the page's table of contents", async ({
  page,
  biacDev,
}) => {
  await openWeeklyReviewCharts(page, biacDev.url);

  const toc = page.getByRole("navigation", { name: "On this page" });
  const entries = await toc.getByRole("link").allTextContents();

  expect(entries).toEqual([
    "Overview",
    "Regional split",
    "Order mix",
    "Order size",
    "Trend lines",
    "Quarter detail",
    "Takeaways",
  ]);
});

/** Whether two painted boxes share any area — touching edges don't count. */
function overlaps(a: PaintedText, b: PaintedText): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** Asserts chart host `hostIndex` paints `name` whole and on its own. */
async function expectAxisTitleClear(
  page: Page,
  hostIndex: number,
  name: string,
): Promise<void> {
  const { width, height, texts } = await paintedTexts(page, hostIndex);
  const title = texts.find((t) => t.text === name);
  expect(title, `axis title "${name}" painted`).toBeDefined();
  expect(title!.x).toBeGreaterThanOrEqual(0);
  expect(title!.y).toBeGreaterThanOrEqual(0);
  expect(title!.x + title!.width).toBeLessThanOrEqual(width);
  expect(title!.y + title!.height).toBeLessThanOrEqual(height);
  const collisions = texts.filter((t) => t !== title && overlaps(t, title!));
  expect(collisions.map((t) => t.text)).toEqual([]);
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`axis titles sit whole inside their chart at ${viewport.width} px`, async ({
    page,
    biacDev,
  }) => {
    await page.setViewportSize(viewport);
    await openWeeklyReviewCharts(page, biacDev.url);

    const scatter = await optionAt(page, 1);
    expect(scatter.xAxis[0]?.name).toBe("Orders");
    expect(scatter.yAxis[0]?.name).toBe("Revenue");
    await expectAxisTitleClear(page, 1, "Orders");
    await expectAxisTitleClear(page, 1, "Revenue");
    // The histogram's default count title.
    await expectAxisTitleClear(page, 2, "Frequency");
  });
}
