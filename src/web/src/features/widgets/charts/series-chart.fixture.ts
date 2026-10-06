import type { ReactElement } from "react";
import { expect, screen, waitFor } from "storybook/test";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import type { SqlBlock } from "../../pages/types";
import { renderWithRegistry } from "../value/registry-harness";
import type { TooltipParam } from "./to-option";
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

/** Scatter fixture: orders↔revenue correlation across two regions + a size column. */
export const SCATTER_ROWS: Row[] = [
  { week: 1, orders: 120, revenue: 4800, region: "North", accounts: 14 },
  { week: 2, orders: 140, revenue: 5300, region: "North", accounts: 18 },
  { week: 1, orders: 90, revenue: 3700, region: "South", accounts: 9 },
  { week: 2, orders: 95, revenue: 3900, region: "South", accounts: 11 },
];

export const ORDER_AMOUNTS: SqlBlock = {
  name: "order_amounts",
  sql: "select amount, region from orders",
};

/** Histogram fixture: 24 raw per-order amounts interleaved across two regions. */
export const AMOUNT_ROWS: Row[] = [
  { amount: 12, region: "North" },
  { amount: 15, region: "South" },
  { amount: 20, region: "North" },
  { amount: 22, region: "South" },
  { amount: 28, region: "North" },
  { amount: 30, region: "South" },
  { amount: 35, region: "North" },
  { amount: 38, region: "South" },
  { amount: 42, region: "North" },
  { amount: 45, region: "South" },
  { amount: 50, region: "North" },
  { amount: 52, region: "South" },
  { amount: 58, region: "North" },
  { amount: 60, region: "South" },
  { amount: 65, region: "North" },
  { amount: 68, region: "South" },
  { amount: 72, region: "North" },
  { amount: 75, region: "South" },
  { amount: 80, region: "North" },
  { amount: 82, region: "South" },
  { amount: 88, region: "North" },
  { amount: 90, region: "South" },
  { amount: 95, region: "North" },
  { amount: 98, region: "South" },
];

/** Every query on the fake returns `rows` — callers bind one fence at a time. */
export function dbWith(rows: Row[]): FakeDuckDb {
  return FakeDuckDb.withRows(rows);
}

/**
 * The host once the first paint of the applied option finishes. `finished`
 * fires after echarts' entry animation completes — ~1.5s for a full option
 * under jsdom — so unit tests pass a longer `timeout` than the 1s default.
 */
export async function readyHost(
  root: ParentNode,
  timeout?: number,
): Promise<EChartHostElement> {
  const host = await waitFor(
    () => {
      const el = root.querySelector<EChartHostElement>("[data-echarts-theme]");
      expect(el).toHaveAttribute("data-echarts-ready");
      return el;
    },
    { timeout },
  );
  if (!host) throw new Error("chart host not rendered");
  return host;
}

/** The option the live echarts instance last applied, narrowed to `T`. */
export async function appliedOption<T>(
  root: ParentNode,
  timeout?: number,
): Promise<T> {
  const option = (await readyHost(root, timeout)).echartsInstance?.getOption();
  if (!option) throw new Error("no applied option on chart host");
  return option as unknown as T;
}

/**
 * Extracts the tooltip formatter from an assembled chart option — option
 * builders type it loosely, so tests narrow it to a callable here.
 */
export function tooltipFormatter(
  option: unknown,
): (params: TooltipParam | readonly TooltipParam[]) => string {
  const fmt = (option as { tooltip?: { formatter?: unknown } }).tooltip
    ?.formatter;
  if (typeof fmt !== "function") throw new Error("no tooltip formatter");
  return fmt as (params: TooltipParam | readonly TooltipParam[]) => string;
}

/** The aria description an assembled chart option carries, if any. */
export function ariaDescription(option: unknown): string | undefined {
  return (option as { aria?: { label?: { description?: string } } }).aria?.label
    ?.description;
}

/**
 * Renders `element` against a forever-pending `orders` fence and asserts the
 * loading pulse holds the requested `height` and paints no chart host.
 */
export async function expectPendingPulse(
  element: ReactElement,
  height: number,
): Promise<void> {
  renderWithRegistry(element, {
    db: FakeDuckDb.pending(),
    blocks: [ORDERS_REGIONAL],
  });
  const status = await screen.findByRole("status");
  expect(status).toHaveStyle({ height: `${height}px` });
  expect(document.querySelector("[data-echarts-theme]")).toBeNull();
}

/** Renders `element` against an empty result and asserts the "0 rows" face. */
export async function expectEmptyFace(element: ReactElement): Promise<void> {
  renderWithRegistry(element, {
    db: dbWith([]),
    blocks: [ORDERS_REGIONAL],
  });
  expect(await screen.findByText("0 rows")).toBeInTheDocument();
  expect(document.querySelector("[data-echarts-theme]")).toBeNull();
}
