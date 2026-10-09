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
    label?: { show?: boolean };
    data?: unknown[];
    symbolSize?: unknown;
    barCategoryGap?: unknown;
  }[];
  xAxis: { type?: string; data?: unknown[] }[];
  yAxis: { max?: number; name?: string; data?: unknown[] }[];
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

/**
 * Opens weekly-review on the dev server at `url` and waits for its six
 * charts' first finished paint — the baseline every chart spec reads from.
 */
export async function openWeeklyReviewCharts(
  page: Page,
  url: string,
): Promise<void> {
  await page.goto(`${url}weekly-review`);
  await expect(readyCharts(page)).toHaveCount(6, { timeout: 30_000 });
}
