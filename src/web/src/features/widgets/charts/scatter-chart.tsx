import type { ReactElement } from "react";
import { BoundChart } from "./bound-chart";
import { toScatterOption } from "./to-scatter-option";
import { toScatterSeries } from "./to-scatter-series";
import type { ScatterChartProps } from "./types";
import { seriesBrushAxis } from "./use-brush-select";

/**
 * The `<ScatterChart>` MDX widget: a correlation plot bound to a named
 * ```sql fence on the same page. `x`/`y`/`series`/`size` name result
 * columns (`y` accepts an array, each entry becoming a series); `size`
 * scales each point by evidence's `sqrt(v/max)·35` rule. Like every chart
 * it is a registry read — no query of its own; a filtered-empty fence
 * renders the empty face and a bad column or fmt names it on the error
 * face.
 *
 * @example
 * <ScatterChart data="by_week" x="orders" y="revenue" series="region" size="accounts" />
 */
export function ScatterChart({
  renderer,
  ...props
}: ScatterChartProps): ReactElement {
  return (
    <BoundChart
      data={props.data}
      height={props.height}
      filters={props.filters}
      select={props.select}
      pointField={props.x}
      renderer={renderer}
      model={(rows) =>
        toScatterSeries(rows, {
          x: props.x,
          y: props.y,
          series: props.series,
          size: props.size,
        })
      }
      option={(model) => toScatterOption(model, props)}
      brushAxis={(model) =>
        seriesBrushAxis(model.xType, props.x, model.xDomain)
      }
    />
  );
}
