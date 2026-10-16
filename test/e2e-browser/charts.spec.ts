import type { Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expect,
  instrumentWorkerPosts,
  test,
  testBadRefs,
  workerPosts,
} from "./dev-server.fixture.js";
import { readRootToken } from "./contrast.js";
import {
  axisTickTexts,
  chartHosts,
  chartPaintAt,
  openWeeklyReviewCharts,
  optionAt,
  pointLabelTexts,
  readyCharts,
} from "./echart-hosts.js";

test.beforeEach(async ({ page }) => {
  // Charts are registry reads — every worker post after first render would
  // mean a re-query leaked in.
  await instrumentWorkerPosts(page);
});

test("weekly-review renders the six charts bound to their fences", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review`);

  const hosts = chartHosts(page);
  await expect(readyCharts(page)).toHaveCount(6);

  // The aria description is generated from the tag's column bindings.
  await expect(hosts.nth(0)).toHaveAttribute("role", "img");
  await expect(hosts.nth(0)).toHaveAttribute(
    "aria-label",
    "bar chart of revenue by region",
  );
  await expect(hosts.nth(1)).toHaveAttribute(
    "aria-label",
    "scatter chart of revenue by orders, split by region",
  );
  await expect(hosts.nth(2)).toHaveAttribute(
    "aria-label",
    "histogram chart of amount",
  );
  await expect(hosts.nth(3)).toHaveAttribute(
    "aria-label",
    "line chart of orders by week, split by region",
  );
  await expect(hosts.nth(4)).toHaveAttribute(
    "aria-label",
    "area chart of orders by week, split by region",
  );
  await expect(hosts.nth(5)).toHaveAttribute(
    "aria-label",
    "heatmap chart of orders by week and region",
  );

  // The canvas renderer paints real pixels at the default 300px height —
  // the heatmap splits across zrender layers, so probe the first canvas.
  for (const host of await hosts.all()) {
    const box = await host.locator("canvas").first().boundingBox();
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
  const line = await optionAt(page, 3);
  expect(line.series.map((s) => s.name)).toEqual(["North", "South", "West"]);
  expect(line.series.every((s) => s.type === "line")).toBe(true);
  expect(line.legend.length).toBeGreaterThan(0);

  // Area: the same fence normalized — stacked series on a pinned 0–1 axis.
  const area = await optionAt(page, 4);
  expect(area.series.every((s) => s.stack === "total")).toBe(true);
  expect(area.series.every((s) => s.areaStyle !== undefined)).toBe(true);
  expect(area.yAxis[0]?.max).toBe(1);

  const posts = await workerPosts(page);
  expect(await workerPosts(page)).toBe(posts);
  expect(errors).toEqual([]);
});

test("the Regional split's ticks and bar labels read in one unit", async ({
  page,
  biacDev,
}) => {
  await openWeeklyReviewCharts(page, biacDev.url);

  const ticks = await axisTickTexts(page, 0, "yAxis");
  const labels = await pointLabelTexts(page, 0);

  // Revenue tops out past 6,000, so the whole axis scales to thousands —
  // no `3,000` beside `6k` — and the baseline stays a bare zero.
  expect(ticks[0]).toBe("0");
  expect(ticks.length).toBeGreaterThan(2);
  for (const tick of ticks.slice(1)) expect(tick).toMatch(/^\d+k$/);
  expect(labels).toEqual(["6k", "5k", "4k"]);
});

test("whole-number axes tick on whole numbers", async ({ page, biacDev }) => {
  await openWeeklyReviewCharts(page, biacDev.url);

  // Order counts and week numbers are whole: no `5.0`, no half-week tick.
  const wholeAxes = [
    await axisTickTexts(page, 1, "xAxis"),
    await axisTickTexts(page, 3, "xAxis"),
    await axisTickTexts(page, 3, "yAxis"),
    await axisTickTexts(page, 4, "xAxis"),
  ];
  for (const ticks of wholeAxes) {
    expect(ticks.length).toBeGreaterThan(2);
    for (const tick of ticks) expect(tick).toMatch(/^[\d,]+$/);
  }

  // The 100% stack's axis is fractions of one and keeps its percent ticks.
  const shares = await axisTickTexts(page, 4, "yAxis");
  expect(shares.at(-1)).toBe("100%");
  expect(shares).toContain("20%");
});

test("the scatter, histogram and heatmap apply their own option shapes", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);

  // Scatter: sparse [x,y] tuples on a value x-axis — one point per
  // region-week, one series per region, uniform 9px points (no `size`).
  const scatter = await optionAt(page, 1);
  expect(scatter.series.map((s) => s.name)).toEqual(["North", "South", "West"]);
  expect(scatter.series.every((s) => s.type === "scatter")).toBe(true);
  expect(scatter.xAxis[0]?.type).toBe("value");
  for (const s of scatter.series) {
    expect(s.data).toHaveLength(13);
    expect(s.symbolSize).toBe(9);
  }

  // Histogram: 355 amounts binned client-side at the rice-rule default —
  // ceil(2·∛355) = 15 dense bins on a category axis, one stacked gapless
  // bar series labelled Frequency on the y axis.
  const histogram = await optionAt(page, 2);
  expect(histogram.xAxis[0]?.data).toHaveLength(15);
  expect(histogram.series[0]?.type).toBe("bar");
  expect(histogram.series[0]?.stack).toBe("total");
  expect(histogram.series[0]?.barCategoryGap).toBe(0);
  expect(histogram.yAxis[0]?.name).toBe("Frequency");

  // Heatmap: the weekly_trend fence pivoted to 39 [xi,yi,v] cells on dual
  // category axes — 13 week columns x North/South/West rows — with a
  // continuous visualMap spanning the observed 4..22 order counts.
  const heatmap = await optionAt(page, 5);
  expect(heatmap.series[0]?.type).toBe("heatmap");
  expect(heatmap.series[0]?.data).toHaveLength(39);
  expect(heatmap.xAxis[0]?.data).toHaveLength(13);
  expect(heatmap.yAxis[0]?.data).toEqual(["North", "South", "West"]);
  expect(heatmap.visualMap?.[0]?.min).toBe(4);
  expect(heatmap.visualMap?.[0]?.max).toBe(22);

  const posts = await workerPosts(page);
  expect(await workerPosts(page)).toBe(posts);
  expect(errors).toEqual([]);
});

test("hovering the line chart shows an axis tooltip listing all regions", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);
  const posts = await workerPosts(page);

  // The tooltip is an html div appended inside the chart host; an axis
  // trigger at mid-chart lists every series at the hovered week.
  const line = chartHosts(page).nth(3);
  await line.hover();
  const tip = line.locator("div", { hasText: "North:" });
  await expect(tip).toHaveCount(1);
  await expect(tip).toContainText("South:");
  await expect(tip).toContainText("West:");

  expect(await workerPosts(page)).toBe(posts);
  expect(errors).toEqual([]);
});

/**
 * Pops the tooltip on a chart's first datum without hunting for its pixels —
 * `dispatchAction` runs the real formatter and renders the tooltip div,
 * where a blind `hover()` on an item-trigger chart lands between points.
 */
function showTipAt(page: Page, hostIndex: number): Promise<void> {
  return page.evaluate((i) => {
    const host = document.querySelectorAll<HTMLElement>("[data-echarts-theme]")[
      i
    ];
    const chart = (
      host as unknown as {
        echartsInstance?: {
          dispatchAction(action: {
            type: string;
            seriesIndex: number;
            dataIndex: number;
          }): void;
        };
      }
    ).echartsInstance;
    if (!chart) throw new Error(`chart host ${i} has no echartsInstance`);
    chart.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: 0 });
  }, hostIndex);
}

test("the scatter, histogram and heatmap tooltips name their bound columns", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);
  const posts = await workerPosts(page);

  // Scatter item tooltip: the series marker/name, then one row per bound
  // column — x (orders), y (revenue).
  const scatter = chartHosts(page).nth(1);
  await showTipAt(page, 1);
  const scatterTip = scatter.locator("div", { hasText: "orders:" });
  await expect(scatterTip).toHaveCount(1);
  await expect(scatterTip).toContainText("revenue:");

  // Histogram axis tooltip: the hovered bin's range title, then the
  // Frequency series' count row.
  const histogram = chartHosts(page).nth(2);
  await histogram.hover();
  const histogramTip = histogram.locator("div", { hasText: "Frequency:" });
  await expect(histogramTip).toHaveCount(1);
  await expect(histogramTip).toContainText("–");

  // Heatmap item tooltip: one row per bound column — x (week), y (region),
  // value (orders); the first cell is week 1's 14 North orders.
  const heatmap = chartHosts(page).nth(5);
  await showTipAt(page, 5);
  const heatmapTip = heatmap.locator("div", { hasText: "week:" });
  await expect(heatmapTip).toHaveCount(1);
  await expect(heatmapTip).toContainText("region:");
  await expect(heatmapTip).toContainText("orders:");

  expect(await workerPosts(page)).toBe(posts);
  expect(errors).toEqual([]);
});

/** Click the chrome toggle and wait for all six hosts to re-theme. */
async function toggleTheme(page: Page, target: "dark" | "light") {
  await page.getByRole("button", { name: `Switch to ${target} mode` }).click();
  await expect(page.locator(`[data-echarts-theme="${target}"]`)).toHaveCount(6);
  await expect(readyCharts(page)).toHaveCount(6);
}

test("a tooltip shown at 1280 px never widens the page at 375 px", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await openWeeklyReviewCharts(page, biacDev.url);

  // The engine hides its tooltip with visibility/opacity only, so the box
  // it leaves behind must not count toward the document's scroll width —
  // moving off the chart first proves a hidden tip is contained too.
  const bars = chartHosts(page).nth(0);
  await bars.hover();
  await expect(bars.locator("> div", { hasText: "revenue" })).toHaveCount(1);
  await page.mouse.move(5, 5);
  await page.setViewportSize({ width: 375, height: 812 });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      }),
    )
    .toBe(0);
  expect(errors).toEqual([]);
});

test("the area chart's tooltip is drawn whole inside its chart at 375 px", async ({
  page,
  biacDev,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openWeeklyReviewCharts(page, biacDev.url);

  // Mid-chart is where the engine's own edge flip pushes an unconfined tip
  // past the chart's left edge on a phone-width host.
  const area = chartHosts(page).nth(4);
  await area.hover();
  const tip = area.locator("> div", { hasText: /\S/ });
  await expect(tip).toBeVisible();

  const hostBox = await area.boundingBox();
  const tipBox = await tip.boundingBox();
  if (!hostBox || !tipBox)
    throw new Error("the area chart host and its tooltip must both have a box");
  expect(tipBox.x).toBeGreaterThanOrEqual(hostBox.x);
  expect(tipBox.x + tipBox.width).toBeLessThanOrEqual(
    hostBox.x + hostBox.width,
  );
});

test("the theme toggle repaints every chart in the other palette", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);

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
  const lightRamp = (await optionAt(page, 5)).visualMap?.[0]?.inRange
    ?.color?.[0];
  // The Regional split's bar labels take each mode's muted text color from
  // the chart theme — `--muted-foreground` on white and on near-black.
  expect((await optionAt(page, 0)).series[0]?.label?.color).toBe("#525252");

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
  expect(probes).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ]);

  // The heatmap's ramp is baked into the option — re-anchored to the dark
  // surface, not carried over from the light instance.
  const darkRamp = (await optionAt(page, 5)).visualMap?.[0]?.inRange
    ?.color?.[0];
  expect(darkRamp).not.toBe(lightRamp);
  expect((await optionAt(page, 0)).series[0]?.label?.color).toBe("#a1a1a1");

  await toggleTheme(page, "light");

  // A repaint is client-side theme work — no re-query reaches the worker.
  expect(await workerPosts(page)).toBe(posts);
  expect(errors).toEqual([]);
});

/** The colours every chart should paint, read off the root's theme tokens. */
async function tokenPaint(page: Page) {
  const token = (name: string) => readRootToken(page, name);
  return {
    axisLabel: await token("--muted-foreground"),
    axisLine: await token("--chart-axis"),
    splitLine: await token("--border"),
    tooltipBackground: await token("--popover"),
    tooltipBorder: await token("--popover-border"),
    firstSeries: await token("--chart-1"),
  };
}

/** Asserts the Regional split's bars paint from the root's current tokens. */
async function expectChartPaintsTokens(page: Page): Promise<void> {
  expect(await chartPaintAt(page, 0)).toEqual(await tokenPaint(page));
}

test("every chart colour follows the theme tokens through a light, dark, light round trip", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await openWeeklyReviewCharts(page, biacDev.url);
  await expectChartPaintsTokens(page);

  await toggleTheme(page, "dark");
  await expectChartPaintsTokens(page);
  expect((await chartPaintAt(page, 0)).splitLine).toBe("#262626");

  // Back to light: the charts re-init before `<html>` drops `.dark`, so
  // only a token read that names its own mode lands on the light values.
  await toggleTheme(page, "light");
  await expectChartPaintsTokens(page);
  expect((await chartPaintAt(page, 0)).splitLine).toBe("#e5e5e5");
  expect(errors).toEqual([]);
});

test("an edited token reaches the charts on the next theme flip", async ({
  page,
  biacDev,
}) => {
  await openWeeklyReviewCharts(page, biacDev.url);

  // Edit the light token rule itself, as DevTools' Styles pane does.
  await page.evaluate(() => {
    const rule = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .find(
        (r): r is CSSStyleRule =>
          r instanceof CSSStyleRule && r.selectorText === ":root, .light",
      );
    if (!rule) throw new Error("no `:root, .light` token rule in the page");
    rule.style.setProperty("--border", "#ff00ff");
  });
  await toggleTheme(page, "dark");
  await toggleTheme(page, "light");

  expect((await chartPaintAt(page, 0)).splitLine).toBe("#ff00ff");
});

test("?region=Atlantis is pruned by the Region dropdown so every chart stays live", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review?region=Atlantis`);

  // Atlantis is not a region option: the dropdown validates the URL value
  // against its loaded options, drops the stale param, and all six charts
  // render their unfiltered read — no empty faces.
  await expect(page).toHaveURL(/weekly-review$/);
  await expect(page.locator("[data-chart-empty]")).toHaveCount(0);
  await expect(readyCharts(page)).toHaveCount(6);
  expect(errors).toEqual([]);
});

