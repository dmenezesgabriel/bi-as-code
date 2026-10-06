import type { Row } from "../../data/types";
import { assertColumns, toY } from "./to-series";
import type { HeatmapCell, HeatmapModel, HeatmapSpec } from "./types";

/** One ordered category domain: `String(cell)` key → index, plus the raw cells. */
interface Domain {
  readonly index: Map<string, number>;
  readonly values: unknown[];
}

/**
 * Pivots result rows into a heatmap cell model — the client-side
 * counterpart of evidence's `build-heatmap-sql.ts` (our fence owns the
 * SQL, so the pivot runs over registry rows). `x`/`y`/`value` name result
 * columns — a miss throws `ColumnError` naming it and listing the
 * available ones. Both domains keep first-appearance order (the fence's
 * `order by` is the sort) and hold the raw cells — stringification only
 * happens at axis-data assembly so `xFmt`/`yFmt` can still format `Date`s
 * and numbers. Rows with a null x or y are dropped (a null has no axis
 * position), as are rows with a null or non-numeric `value` — only
 * observed cells exist, so an unobserved pair reads as a blank cell.
 *
 * @example
 * toHeatmap(rows, { x: "week", y: "region", value: "orders" })
 * // { xDomain: [1, 2, 3], yDomain: ["North", "South"],
 * //   cells: [[0,0,120],[1,0,130],[0,1,90],…], min: 90, max: 140 }
 */
export function toHeatmap(
  rows: readonly Row[],
  spec: HeatmapSpec,
): HeatmapModel {
  if (rows.length === 0) return emptyHeatmap();
  assertColumns(rows[0] ?? {}, spec.x, [spec.y, spec.value]);
  const xDomain: Domain = { index: new Map(), values: [] };
  const yDomain: Domain = { index: new Map(), values: [] };
  const cells: HeatmapCell[] = [];
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    const cell = toCell(row, spec, xDomain, yDomain);
    if (cell === undefined) continue;
    cells.push(cell);
    if (cell[2] < min) min = cell[2];
    if (cell[2] > max) max = cell[2];
  }
  if (cells.length === 0) return emptyHeatmap();
  // echarts draws heatmap cells in data order; ascending y keeps the paint
  // order row-major so the grid fills top-down like the axis reads.
  // Stable, so duplicate (x,y) cells keep row order and last-wins holds.
  cells.sort((a, b) => a[1] - b[1]);
  return {
    xDomain: xDomain.values,
    yDomain: yDomain.values,
    cells,
    min,
    max,
  };
}

function emptyHeatmap(): HeatmapModel {
  return { xDomain: [], yDomain: [], cells: [], min: 0, max: 0 };
}

/**
 * One row → one cell. The domains dedupe by `String(cell)` — evidence's
 * key — so a numeric x and its string form share one category. A row with
 * usable x/y registers its categories even when `value` drops, so the
 * returned position stays on the axis and reads as a blank cell.
 */
function toCell(
  row: Row,
  spec: HeatmapSpec,
  xDomain: Domain,
  yDomain: Domain,
): HeatmapCell | undefined {
  const x = row[spec.x];
  const y = row[spec.y];
  if (x === null || x === undefined || y === null || y === undefined) {
    return undefined;
  }
  const xi = domainIndex(xDomain, x);
  const yi = domainIndex(yDomain, y);
  const value = toY(row[spec.value]);
  if (value === null) return undefined;
  return [xi, yi, value];
}

function domainIndex(domain: Domain, value: unknown): number {
  const key = String(value);
  const existing = domain.index.get(key);
  if (existing !== undefined) return existing;
  domain.index.set(key, domain.values.length);
  domain.values.push(value);
  return domain.values.length - 1;
}
