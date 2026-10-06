import type { Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expect,
  instrumentWorkerPosts,
  test,
  testBadRefs,
  workerPosts,
} from "./dev-server.fixture.js";

/**
 * The option shape a test reads back off the live echarts instance — the
 * host element carries `echartsInstance` so browser assertions can inspect
 * what `setOption` actually applied, same as the web-unit suite.
 */
interface AppliedOption {
  series: {
    name?: string;
    type?: string;
    stack?: string;
    areaStyle?: unknown;
    label?: { show?: boolean };
    data?: unknown[];
  }[];
  xAxis: { data?: unknown[] }[];
  yAxis: { max?: number }[];
  legend: unknown[];
}

/**
 * Chart hosts in document order — on weekly-review that's the Regional
 * split's <BarChart> then the Trend lines' <LineChart>/<AreaChart>.
 * `data-echarts-theme` marks the host immediately; `data-echarts-ready`
 * lands on the first finished paint, so readiness waits on the latter.
 */
function chartHosts(page: Page) {
  return page.locator("[data-echarts-theme]");
}

function readyCharts(page: Page) {
  return page.locator("[data-echarts-ready]");
}

function optionAt(page: Page, index: number): Promise<AppliedOption> {
  return page.evaluate((i) => {
    const host = document.querySelectorAll<HTMLElement>("[data-echarts-theme]")[
      i
    ];
    const chart = (
      host as unknown as { echartsInstance?: { getOption(): unknown } }
    ).echartsInstance;
    if (!chart) throw new Error(`chart host ${i} has no echartsInstance`);
    return chart.getOption() as AppliedOption;
  }, index);
}

test.beforeEach(async ({ page }) => {
  // Charts are registry reads — every worker post after first render would
  // mean a re-query leaked in.
  await instrumentWorkerPosts(page);
});

test("weekly-review renders the three series charts bound to their fences", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const hosts = chartHosts(page);
  await expect(readyCharts(page)).toHaveCount(3, { timeout: 30_000 });

  // The aria description is generated from the tag's column bindings.
  await expect(hosts.nth(0)).toHaveAttribute("role", "img");
  await expect(hosts.nth(0)).toHaveAttribute(
    "aria-label",
    "bar chart of revenue by region",
  );
  await expect(hosts.nth(1)).toHaveAttribute(
    "aria-label",
    "line chart of orders by week, split by region",
  );
  await expect(hosts.nth(2)).toHaveAttribute(
    "aria-label",
    "area chart of orders by week, split by region",
  );

  // The canvas renderer paints real pixels at the default 300px height.
  for (const host of await hosts.all()) {
    const box = await host.locator("canvas").boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
  }

  // Bar: the orders fence's three regions in authored revenue-desc order,
  // per-point labels on.
  const bar = await optionAt(page, 0);
  expect(bar.xAxis[0]?.data).toEqual(["West", "North", "South"]);
  expect(bar.series[0]?.type).toBe("bar");
  expect(bar.series[0]?.label?.show).toBe(true);
  expect(bar.series[0]?.data).toHaveLength(3);

  // Line: weekly_trend's series="region" pivot — one named series per
  // region in first-appearance order, legend on past one series.
  const line = await optionAt(page, 1);
  expect(line.series.map((s) => s.name)).toEqual(["North", "South", "West"]);
  expect(line.series.every((s) => s.type === "line")).toBe(true);
  expect(line.legend.length).toBeGreaterThan(0);

  // Area: the same fence normalized — stacked series on a pinned 0–1 axis.
  const area = await optionAt(page, 2);
  expect(area.series.every((s) => s.stack === "total")).toBe(true);
  expect(area.series.every((s) => s.areaStyle !== undefined)).toBe(true);
  expect(area.yAxis[0]?.max).toBe(1);

  const posts = await workerPosts(page);
  expect(await workerPosts(page)).toBe(posts);
  expect(errors).toEqual([]);
});

test("hovering the line chart shows an axis tooltip listing all regions", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);
  await expect(readyCharts(page)).toHaveCount(3, { timeout: 30_000 });
  const posts = await workerPosts(page);

  // The tooltip is an html div appended inside the chart host; an axis
  // trigger at mid-chart lists every series at the hovered week.
  const line = chartHosts(page).nth(1);
  await line.hover();
  const tip = line.locator("div", { hasText: "North:" });
  await expect(tip).toHaveCount(1);
  await expect(tip).toContainText("South:");
  await expect(tip).toContainText("West:");

  expect(await workerPosts(page)).toBe(posts);
  expect(errors).toEqual([]);
});

