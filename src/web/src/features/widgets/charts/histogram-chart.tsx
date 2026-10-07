import type { ReactElement } from "react";
import { BoundChart } from "./bound-chart";
import { toHistogram } from "./to-histogram";
import { toHistogramOption } from "./to-histogram-option";
import type { HistogramChartProps } from "./types";

/**
 * The `<Histogram>` MDX widget: the distribution of one numeric column in a
 * named ```sql fence's rows. `value`/`series` name result columns;
 * `binCount`/`binWidth` steer the client-side binning (rice-rule
 * `ceil(2·n^⅓)` default — `binWidth` wins when both are set) and `valueFmt`
 * formats the bin edges. Like every chart it is a registry read — no query
 * of its own; a filtered-empty fence or an all-non-numeric column renders
 * the empty face, and a bad column or fmt names it on the error face.
 *
 * @example
 * <Histogram data="order_amounts" value="amount" binCount={20} />
 */
export function Histogram({
  renderer,
  ...props
}: HistogramChartProps): ReactElement {
  return (
    <BoundChart
      data={props.data}
      height={props.height}
      filters={props.filters}
      renderer={renderer}
      model={(rows) =>
        toHistogram(rows, {
          value: props.value,
          series: props.series,
          binCount: props.binCount,
          binWidth: props.binWidth,
        })
      }
      isEmpty={(model) => model.bins.length === 0}
      option={(model) => toHistogramOption(model, props)}
    />
  );
}
