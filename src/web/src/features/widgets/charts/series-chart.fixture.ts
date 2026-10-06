import { expect, waitFor } from "storybook/test";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import type { SqlBlock } from "../../pages/types";
import type { EChartHostElement } from "./types";

/**
 * Named ```sql fences + canned rows the series-chart tests and stories share:
 * `data` binds to a block name, `FakeDuckDb` supplies the result rows. Mirrors
 * `pages/weekly-review.md` — `week` is a numeric column, `region` a category.
 */

export const ORDERS_REGIONAL: SqlBlock = {
  name: "orders",
  sql: "select region, revenue, orders from orders",
};

export const WEEKLY_TREND: SqlBlock = {
  name: "weekly_trend",
  sql: "select week, region, orders from trend",
};

export const REGIONAL_ROWS: Row[] = [
  { region: "West", revenue: 6100, orders: 140 },
  { region: "North", revenue: 4800, orders: 120 },
  { region: "South", revenue: 3700, orders: 95 },
];

export const TREND_ROWS: Row[] = [
  { week: 1, region: "North", orders: 120 },
  { week: 1, region: "South", orders: 90 },
  { week: 2, region: "North", orders: 130 },
  { week: 2, region: "South", orders: 95 },
  { week: 3, region: "North", orders: 140 },
  { week: 3, region: "South", orders: 100 },
];

/** Every query on the fake returns `rows` — callers bind one fence at a time. */
export function dbWith(rows: Row[]): FakeDuckDb {
  return FakeDuckDb.withRows(rows);
}

/** The host once the first paint of the applied option finishes. */
export async function readyHost(root: ParentNode): Promise<EChartHostElement> {
  const host = await waitFor(() => {
    const el = root.querySelector<EChartHostElement>("[data-echarts-theme]");
    expect(el).toHaveAttribute("data-echarts-ready");
    return el;
  });
  if (!host) throw new Error("chart host not rendered");
  return host;
}

/** The option the live echarts instance last applied, narrowed to `T`. */
export async function appliedOption<T>(root: ParentNode): Promise<T> {
  const option = (await readyHost(root)).echartsInstance?.getOption();
  if (!option) throw new Error("no applied option on chart host");
  return option as unknown as T;
}
