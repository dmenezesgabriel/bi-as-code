import type { Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./dev-server.fixture.js";
import { chartHosts, openWeeklyReviewCharts } from "./echart-hosts.js";

const WEEKLY_REVIEW_TITLES = [
  ["Revenue by region", "Sum of order amounts, US dollars"],
  [
    "Orders and revenue per region-week",
    "One point per region and week; revenue in US dollars",
  ],
  ["Order amounts", "Orders per amount bin, US dollars"],
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
  await expect(page.getByRole("figure")).toHaveCount(3);
  await expect(chartHosts(page)).toHaveCount(6);
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
