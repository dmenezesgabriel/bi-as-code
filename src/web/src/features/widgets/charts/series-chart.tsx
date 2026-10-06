import type { ReactElement } from "react";
import { useQueryResults } from "../../pages/query-registry";
import { EChart, DEFAULT_CHART_HEIGHT } from "./echart";
import { ChartEmpty, ChartResult } from "./states";
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
  const result = useQueryResults()[props.data];
  const height = props.height ?? DEFAULT_CHART_HEIGHT;
  return (
    <ChartResult name={props.data} result={result} height={height}>
      {(rows) => {
        if (rows.length === 0) return <ChartEmpty height={height} />;
        // The projection runs inside ChartResult's callback so its typed
        // errors (ColumnError/FormatError) land on the chart's error face.
        const model = toSeries(
          rows,
          { x: props.x, y: props.y, series: props.series },
          type,
        );
        return (
          <EChart
            option={toChartOption(model, type, props)}
            height={height}
            renderer={renderer}
          />
        );
      }}
    </ChartResult>
  );
}
