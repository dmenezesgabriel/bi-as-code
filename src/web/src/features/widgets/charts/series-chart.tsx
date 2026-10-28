import type { ReactElement } from "react";
import { BoundChart } from "./bound-chart";
import { chartFrameProps } from "./frame-props";
import { toChartOption } from "./to-option";
import { toSeries } from "./to-series";
import type { SeriesChartWidgetProps } from "./types";
import { seriesBrushAxis } from "./use-brush-select";
import { useChartTokens } from "./use-chart-tokens";
import { legendSelectTarget } from "./use-legend-select";

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
  const tokens = useChartTokens();
  return (
    <BoundChart
      {...chartFrameProps(props)}
      select={props.select}
      pointField={props.x}
      renderer={renderer}
      model={(rows) =>
        toSeries(
          rows,
          {
            x: props.x,
            y: props.y,
            series: props.series,
            stacked: props.stacked,
          },
          type,
        )
      }
      option={(model) => toChartOption(model, type, props, tokens)}
      brushAxis={(model) =>
        seriesBrushAxis(model.xType, props.x, model.xDomain)
      }
      legendTarget={(model) => legendSelectTarget(props, model.seriesValues)}
    />
  );
}
