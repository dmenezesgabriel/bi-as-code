import { useCallback, useRef } from "react";
import type { EChartsType } from "echarts/core";
import { clauseList } from "../../crossfilter/clause";
import type {
  ClauseOptions,
  QueryClient,
  SelectionClause,
} from "../../crossfilter/types";
import type { ChartLegendSelectParams, LegendTarget } from "./types";
import { useChartPublish } from "./use-chart-publish";

/**
 * The clause a legend toggle publishes: the enabled names as an `IN` list,
 * with every-name-on and none-on both emitting the predicate-less clause
 * whose only job is clearing (mosaic's deselect-last-clears — an empty
 * selection never filters rows out).
 *
 * @example
 * legendClause("region", ["South", "West"], 3, options); // region IN (?, ?)
 */
export function legendClause(
  field: string,
  enabled: readonly unknown[],
  total: number,
  options: ClauseOptions,
): SelectionClause {
  const value = enabled.length === total ? undefined : enabled;
  return clauseList(field, value, options);
}

/**
 * The publish target a chart's legend interactor resolves names against —
 * `undefined` when the legend can't predicate a field: `series` unbound
 * (legend names are y-column names, not field values) or `y` a list
 * (names read "<value> - <y>", which can't map back to one column).
 * `values` is the model's legend-name → raw-cell map; absent, names bind
 * as themselves — right for string columns, the common case.
 */
export function legendSelectTarget(
  spec: {
    readonly series?: string;
    readonly y?: string | readonly string[];
  },
  values: ReadonlyMap<string, unknown> | undefined,
): LegendTarget | undefined {
  if (spec.series === undefined || Array.isArray(spec.y)) return undefined;
  return { field: spec.series, values: values ?? new Map() };
}

/**
 * The legend interactor on a `select="crossfilter"` chart — the port of
 * mosaic's color-channel `toggle`: a legend click publishes the enabled
 * names as `clauseList(seriesField, enabled)`. ECharts' native hide/show
 * is the local de-emphasis, so the clause's whole job is the consumers'
 * re-query. `optionApplied` re-merges the held `legend.selected` map so a
 * `notMerge` repaint (a foreign clause's re-query, a theme re-init) keeps
 * the user's toggles — the same restore seam the brush's areas ride.
 *
 * @example
 * const legend = useLegendSelect(client);
 * events = { legendSelectChanged: (params) => legend.changed(params, target) };
 */
export function useLegendSelect(client: QueryClient): {
  changed: (params: ChartLegendSelectParams, target: LegendTarget) => void;
  optionApplied: (instance: EChartsType) => void;
} {
  const { clauseOptions, publish } = useChartPublish(client);
  const selectedRef = useRef<Readonly<Record<string, boolean>> | undefined>(
    undefined,
  );
  const changed = useCallback(
    (params: ChartLegendSelectParams, target: LegendTarget) => {
      const selected = params.selected;
      if (!selected) return;
      selectedRef.current = selected;
      const names = Object.keys(selected);
      const enabled = names
        .filter((name) => selected[name])
        .map((name) => target.values.get(name) ?? name);
      publish(legendClause(target.field, enabled, names.length, clauseOptions));
    },
    [clauseOptions, publish],
  );
  const optionApplied = useCallback((instance: EChartsType) => {
    const selected = selectedRef.current;
    if (selected) instance.setOption({ legend: { selected: { ...selected } } });
  }, []);
  return { changed, optionApplied };
}
