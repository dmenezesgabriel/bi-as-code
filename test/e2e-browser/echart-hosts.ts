import type { Locator, Page } from "@playwright/test";
import { expect } from "./dev-server.fixture.js";

/**
 * The option shape a test reads back off the live echarts instance — the
 * host element carries `echartsInstance` so browser assertions can inspect
 * what `setOption` actually applied, same as the web-unit suite.
 */
export interface AppliedOption {
  series: {
    name?: string;
    type?: string;
    stack?: string;
    areaStyle?: unknown;
    label?: { show?: boolean; color?: string };
    data?: unknown[];
    symbolSize?: unknown;
    barCategoryGap?: unknown;
  }[];
  xAxis: { type?: string; name?: string; data?: unknown[] }[];
  yAxis: {
    max?: number;
    name?: string;
    data?: unknown[];
    axisLabel?: { show?: boolean };
    splitLine?: { show?: boolean };
  }[];
  legend: { selected?: Record<string, boolean> }[];
  visualMap?: { min?: number; max?: number; inRange?: { color?: string[] } }[];
}

/** A viewport-space point, ready for `page.mouse`. */
export interface PagePoint {
  x: number;
  y: number;
}

/**
 * The page-space point at data coordinate `[x, y]` on chart host
 * `hostIndex` — `convertToPixel` maps it into the host's own pixels, then
 * the host's bounding rect lifts them to viewport space.
 */
export async function chartPoint(
  page: Page,
  hostIndex: number,
  value: [number, number],
): Promise<PagePoint> {
  return page.evaluate(
    ([hi, v]) => {
      const host = document.querySelectorAll<HTMLElement>(
        "[data-echarts-theme]",
      )[hi];
      if (!host) throw new Error(`chart host ${hi} not in the document`);
      const chart = (
        host as unknown as {
          echartsInstance?: {
            convertToPixel(finder: unknown, value: unknown[]): number[];
          };
        }
      ).echartsInstance;
      if (!chart) throw new Error(`chart host ${hi} has no echartsInstance`);
      const [x, y] = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, v);
      if (x === undefined || y === undefined)
        throw new Error(`convertToPixel returned no point for ${String(v)}`);
      const rect = host.getBoundingClientRect();
      return { x: rect.left + x, y: rect.top + y };
    },
    [hostIndex, value] as const,
  );
}

/**
 * Chart hosts in document order — on weekly-review that's the Regional
 * split's <BarChart>, the Order mix <ScatterChart>, the Order size
 * <Histogram>, then the Trend lines' <LineChart>/<AreaChart>/<Heatmap>.
 * `data-echarts-theme` marks the host immediately; `data-echarts-ready`
 * lands on the first finished paint, so readiness waits on the latter.
 */
export function chartHosts(page: Page): Locator {
  return page.locator("[data-echarts-theme]");
}

export function readyCharts(page: Page): Locator {
  return page.locator("[data-echarts-ready]");
}

