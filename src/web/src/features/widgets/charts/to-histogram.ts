import type { Row } from "../../data/types";
import { assertColumns, seriesKey, seriesValuesOf, toY } from "./to-series";
import type {
  BinRule,
  HistogramBin,
  HistogramModel,
  HistogramSeries,
  HistogramSpec,
} from "./types";

/** One numeric `value` cell with the series bucket its row belongs to. */
interface ValuedCell {
  readonly key: string;
  readonly value: number;
}

/**
 * Bins result rows into a dense histogram model — the client-side
 * counterpart of evidence's `build-histogram-sql.ts` (our fence owns the
 * SQL, so binning runs over registry rows). `value`/`series` name result
 * columns — a miss throws `ColumnError` naming it and listing the
 * available ones. Non-numeric and null `value` cells are dropped; when none
 * survive the model is empty and the widget renders its empty face.
 *
 * @example
 * toHistogram(rows, { value: "amount", series: "region", binCount: 10 })
 * // { bins: [{start: 12, end: 21}, …], series: [{ name: "North", counts: […] }, …] }
 */
export function toHistogram(
  rows: readonly Row[],
  spec: HistogramSpec,
): HistogramModel {
  if (rows.length === 0) return { bins: [], series: [] };
  assertColumns(rows[0] ?? {}, spec.value, [], spec.series);
  const cells = collectCells(rows, spec);
  if (cells.length === 0) return { bins: [], series: [] };
  const { min, max } = extent(cells);
  const { width, count } = resolveBins(min, max, cells.length, spec);
  return {
    bins: binDomain(min, width, count),
    series: countIntoBins(cells, spec, min, width, count),
    ...seriesValuesOf(rows, spec.series, [spec.value]),
  };
}

/**
 * Projects `histogramQuery`'s bin-count rows into the same dense model
 * `toHistogram` builds from raw rows: the geometry columns every row carries
 * (`lo`, `bin_width`, `bin_count`) rebuild the domain, each row's
 * `frequency` lands at its `bin_index`, and series order by `first_seen`
 * (first appearance, the raw path's convention). No rows — the predicate
 * kept nothing — is the empty model.
 *
 * @example
 * fromHistogramBins([{ lo: 0, bin_width: 10, bin_count: 2, bin_index: 1, frequency: 3n }], { value: "amount" })
 * // { bins: [{start: 0, end: 10}, {start: 10, end: 20}], series: [{ name: "Frequency", counts: [0, 3] }] }
 */
export function fromHistogramBins(
  rows: readonly Row[],
  spec: HistogramSpec,
): HistogramModel {
  const first = rows[0];
  if (first === undefined) return { bins: [], series: [] };
  const count = toY(first.bin_count) ?? 1;
  const ordered = [...rows].sort(
    (a, b) => (toY(a.first_seen) ?? 0) - (toY(b.first_seen) ?? 0),
  );
  const seriesColumn = spec.series === undefined ? undefined : "series";
  return {
    bins: binDomain(toY(first.lo) ?? 0, toY(first.bin_width) ?? 1, count),
    series: scatterBinCounts(ordered, seriesColumn, count),
    ...seriesValuesOf(ordered, seriesColumn, [spec.value]),
  };
}

/** Per-series count vectors from bin rows, in the rows' order. */
function scatterBinCounts(
  rows: readonly Row[],
  seriesColumn: string | undefined,
  count: number,
): HistogramSeries[] {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = seriesKey(row, seriesColumn);
    const counts = groups.get(key) ?? new Array<number>(count).fill(0);
    groups.set(key, counts);
    counts[toY(row.bin_index) ?? 0] = toY(row.frequency) ?? 0;
  }
  return [...groups.entries()].map(([key, counts]) => ({
    name: seriesColumn === undefined ? "Frequency" : key,
    counts,
  }));
}

function collectCells(rows: readonly Row[], spec: HistogramSpec): ValuedCell[] {
  const cells: ValuedCell[] = [];
  for (const row of rows) {
    const value = toY(row[spec.value]);
    if (value === null) continue;
    cells.push({ key: seriesKey(row, spec.series), value });
  }
  return cells;
}

function extent(cells: readonly ValuedCell[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const cell of cells) {
    if (cell.value < min) min = cell.value;
    if (cell.value > max) max = cell.value;
  }
  return { min, max };
}

/**
 * Bin geometry: `binWidth` wins when both props are set (evidence's runtime
 * precedence — its `build-histogram-sql.ts` checks bin_width first);
 * otherwise `binCount`, otherwise the rice rule `ceil(2·n^⅓)`. `min == max`
 * collapses to a single bin so the width never divides by zero.
 */
function resolveBins(
  min: number,
  max: number,
  n: number,
  spec: HistogramSpec,
): { width: number; count: number } {
  const { binWidth, binCount } = binRule(spec);
  if (min === max) return { width: binWidth ?? 1, count: 1 };
  if (binWidth !== undefined) {
    return { width: binWidth, count: Math.ceil((max - min) / binWidth) };
  }
  const count = binCount ?? riceCount(n);
  return { width: (max - min) / count, count };
}

/**
 * The usable geometry props of `spec`: a non-positive or non-finite
 * `binWidth`/`binCount` is ignored, `binCount` floors to a whole count, and
 * `binWidth` drops `binCount` when both survive.
 *
 * @example
 * binRule({ value: "amount", binCount: 12.7, binWidth: 5 }); // → { binWidth: 5 }
 */
export function binRule(spec: HistogramSpec): BinRule {
  const binWidth = positive(spec.binWidth);
  if (binWidth !== undefined) return { binWidth };
  const binCount = positiveCount(spec.binCount);
  return binCount === undefined ? {} : { binCount };
}

function positive(v: number | undefined): number | undefined {
  return v !== undefined && Number.isFinite(v) && v > 0 ? v : undefined;
}

function positiveCount(v: number | undefined): number | undefined {
  const p = positive(v);
  return p === undefined ? undefined : Math.max(1, Math.floor(p));
}

function riceCount(n: number): number {
  return Math.max(1, Math.ceil(2 * Math.cbrt(n)));
}

function binDomain(min: number, width: number, count: number): HistogramBin[] {
  return Array.from({ length: count }, (_, i) => ({
    start: min + i * width,
    end: min + (i + 1) * width,
  }));
}

/**
 * Per-series count vectors over the shared domain, in first-appearance
 * order — the series charts' convention. With no `series` bound the single
 * series is named `"Frequency"`, matching evidence's histogram.
 */
function countIntoBins(
  cells: readonly ValuedCell[],
  spec: HistogramSpec,
  min: number,
  width: number,
  count: number,
): HistogramSeries[] {
  const groups = new Map<string, number[]>();
  for (const cell of cells) {
    let counts = groups.get(cell.key);
    if (counts === undefined) {
      counts = new Array<number>(count).fill(0);
      groups.set(cell.key, counts);
    }
    counts[binIndex(cell.value, min, width, count)]!++;
  }
  return [...groups.entries()].map(([key, counts]) => ({
    name: spec.series === undefined ? "Frequency" : key,
    counts,
  }));
}

/**
 * `floor((v − min) / width)` clamped to the last bin — evidence lets the
 * column max overflow into a `binCount + 1`th sliver; we close the last bin
 * on both ends instead so a `binCount` ask yields exactly that many bins.
 */
function binIndex(
  value: number,
  min: number,
  width: number,
  count: number,
): number {
  return Math.min(Math.floor((value - min) / width), count - 1);
}
