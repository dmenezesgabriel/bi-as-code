import type { ReactElement } from "react";
import { SeriesChart } from "./series-chart";
import type { SeriesChartProps } from "./types";

/**
 * The `<BarChart>` MDX widget: a cartesian bar chart bound to a named
 * ```sql fence on the same page. `x`/`y`/`series` name result columns; `y`
 * accepts one column or an array; `stacked` piles series on one stack
 * (`"100%"` normalizes to shares); `labels` draws per-point values.
 *
 * @example
 * <BarChart data="orders" x="region" y="revenue" labels />
 */
export function BarChart(props: SeriesChartProps): ReactElement {
  return <SeriesChart {...props} type="bar" />;
}
