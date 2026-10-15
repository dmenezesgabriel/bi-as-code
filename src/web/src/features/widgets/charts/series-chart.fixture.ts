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

/**
 * A second fence a `filters="region"` consumer binds to — the chart-click
 * tests and stories narrow it through the chart's published point clauses.
 */
export const OPTS: SqlBlock = {
  name: "opts",
  sql: "select * from opts",
};

export const OPTS_ROWS: Row[] = [
  { region: "West", amount: 12 },
  { region: "North", amount: 30 },
  { region: "South", amount: 48 },
];

/** Scatter-story consumer: one `opts` row per distinct `orders` x value. */
export const OPTS_BY_ORDERS: Row[] = [
  { orders: 120, amount: 12 },
  { orders: 140, amount: 30 },
  { orders: 90, amount: 48 },
  { orders: 95, amount: 20 },
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
 * The fake behind the `select="crossfilter"` tests and stories: the
 * chart's own fence gets `allRows`, the `opts` consumer gets `consumerRows`,
 * and any wrapped query carrying the published clause's predicate — a point
 * `= ?`, a list `IN (?, …)`, an interval `BETWEEN ? AND ?` — gets the
 * consumer rows matching it, so clicks and brushes narrow to different rows.
 */
export function dbSelectable(
  field: string,
  allRows: Row[],
  consumerRows: Row[] = OPTS_ROWS,
): FakeDuckDb {
  const db = new FakeDuckDb();
  db.rowsWhen = (sql, params) => {
    if (sql.includes(`where ${field} = ?`))
      return consumerRows.filter((row) => row[field] === params[0]);
    if (sql.includes(`${field} IN (`))
      return consumerRows.filter((row) => params.includes(row[field]));
    if (sql.includes(`${field} BETWEEN`)) {
      const [lo, hi] = params;
      return consumerRows.filter(
        (row) =>
          Number(row[field]) >= Number(lo) && Number(row[field]) <= Number(hi),
      );
    }
    return sql.includes("from opts") ? consumerRows : allRows;
  };
  return db;
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

/** The props that give the North/South series a palette and one override. */
export const PALETTE_OVERRIDE_PROPS = {
  series: "region",
  color: "#123456",
  seriesColors: { South: "#654321" },
} as const;

/**
 * What an option built with `PALETTE_OVERRIDE_PROPS` paints: the palette,
 * the overridden South series' colour and the untouched North's.
 */
export function paletteOverrides(option: unknown): {
  palette: unknown;
  south: string | undefined;
  north: string | undefined;
} {
  const { color, series } = option as {
    color?: unknown;
    series?: { name?: string; color?: string }[];
  };
  const colorOf = (name: string) => series?.find((s) => s.name === name)?.color;
  return { palette: color, south: colorOf("South"), north: colorOf("North") };
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

/**
 * Dispatches the `brushEnd` action with a `lineX` area over `coordRange`
 * (bin/category indexes on a category axis, data values on a continuous
 * one); `undefined` dispatches empty areas — the cleared brush. jsdom's
 * svg surface has no layout for the brush controller's hit test, so this
 * drives the same action a real drag ends by dispatching; the event still
 * flows through the real subscription.
 */
export function brushMarks(
  host: EChartHostElement,
  coordRange: readonly [number, number] | undefined,
): void {
  const chart = host.echartsInstance;
  if (!chart) throw new Error("no echartsInstance on host");
  chart.dispatchAction({
    type: "brushEnd",
    areas: coordRange
      ? [{ brushType: "lineX", coordRange: [...coordRange], xAxisIndex: 0 }]
      : [],
  });
}

/**
 * A selection story's opening state: the publisher chart's ready host and
 * a live count of the consumer `<Table>`'s body rows, resolved once the
 * consumer shows its `unfilteredRows` before any gesture.
 *
 * @example
 * const { host, bodyRows } = await crossfilterScene(canvasElement, 3);
 * brushMarks(host, [1, 2]);
 */
export async function crossfilterScene(
  canvasElement: HTMLElement,
  unfilteredRows: number,
): Promise<{ host: EChartHostElement; bodyRows: () => number }> {
  const host = await readyHost(canvasElement);
  const bodyRows = () => canvasElement.querySelectorAll("tbody tr").length;
  await waitFor(() => expect(bodyRows()).toBe(unfilteredRows));
  return { host, bodyRows };
}

/**
 * The opacity a dimmed data item carries — `undefined` on a bare `[x, y]`
 * tuple. Point-select de-emphasis wraps non-selected marks as
 * `{value, itemStyle: {opacity}}`, so this is the read both the dimmed
 * and the cleared assertions share.
 */
export function markOpacity(item: unknown): number | undefined {
  return (item as { itemStyle?: { opacity?: number } } | null)?.itemStyle
    ?.opacity;
}

/**
 * Dispatches the `legendToggleSelect` action for legend item `name` — the
 * same action a legend click performs, so `legendselectchanged` flows
 * through the real subscription (jsdom's svg surface can't hit-test the
 * legend's glyphs, same as `clickMark`).
 */
export function legendToggle(host: EChartHostElement, name: string): void {
  const chart = host.echartsInstance;
  if (!chart) throw new Error("no echartsInstance on host");
  chart.dispatchAction({ type: "legendToggleSelect", name });
}

/** The engine internals `clickMark` reaches — typed narrowly, no `any`. */
interface ChartInternals {
  getModel(): {
    getSeriesByIndex(i: number): {
      getData(): { getItemGraphicEl(dataIndex: number): unknown };
    };
  };
  getZr(): {
    handler: {
      dispatchToElement(
        targetInfo: { target: unknown },
        eventName: string,
        event: object,
      ): void;
    };
  };
}

/**
 * The SelectCrossfilter story play: click mark 0 → the consumer table
 * narrows to that mark's row while the publisher's own option holds
 * `publisherPoints`; click-same restores; click mark 1 → narrows to *its*
 * row (different marks publish different values); click-same restores
 * again. `consumerRows` is the unfiltered table row count; `clickedValues`
 * are marks 0 and 1's x values as the consumer table renders them. The
 * bar and scatter stories share it verbatim — only the counts differ.
 */
export function crossfilterTogglePlay(
  publisherPoints: number,
  consumerRows: number,
  clickedValues: readonly string[],
): ({ canvasElement }: { canvasElement: HTMLElement }) => Promise<void> {
  return async ({ canvasElement }) => {
    const host = await readyHost(canvasElement);
    const bodyRows = () => canvasElement.querySelectorAll("tbody tr").length;
    const tableText = () =>
      canvasElement.querySelector("tbody")?.textContent ?? "";
    const [first, second] = clickedValues;
    if (!first || !second)
      throw new Error(
        `clickedValues needs two mark values, got ${JSON.stringify(clickedValues)}`,
      );
    await waitFor(() => expect(bodyRows()).toBe(consumerRows));

    clickMark(host, 0);
    await waitFor(() => expect(bodyRows()).toBe(1));
    expect(tableText()).toContain(first);
    const option = await appliedOption<{ series?: { data?: unknown[] }[] }>(
      canvasElement,
    );
    expect(option.series?.[0]?.data).toHaveLength(publisherPoints);
    // The publish also dims every mark that isn't the held one — mosaic's
    // Highlight port paints de-emphasis, not a selection outline.
    const marks = (option.series ?? []).flatMap((s) => s.data ?? []);
    expect(markOpacity(marks[0])).toBeUndefined();
    for (const mark of marks.slice(1))
      expect(markOpacity(mark)).toBeCloseTo(0.2);

    clickMark(host, 0);
    await waitFor(() => expect(bodyRows()).toBe(consumerRows));
    // Clearing merges the bare tuples back — no mark keeps the dim wrap.
    const cleared = await appliedOption<{
      series?: { data?: unknown[] }[];
    }>(canvasElement);
    expect(
      (cleared.series ?? [])
        .flatMap((s) => s.data ?? [])
        .every((mark) => markOpacity(mark) === undefined),
    ).toBe(true);

    clickMark(host, 1);
    await waitFor(() => expect(bodyRows()).toBe(1));
    expect(tableText()).toContain(second);

    clickMark(host, 1);
    await waitFor(() => expect(bodyRows()).toBe(consumerRows));
  };
}

/**
 * Synthesizes a mark click on the series-0 datum at `dataIndex`. jsdom's
 * svg surface has no layout for zrender's coordinate hit test, so this
 * calls the same `dispatchToElement` the DOM proxy invokes after its hit
 * test — the echarts `click` event still flows through the real series
 * packet assembly. `modifiers` become the zrender event's native event.
 */
export function clickMark(
  host: EChartHostElement,
  dataIndex: number,
  modifiers?: { shiftKey?: boolean; metaKey?: boolean },
): void {
  const chart = host.echartsInstance;
  if (!chart) throw new Error("no echartsInstance on host");
  const internals = chart as unknown as ChartInternals;
  const el = internals
    .getModel()
    .getSeriesByIndex(0)
    .getData()
    .getItemGraphicEl(dataIndex);
  if (!el) throw new Error(`no graphic element for dataIndex ${dataIndex}`);
  internals.getZr().handler.dispatchToElement({ target: el }, "click", {
    zrX: 0,
    zrY: 0,
    ...modifiers,
  });
}
