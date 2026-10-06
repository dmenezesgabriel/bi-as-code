import type { ReactElement } from "react";
import type { Row } from "../../data/types";
import { EChart } from "./echart";
import { ChartEmpty, ChartResult } from "./states";
import type { ChartOption, ChartRenderer } from "./types";
import { useChartRows } from "./use-chart-rows";

interface BoundChartProps<M> {
  data: string;
  height?: number;
  renderer?: ChartRenderer;
  model: (rows: readonly Row[]) => M;
  option: (model: M) => ChartOption;
}

/**
 * The frame every registry-bound chart widget shares: resolve `data` against
 * the page's query registry, render the state face (alert / loading / empty)
 * at chart height, else project rows through `model` and paint `option`.
 * The projection runs inside `ChartResult`'s callback so its typed errors
 * (ColumnError/FormatError) land on the chart's error face.
 *
 * @example
 * <BoundChart data="orders" model={(r) => toScatterSeries(r, spec)} option={(m) => toScatterOption(m, props)} />
 */
export function BoundChart<M>(props: BoundChartProps<M>): ReactElement {
  const { result, height } = useChartRows(props.data, props.height);
  return (
    <ChartResult name={props.data} result={result} height={height}>
      {(rows) => {
        if (rows.length === 0) return <ChartEmpty height={height} />;
        return (
          <EChart
            option={props.option(props.model(rows))}
            height={height}
            renderer={props.renderer}
          />
        );
      }}
    </ChartResult>
  );
}
