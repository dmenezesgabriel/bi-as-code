import type { ReactElement } from "react";
import { SeriesChart } from "./series-chart";
import type { SeriesChartProps } from "./types";

/**
 * The `<AreaChart>` MDX widget: a cartesian area chart bound to a named
 * ```sql fence on the same page. `x`/`y`/`series` name result columns; `y`
 * accepts one column or an array; `stacked` piles series on one stack
 * (`"100%"` normalizes to shares — the common area-chart reading);
 * `labels` draws per-point values.
 *
 * @example
 * <AreaChart data="weekly_trend" x="week" y="orders" series="region" stacked="100%" />
 */
export function AreaChart(props: SeriesChartProps): ReactElement {
  return <SeriesChart {...props} type="area" />;
}
