import { number } from "echarts/core";

/** echarts' default `splitNumber` — about five intervals per value axis. */
const TICK_INTERVALS = 5;

/**
 * The round tick values inside a histogram's `[min, max]` bin extent, on
 * the grid echarts' own value axis would pick (`number.nice` of a fifth of
 * the span). A value axis pinned to unround bin edges otherwise ticks its
 * two ends as well — `2,700` beside `3,000` — and in one unit both read
 * `3k`; pinning these values labels only the grid, keeping an end only
 * when it lands on it (Observable Plot ticks a binned domain the same
 * way).
 *
 * @example
 * binAxisTicks(2700, 6300) // [3000, 4000, 5000, 6000]
 */
export function binAxisTicks(min: number, max: number): number[] {
  if (max <= min) return [];
  const step = number.nice((max - min) / TICK_INTERVALS, true);
  // A hair of slack, so an edge that is a grid value up to float noise
  // (0.1 * 3) still counts as on the grid.
  const slack = step * 1e-9;
  const ticks: number[] = [];
  for (let k = Math.ceil((min - slack) / step); k * step <= max + slack; k++) {
    ticks.push(Number((k * step).toPrecision(12)));
  }
  return ticks;
}
