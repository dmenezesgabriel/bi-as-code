import { useMemo, type ReactElement } from "react";
import { useThemeMode } from "../../chrome/theme-mode";
import type { Row } from "../../data/types";
import type { FilterIds } from "../../filters/filter-ids";
import { EChart } from "./echart";
import { ChartEmpty, ChartResult } from "./states";
import { BRUSH_OPTION } from "./use-brush-select";
import type {
  BrushAxis,
  ChartOption,
  ChartRenderer,
  EChartEvents,
  LegendTarget,
} from "./types";
import { useChartRows } from "./use-chart-rows";
import { useBrushSelect } from "./use-brush-select";
import { useLegendSelect } from "./use-legend-select";
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
  /**
   * The axis the interval brush predicates, projected from the rendered
   * model — the `x` binding on series/scatter charts, the binned `value`
   * column on histograms. Wired only under `select="crossfilter"`.
   */
  brushAxis?: (model: M) => BrushAxis | undefined;
  /**
   * The legend publish target under `select="crossfilter"` — `series`
   * bound and single-`y` charts only (legend names read "<value> - <y>"
   * under multi-`y` and can't predicate one field). A toggle publishes
   * `clauseList(field, enabled)`; native hide/show is the local emphasis.
   */
  legendTarget?: (model: M) => LegendTarget | undefined;
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
 * `pointField` attaches the mark-click interactor, `brushAxis` the interval
 * brush (whose option fragment rides along, the `brush` key being what
 * makes the component model exist).
 *
 * @example
 * <BoundChart data="orders" select="crossfilter" pointField="region" brushAxis={(m) => seriesBrushAxis(m.xType, "region", m.xDomain)} model={(r) => toScatterSeries(r, spec)} option={(m) => toScatterOption(m, props)} />
 */
export function BoundChart<M>(props: BoundChartProps<M>): ReactElement {
  const { result, height, client } = useChartRows(
    props.data,
    props.height,
    props.filters,
  );
  const point = usePointSelect(
    props.select === "crossfilter" ? props.pointField : undefined,
    client,
  );
  const legend = useLegendSelect(client);
  const brush = useBrushSelect(client);
  const rows = result?.status === "success" ? result.rows : undefined;
  // The memo keys on rows identity (plus theme mode — the projection's
  // only non-rows input: a mode flip must repaint): a cross-filter
  // publish re-renders every consumer, but the publisher's own clause
  // skips it — the same `rows` must yield the same `option` reference or
  // EChart's notMerge setOption rebuilds the brush controller mid-drag
  // and the gesture dies there. Projection errors ride the {error}
  // sentinel so they rethrow inside ChartResult's own boundary, same face
  // as before.
  const mode = useThemeMode();
  /* eslint-disable react-doctor/exhaustive-deps -- the deps stay
     rows+mode on purpose: the projection props are pure closures over
     static MDX bindings, fresh each render — every real input reaches
     this memo through rows identity (a re-query) or a theme flip, and
     depending on the closures themselves would re-run every render. */
  const painted = useMemo(() => {
    if (!rows?.length) return undefined;
    try {
      const model = props.model(rows);
      const selecting = props.select === "crossfilter";
      const axis = selecting ? props.brushAxis?.(model) : undefined;
      const legendTarget = selecting ? props.legendTarget?.(model) : undefined;
      const option = axis
        ? { ...props.option(model), ...BRUSH_OPTION }
        : props.option(model);
      return { model, axis, legendTarget, option } as const;
    } catch (error) {
      return { error } as const;
    }
  }, [rows, mode]);
  /* eslint-enable react-doctor/exhaustive-deps */
  return (
    <ChartResult name={props.data} result={result} height={height}>
      {() => {
        if (painted === undefined) return <ChartEmpty height={height} />;
        if ("error" in painted) throw painted.error;
        const { model, axis, legendTarget, option } = painted;
        if (props.isEmpty?.(model)) return <ChartEmpty height={height} />;
        // The events bag rebuilds per render, binding the current model's
        // axis/targets — no ref, no render-phase mutation. `optionApplied`
        // composes every interactor's restore so a notMerge repaint keeps
        // the brush extent, the point dim, and the held legend toggles.
        const events: EChartEvents | undefined =
          point.click || axis || legendTarget
            ? {
                click: point.click,
                ...(axis
                  ? {
                      brushSelected: (params) => brush.selected(params, axis),
                      brushEnd: (params) => brush.ended(params, axis),
                    }
                  : {}),
                ...(legendTarget
                  ? {
                      legendSelectChanged: (params) =>
                        legend.changed(params, legendTarget),
                    }
                  : {}),
                optionApplied: (instance) => {
                  if (axis) brush.optionApplied(instance);
                  point.optionApplied(instance);
                  legend.optionApplied(instance);
                },
              }
            : undefined;
        return (
          <EChart
            option={option}
            height={height}
            renderer={props.renderer}
            events={events}
          />
        );
      }}
    </ChartResult>
  );
}
