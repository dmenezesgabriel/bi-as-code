import type { ReactElement } from "react";
import type { Row } from "../../data/types";
import type { FilterIds } from "../../filters/filter-ids";
import { EChart } from "./echart";
import { ChartEmpty, ChartResult } from "./states";
import type { ChartOption, ChartRenderer } from "./types";
import { useChartRows } from "./use-chart-rows";
import { usePointSelect } from "./use-point-select";

interface BoundChartProps<M> {
  data: string;
  height?: number;
  filters?: FilterIds;
  renderer?: ChartRenderer;
  /**
   * `"crossfilter"`: the chart publishes its selection gestures as clauses
   * into the interacted field's selection; consumers declaring that field
   * in `filters` re-query while the chart's own clause skips it.
   */
  select?: "crossfilter";
  /** The column a mark click predicates — the `x` binding on series and scatter charts. */
  pointField?: string;
  model: (rows: readonly Row[]) => M;
  /**
   * When the projected model carries nothing to draw — e.g. a histogram of
   * an all-non-numeric column — show the empty face rather than bare axes.
   */
  isEmpty?: (model: M) => boolean;
  option: (model: M) => ChartOption;
}

/**
 * The frame every registry-bound chart widget shares: resolve `data` against
 * the page's query registry, render the state face (alert / loading / empty)
 * at chart height, else project rows through `model` and paint `option`.
 * The projection runs inside `ChartResult`'s callback so its typed errors
 * (ColumnError/FormatError) land on the chart's error face.
 * `select="crossfilter"` wires the gestures the bound fields support —
 * `pointField` attaches the mark-click interactor.
 *
 * @example
 * <BoundChart data="orders" select="crossfilter" pointField="region" model={(r) => toScatterSeries(r, spec)} option={(m) => toScatterOption(m, props)} />
 */
export function BoundChart<M>(props: BoundChartProps<M>): ReactElement {
  const { result, height, client } = useChartRows(
    props.data,
    props.height,
    props.filters,
  );
  const pointClick = usePointSelect(
    props.select === "crossfilter" ? props.pointField : undefined,
    client,
  );
  return (
    <ChartResult name={props.data} result={result} height={height}>
      {(rows) => {
        if (rows.length === 0) return <ChartEmpty height={height} />;
        const model = props.model(rows);
        if (props.isEmpty?.(model)) return <ChartEmpty height={height} />;
        return (
          <EChart
            option={props.option(model)}
            height={height}
            renderer={props.renderer}
            events={pointClick ? { click: pointClick } : undefined}
          />
        );
      }}
    </ChartResult>
  );
}
