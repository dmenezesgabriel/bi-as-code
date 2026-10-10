import type { ReactElement } from "react";
import { BoundChart } from "./bound-chart";
import { histogramQuery } from "./histogram-sql";
import { fromHistogramBins, toHistogram } from "./to-histogram";
import { toHistogramOption } from "./to-histogram-option";
import type { HistogramChartProps } from "./types";
import { legendSelectTarget } from "./use-legend-select";

/**
 * The `<Histogram>` MDX widget: the distribution of one numeric column in a
 * named ```sql fence's rows. `value`/`series` name result columns;
 * `binCount`/`binWidth` steer the binning (rice-rule `ceil(2·n^⅓)`
 * default — `binWidth` wins when both are set) and `valueFmt` formats the
 * bin edges. Unfiltered it bins the registry's fence rows; a cross-filtered
 * re-query bins in SQL and returns only bin counts, over the fence's full
 * extent so bars stay put while filtering. A filtered-empty fence or an
 * all-non-numeric column renders the empty face, and a bad column or fmt
 * names it on the error face.
 *
 * @example
 * <Histogram data="order_amounts" value="amount" binCount={20} />
 */
export function Histogram({
  renderer,
  ...props
}: HistogramChartProps): ReactElement {
  const spec = {
    value: props.value,
    series: props.series,
    binCount: props.binCount,
    binWidth: props.binWidth,
  };
  return (
    <BoundChart
      data={props.data}
      height={props.height}
      filters={props.filters}
      select={props.select}
      renderer={renderer}
      model={(rows) => toHistogram(rows, spec)}
      aggregate={{
        query: (block, predicate) => histogramQuery(block, predicate, spec),
        model: (rows) => fromHistogramBins(rows, spec),
      }}
      isEmpty={(model) => model.bins.length === 0}
      option={(model) => toHistogramOption(model, props)}
      brushAxis={(model) => ({
        kind: "bins",
        field: props.value,
        bins: model.bins,
      })}
      legendTarget={(model) => legendSelectTarget(props, model.seriesValues)}
    />
  );
}
