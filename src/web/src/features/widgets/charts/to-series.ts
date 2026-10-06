import type { Row } from "../../data/types";
import { coerceNumeric } from "../value/format";
import { ColumnError } from "../value/types";
import type {
  ChartSeries,
  SeriesChartType,
  SeriesModel,
  SeriesSpec,
  XAxisKind,
} from "./types";

/** Per-y-column buckets: y column → series key → x key → coerced y. */
type PointGroups = Map<string, Map<string, Map<unknown, number | null>>>;

/**
 * Pivots result rows into a domain-aligned series model — the chart-family
 * counterpart of `projectSparklinePoints`. `x`/`y`/`series` name result
 * columns (the fence owns the SQL; a miss throws `ColumnError` naming the
 * column and listing the available ones). The x domain keeps first-
 * appearance order — the fence's `order by` is the sort — and every series
 * emits one `[x, y]` tuple per domain entry so stacked series line up, with
 * `null` where a series has no value at that x (ECharts draws the gap).
 * Rows with a null x are dropped — a null has no axis position; a null or
 * non-numeric y becomes an explicit gap instead.
 *
 * @example
 * toSeries(rows, { x: "week", y: "orders", series: "region" }, "line")
 * // { xDomain: [1, 2, 3], xType: "value", series: [{name: "North", …}, …] }
 */
export function toSeries(
  rows: readonly Row[],
  spec: SeriesSpec,
  type: SeriesChartType,
): SeriesModel {
  const ys = typeof spec.y === "string" ? [spec.y] : spec.y;
  if (rows.length === 0) {
    return { xDomain: [], xType: "category", series: [] };
  }
  assertColumns(rows[0] ?? {}, spec.x, ys, spec.series);
  const xType = inferXType(
    rows.map((row) => row[spec.x]),
    type,
  );
  const { domain, groups } = collectPoints(rows, spec, ys, xType);
  return {
    xDomain: [...domain.values()],
    xType,
    series: buildSeries(ys, spec, domain, groups),
  };
}

/**
 * The x-axis kind the cell values call for: `Date` → `time`; `number`/
 * `bigint` → `category` on a bar chart (discrete positions) and `value` on
 * line/area (a continuous axis); anything else → `category`. The first
 * non-null cell decides — mixed-type columns are a data smell, not a shape
 * we arbitrate.
 */
export function inferXType(
  xValues: readonly unknown[],
  type: SeriesChartType,
): XAxisKind {
  const first = xValues.find((v) => v !== null && v !== undefined);
  if (first instanceof Date) return "time";
  if (typeof first === "number" || typeof first === "bigint") {
    return type === "bar" ? "category" : "value";
  }
  return "category";
}

/** First missing column name wins — `x`, then `y` entries, then `series`. */
function assertColumns(
  row: Row,
  x: string,
  ys: readonly string[],
  series?: string,
): void {
  const keys = new Set(Object.keys(row));
  const named = series === undefined ? [x, ...ys] : [x, ...ys, series];
  for (const name of named) {
    if (!keys.has(name)) {
      throw new ColumnError({ column: name, available: [...keys] });
    }
  }
}

function collectPoints(
  rows: readonly Row[],
  spec: SeriesSpec,
  ys: readonly string[],
  xType: XAxisKind,
): { domain: Map<unknown, unknown>; groups: PointGroups } {
  const domain = new Map<unknown, unknown>();
  const groups: PointGroups = new Map();
  for (const row of rows) {
    const key = collectX(domain, row[spec.x], xType);
    if (key === undefined) continue;
    const sKey = seriesKey(row, spec.series);
    for (const y of ys) addPoint(groups, y, sKey, key, row[y]);
  }
  return { domain, groups };
}

/**
 * Registers one x cell into the ordered domain map (deduped by key) and
 * returns that key for the point lookups; `undefined` means the row is
 * skipped. `Date` keys by instant so equal instants share one domain slot.
 */
function collectX(
  domain: Map<unknown, unknown>,
  value: unknown,
  xType: XAxisKind,
): unknown {
  if (value === null || value === undefined) return undefined;
  const normalized = normalizeX(value, xType);
  const key = normalized instanceof Date ? normalized.getTime() : normalized;
  if (!domain.has(key)) domain.set(key, normalized);
  return key;
}

/**
 * A numeric x on a category axis must not reach ECharts as a number — the
 * engine reads it as an ordinal index, not a category name (the same trap
 * evidence's `formatXValue` guards against). Value/time axes keep the raw
 * cell.
 */
function normalizeX(value: unknown, xType: XAxisKind): unknown {
  if (xType !== "category") return value;
  return typeof value === "number" || typeof value === "bigint"
    ? String(value)
    : value;
}

function addPoint(
  groups: PointGroups,
  y: string,
  sKey: string,
  xKey: unknown,
  value: unknown,
): void {
  let bySeries = groups.get(y);
  if (bySeries === undefined) {
    bySeries = new Map();
    groups.set(y, bySeries);
  }
  let byX = bySeries.get(sKey);
  if (byX === undefined) {
    byX = new Map();
    bySeries.set(sKey, byX);
  }
  byX.set(xKey, toY(value));
}

function toY(value: unknown): number | null {
  const numeric = coerceNumeric(value);
  if (numeric === null) return null;
  const n = Number(numeric);
  return Number.isFinite(n) ? n : null;
}

/** The bucket a row's series cell lands in; null cells group as "Unknown". */
function seriesKey(row: Row, column?: string): string {
  if (column === undefined) return "";
  const value = row[column];
  return value === null || value === undefined ? "Unknown" : String(value);
}

/**
 * Emits one `ChartSeries` per (y column × series value), y-major — for each
 * `y` in spec order, its series buckets in first-appearance order — each
 * aligned to the full domain. Naming follows evidence's `SeriesModel`:
 * bare `y` column with no `series`, bare series value for a single `y`,
 * `"<series> - <y>"` once several `y` columns share the grouping.
 */
function buildSeries(
  ys: readonly string[],
  spec: SeriesSpec,
  domain: Map<unknown, unknown>,
  groups: PointGroups,
): ChartSeries[] {
  const series: ChartSeries[] = [];
  for (const y of ys) {
    for (const [sKey, byX] of groups.get(y) ?? []) {
      series.push({
        name: seriesName(sKey, y, spec.series, ys.length),
        data: [...domain.entries()].map(
          ([key, x]) => [x, byX.get(key) ?? null] as const,
        ),
      });
    }
  }
  return series;
}

function seriesName(
  sKey: string,
  y: string,
  series: string | undefined,
  yCount: number,
): string {
  if (series === undefined) return y;
  return yCount > 1 ? `${sKey} - ${y}` : sKey;
}