/**
 * Stand in for a loaded host: while `window.__slowHeatmapFill` is set, every
 * `fill()` on a canvas inside the heatmap busy-waits 16 ms — one tick past
 * zrender's 15 ms incremental-layer budget. Wire before the first `goto`.
 */
async function slowHeatmapFill(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fill = CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.fill = function (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ) {
      const slow = (window as { __slowHeatmapFill?: boolean })
        .__slowHeatmapFill;
      if (slow && this.canvas.closest('[aria-label^="heatmap chart"]')) {
        const until = performance.now() + 16;
        while (performance.now() < until);
      }
      Reflect.apply(fill, this, args);
    };
  });
}

test("a theme flip mid-paint disposes the heatmap without its paint frame reading it", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await slowHeatmapFill(page);
  await openWeeklyReviewCharts(page, biacDev.url);

  // echarts marks every heatmap rect incremental, so zrender paints the
  // heatmap under a 15 ms budget and queues the rest for the next frame.
  // With each rect over budget, the 39 cells paint one per frame — the
  // next flip re-inits, so disposes, the heatmap while that frame is queued.
  await page.evaluate(() => {
    (window as { __slowHeatmapFill?: boolean }).__slowHeatmapFill = true;
  });
  for (const target of ["dark", "light", "dark", "light"] as const) {
    await toggleTheme(page, target);
  }
  await page.evaluate(() => {
    (window as { __slowHeatmapFill?: boolean }).__slowHeatmapFill = false;
  });
  await expect(readyCharts(page)).toHaveCount(6);
  expect(errors).toEqual([]);
});