/** Click the chrome toggle and wait for all three hosts to re-theme. */
async function toggleTheme(page: Page, target: "dark" | "light") {
  await page.getByRole("button", { name: `Switch to ${target} mode` }).click();
  await expect(page.locator(`[data-echarts-theme="${target}"]`)).toHaveCount(3);
  await expect(readyCharts(page)).toHaveCount(3, { timeout: 30_000 });
}

test("the theme toggle repaints every chart in the other palette", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);
  await expect(readyCharts(page)).toHaveCount(3, { timeout: 30_000 });

  // Mark the live instances: a mode flip re-inits the engine, so a probe
  // property set now must not survive on the post-toggle instances.
  await page.evaluate(() => {
    document
      .querySelectorAll<HTMLElement>("[data-echarts-theme]")
      .forEach((el) => {
        const chart = (el as unknown as { echartsInstance?: unknown })
          .echartsInstance;
        if (chart) (chart as Record<string, unknown>).__probe = "light";
      });
  });
  const posts = await workerPosts(page);

  await toggleTheme(page, "dark");
  const probes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-echarts-theme]")].map(
      (el) =>
        (
          (el as unknown as { echartsInstance?: unknown }).echartsInstance as
            | Record<string, unknown>
            | undefined
        )?.__probe,
    ),
  );
  expect(probes).toEqual([undefined, undefined, undefined]);

  await toggleTheme(page, "light");

  // A repaint is client-side theme work — no re-query reaches the worker.
  expect(await workerPosts(page)).toBe(posts);
  expect(errors).toEqual([]);
});

test("?region=Atlantis empties the orders-bound chart while the unfiltered trend charts stay live", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review?region=Atlantis`);

  // `orders` carries {{params.region}} → 0 rows → the BarChart's empty
  // face reserves the chart's 300px. `weekly_trend` reads the raw table,
  // so the LineChart and AreaChart it feeds still render.
  const empty = page.locator("[data-chart-empty]");
  await expect(empty).toHaveCount(1, { timeout: 30_000 });
  await expect(empty).toContainText("0 rows");
  expect((await empty.boundingBox())?.height).toBe(300);
  await expect(readyCharts(page)).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("the index page renders a <BarChart> beside its <Table>", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(biacDev.url);

  const host = chartHosts(page);
  await expect(readyCharts(page)).toHaveCount(1, { timeout: 30_000 });
  await expect(host).toHaveAttribute(
    "aria-label",
    "bar chart of revenue by region",
  );
  const box = await host.locator("canvas").boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBe(300);

  const option = await optionAt(page, 0);
  expect(option.xAxis[0]?.data).toEqual(["West", "North", "South"]);
  expect(option.series[0]?.data).toHaveLength(3);
  expect(errors).toEqual([]);
});

const BAD_CHART_REFS = [
  {
    name: "an undeclared data name",
    from: 'data="orders"',
    to: 'data="ghost_query"',
    want: ["ghost_query", "no sql fence on this page declares this name"],
  },
  {
    name: "an unknown x column",
    from: 'x="region"',
    to: 'x="regeon"',
    want: ['column "regeon" is not in the result', "region, orders, revenue"],
  },
  {
    name: "an unknown y column",
    from: 'y="revenue"',
    to: 'y="revnue"',
    want: ['column "revnue" is not in the result', "region, orders, revenue"],
  },
  {
    name: "an unknown series column",
    from: 'series="region"',
    to: 'series="regeon"',
    want: ['column "regeon" is not in the result', "week, region, orders"],
  },
] as const;

// `series="region"`'s first occurrence sits on the <LineChart>; the other
// mutations hit the <BarChart>. Either way one widget alerts and the
// other two charts stand.
testBadRefs(
  "weekly-review",
  "pages/weekly-review.md",
  BAD_CHART_REFS,
  async (page) => {
    await expect(
      page.getByRole("heading", { name: "Weekly review" }),
    ).toBeVisible();
    await expect(readyCharts(page)).toHaveCount(2, { timeout: 30_000 });
  },
);