export function optionAt(page: Page, index: number): Promise<AppliedOption> {
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

/** The live-instance surface the label readers below reach through. */
interface LabelledChart {
  getOption(): Record<
    string,
    {
      data?: unknown[];
      axisLabel?: { formatter?: (value: number, index: number) => string };
      label?: { formatter?: (params: { value: unknown }) => string };
    }[]
  >;
  getModel(): {
    getComponent(
      axis: string,
      index: number,
    ): { axis: { scale: { getTicks(): { value: number }[] } } };
  };
}

/**
 * The tick texts chart host `hostIndex` paints on a value axis: the ticks
 * the live scale settled on, run through the applied `axisLabel.formatter`
 * — the canvas renderer leaves no DOM text to read them from.
 */
export function axisTickTexts(
  page: Page,
  hostIndex: number,
  axis: "xAxis" | "yAxis",
): Promise<string[]> {
  return page.evaluate(
    ([hi, name]) => {
      const host = document.querySelectorAll<HTMLElement>(
        "[data-echarts-theme]",
      )[hi];
      const chart = (host as unknown as { echartsInstance?: LabelledChart })
        .echartsInstance;
      if (!chart) throw new Error(`chart host ${hi} has no echartsInstance`);
      const formatter = chart.getOption()[name]?.[0]?.axisLabel?.formatter;
      if (!formatter)
        throw new Error(`chart host ${hi} ${name} has no formatter`);
      const ticks = chart
        .getModel()
        .getComponent(name, 0)
        .axis.scale.getTicks();
      return ticks.map((tick, index) => formatter(tick.value, index));
    },
    [hostIndex, axis] as const,
  );
}

/** One painted canvas string and its box, in the chart host's pixels. */
export interface PaintedText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Every string chart host `hostIndex` paints — tick labels, axis names,
 * legend items, data labels — with its transformed bounding box, and the
 * canvas size they must fit in. Hidden elements (e.g. ticks thinned by
 * `hideOverlap`) are left out, so the boxes are what a reader sees.
 */
export function paintedTexts(
  page: Page,
  hostIndex: number,
): Promise<{ width: number; height: number; texts: PaintedText[] }> {
  return page.evaluate((hi) => {
    const host = document.querySelectorAll<HTMLElement>("[data-echarts-theme]")[
      hi
    ];
    const chart = (host as unknown as { echartsInstance?: PaintedChart })
      .echartsInstance;
    if (!chart) throw new Error(`chart host ${hi} has no echartsInstance`);
    const texts = chart
      .getZr()
      .storage.getDisplayList(true)
      .filter(
        (el) => typeof el.style?.text === "string" && el.style.text !== "",
      )
      .map((el) => {
        const box = el.getBoundingRect().clone();
        if (el.transform) box.applyTransform(el.transform);
        const { x, y, width, height } = box;
        return { text: el.style!.text!, x, y, width, height };
      });
    return { width: chart.getWidth(), height: chart.getHeight(), texts };
  }, hostIndex);
}

interface PaintedBox {
  x: number;
  y: number;
  width: number;
  height: number;
  clone(): PaintedBox;
  applyTransform(matrix: number[]): void;
}

/** The zrender surface `paintedTexts` walks. */
interface PaintedChart {
  getWidth(): number;
  getHeight(): number;
  getZr(): {
    storage: {
      getDisplayList(update: boolean): {
        style?: { text?: string };
        transform?: number[];
        getBoundingRect(): PaintedBox;
      }[];
    };
  };
}

/**
 * The point-label texts of chart host `hostIndex`'s first series — each
 * data point run through the applied `label.formatter`.
 */
export function pointLabelTexts(
  page: Page,
  hostIndex: number,
): Promise<string[]> {
  return page.evaluate((hi) => {
    const host = document.querySelectorAll<HTMLElement>("[data-echarts-theme]")[
      hi
    ];
    const chart = (host as unknown as { echartsInstance?: LabelledChart })
      .echartsInstance;
    if (!chart) throw new Error(`chart host ${hi} has no echartsInstance`);
    const series = chart.getOption()["series"]?.[0];
    const formatter = series?.label?.formatter;
    if (!formatter) throw new Error(`chart host ${hi} has no label formatter`);
    return (series?.data ?? []).map((value) => formatter({ value }));
  }, hostIndex);
}

/** How many charts `pages/weekly-review.md` draws. */
export const WEEKLY_REVIEW_CHART_COUNT = 7;

/**
 * Opens weekly-review on the dev server at `url` and waits for all its
 * charts' first finished paint — the baseline every chart spec reads from.
 */
export async function openWeeklyReviewCharts(
  page: Page,
  url: string,
): Promise<void> {
  await page.goto(`${url}weekly-review`);
  await expect(readyCharts(page)).toHaveCount(WEEKLY_REVIEW_CHART_COUNT);
}

/** The colours a chart's live model resolved from its theme and option. */
export interface ChartPaint {
  axisLabel: string;
  axisLine: string;
  splitLine: string;
  tooltipBackground: string;
  tooltipBorder: string;
  firstSeries: string;
}

/**
 * The colours chart host `hostIndex` paints its first category/value axis
 * pair and tooltip with — read off the engine's merged model, so a theme
 * colour and an option colour read alike.
 */
export function chartPaintAt(
  page: Page,
  hostIndex: number,
): Promise<ChartPaint> {
  return page.evaluate((hi) => {
    type Model = { get(path: string | string[]): string };
    const host = document.querySelectorAll<HTMLElement>("[data-echarts-theme]")[
      hi
    ];
    const chart = (
      host as unknown as {
        echartsInstance?: {
          getModel(): { getComponent(type: string, index: number): Model };
          getOption(): { color?: string[] };
        };
      }
    ).echartsInstance;
    if (!chart) throw new Error(`chart host ${hi} has no echartsInstance`);
    const model = chart.getModel();
    const xAxis = model.getComponent("xAxis", 0);
    const yAxis = model.getComponent("yAxis", 0);
    const tooltip = model.getComponent("tooltip", 0);
    return {
      axisLabel: xAxis.get(["axisLabel", "color"]),
      axisLine: xAxis.get(["axisLine", "lineStyle", "color"]),
      splitLine: yAxis.get(["splitLine", "lineStyle", "color"]),
      tooltipBackground: tooltip.get("backgroundColor"),
      tooltipBorder: tooltip.get("borderColor"),
      firstSeries: chart.getOption().color?.[0] ?? "",
    };
  }, hostIndex);
}