test("?region=West narrows the filter-declaring charts while the trend charts stay whole", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${biacDev.url}weekly-review?region=West`);
  await expect(readyCharts(page)).toHaveCount(6);

  // Bar: the wrapped `orders` read — one region, one bar.
  const bar = await optionAt(page, 0);
  expect(bar.xAxis[0]?.data).toEqual(["West"]);
  expect(bar.series[0]?.data).toHaveLength(1);

  // Scatter: the wrapped `region_week` read — the 13 West weeks.
  const scatter = await optionAt(page, 1);
  expect(scatter.series.map((s) => s.name)).toEqual(["West"]);
  expect(scatter.series[0]?.data).toHaveLength(13);

  // Line: weekly_trend carries no filter — all three regions stay.
  const line = await optionAt(page, 3);
  expect(line.series.map((s) => s.name)).toEqual(["North", "South", "West"]);

  const posts = await workerPosts(page);
  expect(await workerPosts(page)).toBe(posts);
  expect(errors).toEqual([]);
});

test("the index page renders a <BarChart> beside its <Table>", async ({
  page,
  biacDev,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(biacDev.url);

  const host = chartHosts(page);
  await expect(readyCharts(page)).toHaveCount(1);
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
    // `data="orders"` alone would hit the <Dropdown>, the page's first
    // occurrence — the x prop anchors the mutation on the <BarChart>.
    from: 'data="orders" x="region"',
    to: 'data="ghost_query" x="region"',
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
    want: [
      'column "regeon" is not in the result',
      "week, region, orders, revenue",
    ],
  },
  {
    name: "an unknown histogram value column",
    from: 'value="amount"',
    to: 'value="amoun"',
    want: ['column "amoun" is not in the result', "amount"],
  },
  {
    name: "an unknown heatmap value column",
    from: 'value="orders"',
    to: 'value="ordrs"',
    want: ['column "ordrs" is not in the result', "week, region, orders"],
  },
] as const;

// `series="region"`'s first occurrence sits on the <ScatterChart>,
// `value=` on the <Histogram>/<Heatmap>; the other mutations hit the
// <BarChart>. Either way one widget alerts and the other five stand.
testBadRefs(
  "weekly-review",
  "pages/weekly-review.md",
  BAD_CHART_REFS,
  async (page) => {
    await expect(
      page.getByRole("heading", { name: "Weekly review" }),
    ).toBeVisible();
    await expect(readyCharts(page)).toHaveCount(5);
  },
);
