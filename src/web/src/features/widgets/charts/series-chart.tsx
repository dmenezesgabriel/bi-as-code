import type { ReactElement } from "react";
import { BoundChart } from "./bound-chart";
import { toChartOption } from "./to-option";
import { toSeries } from "./to-series";
import type { SeriesChartWidgetProps } from "./types";

/**
 * The shared body of `<BarChart>`/`<LineChart>`/`<AreaChart>`: `data` names a
 * ```sql fence on the same page whose registry rows it pivots through
 * `toSeries` and assembles into an echarts option — the tag issues no query
 * of its own, every chart is a registry read. A success with zero rows (a
 * filtered-empty fence) renders the empty face at chart height; a `data`
 * typo, missing column or bad fmt renders the named alert — one bad chart
 * must not take down the page around it.
 *
 * @example
 * <SeriesChart type="line" data="weekly_trend" x="week" y="orders" series="region" />
 */
export function SeriesChart({
  type,
  renderer,
  ...props
}: SeriesChartWidgetProps): ReactElement {
  return (
    <BoundChart
      data={props.data}
      height={props.height}
      renderer={renderer}
      model={(rows) =>
        toSeries(rows, { x: props.x, y: props.y, series: props.series }, type)
      }
      option={(model) => toChartOption(model, type, props)}
    />
  );
}
