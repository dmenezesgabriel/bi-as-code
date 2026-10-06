import type { ReactElement } from "react";
import { SeriesChart } from "./series-chart";
import type { SeriesChartProps } from "./types";

/**
 * The `<LineChart>` MDX widget: a cartesian line chart bound to a named
 * ```sql fence on the same page. `x`/`y`/`series` name result columns; `y`
 * accepts one column or an array; `stacked` piles series on one stack
 * (`"100%"` normalizes to shares); `labels` draws per-point values.
 *
 * @example
 * <LineChart data="weekly_trend" x="week" y="orders" series="region" />
 */
export function LineChart(props: SeriesChartProps): ReactElement {
  return <SeriesChart {...props} type="line" />;
}
