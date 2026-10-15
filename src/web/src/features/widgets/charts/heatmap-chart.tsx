import type { ReactElement } from "react";
import { BoundChart } from "./bound-chart";
import { toHeatmap } from "./to-heatmap";
import { toHeatmapOption } from "./to-heatmap-option";
import type { HeatmapChartProps } from "./types";
import { useChartTokens } from "./use-chart-tokens";

/**
 * The `<Heatmap>` MDX widget: a density grid bound to a named ```sql fence
 * on the same page. `x`/`y`/`value` name result columns — x runs along the
 * top edge, y down the side, and `value` colors each cell through the
 * continuous `visualMap` strip (`legend={false}` hides it). `colorScale`
 * steers the ramp: one color expands to a surface-anchored gradient per
 * theme mode, two or more pass through verbatim. Like every chart it is a
 * registry read — no query of its own; a filtered-empty fence or an
 * all-non-numeric `value` renders the empty face, and a bad column or fmt
 * names it on the error face.
 *
 * @example
 * <Heatmap data="weekly_trend" x="week" y="region" value="orders" />
 */
export function Heatmap({
  renderer,
  ...props
}: HeatmapChartProps): ReactElement {
  const tokens = useChartTokens();
  return (
    <BoundChart
      data={props.data}
      height={props.height}
      filters={props.filters}
      renderer={renderer}
      model={(rows) =>
        toHeatmap(rows, { x: props.x, y: props.y, value: props.value })
      }
      isEmpty={(model) => model.cells.length === 0}
      option={(model) => toHeatmapOption(model, props, tokens)}
    />
  );
}
