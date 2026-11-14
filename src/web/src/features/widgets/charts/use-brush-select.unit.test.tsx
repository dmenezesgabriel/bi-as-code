import { act } from "@testing-library/react";
import * as echarts from "echarts/core";
import type { EChartsType } from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  BrushComponent,
  GridComponent,
  ToolboxComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { afterEach, describe, expect, it } from "vitest";
import type {
  BrushAxis,
  ChartBrushEndParams,
  ChartBrushSelectedParams,
  HistogramBin,
} from "./types";
import { BRUSH_OPTION, brushClause, useBrushSelect } from "./use-brush-select";
import {
  IdleQueryClient,
  renderInteractor,
  TEST_CLAUSE_OPTIONS as OPTIONS,
} from "./chart-interactor.fixture";

const CLIENT = new IdleQueryClient();

const VALUE_AXIS: BrushAxis = { kind: "value", field: "amount" };
const TIME_AXIS: BrushAxis = { kind: "time", field: "ordered" };
const CATEGORY_AXIS: BrushAxis = {
  kind: "category",
  field: "region",
  domain: ["West", "North", "South"],
};
const BINS: HistogramBin[] = [
  { start: 0, end: 10 },
  { start: 10, end: 20 },
  { start: 20, end: 30 },
];
const BINS_AXIS: BrushAxis = { kind: "bins", field: "amount", bins: BINS };

/** A `brushEnd` param in the shape echarts hands the listener. */
function brushEnd(range?: readonly [number, number]): ChartBrushEndParams {
  return {
    areas: range
      ? [{ brushType: "lineX", coordRange: range, panelId: "grid--0" }]
      : [],
  };
}

/** A `brushSelected` param in the shape echarts hands the listener. */
function brushSelected(
  range?: readonly [number, number],
): ChartBrushSelectedParams {
  return {
    batch: [
      {
        areas: range ? [{ brushType: "lineX", coordRange: range }] : [],
      },
    ],
  };
}

/**
 * An echarts instance double whose `takeGlobalCursor` dispatch flushes the
 * `brushSelected` a `notMerge` repaint left pending — the rebuilt brush
 * model has no areas, so the real chart emits an empty batch right there.
 */
class CursorFlushingChart {
  readonly dispatched: unknown[] = [];

  constructor(private readonly flushPendingBrushSelected: () => void) {}

  asEChart(): EChartsType {
    return {
      dispatchAction: (action: { type: string }) => {
        this.dispatched.push(action);
        if (action.type === "takeGlobalCursor")
          this.flushPendingBrushSelected();
      },
    } as unknown as EChartsType;
  }
}

/** The action that re-arms the lineX brush cursor after a chart repaint. */
const ARM_CURSOR = {
  type: "takeGlobalCursor",
  key: "brush",
  brushOption: { brushType: "lineX", brushMode: "single" },
};

/** The action that repaints a held lineX brush over `coordRange`. */
function restoreArea(coordRange: [number, number]) {
  return {
    type: "brush",
    areas: [{ brushType: "lineX", coordRange, panelId: "grid--0" }],
  };
}

function renderBrushSelect() {
  return renderInteractor("brush", () => useBrushSelect(CLIENT));
}

describe("brushClause", () => {
  it("publishes a BETWEEN interval on a value axis", () => {
    const clause = brushClause(VALUE_AXIS, [10, 20], OPTIONS);
    expect(clause.meta?.type).toBe("interval");
    expect(clause.predicate).toEqual({
      sql: "amount BETWEEN ? AND ?",
      params: [10, 20],
    });
  });

  it("sorts a reversed drag into a lo–hi extent", () => {
    expect(brushClause(VALUE_AXIS, [20, 10], OPTIONS).predicate).toEqual({
      sql: "amount BETWEEN ? AND ?",
      params: [10, 20],
    });
  });

  it("wraps time-axis epochs as Date bounds", () => {
    const clause = brushClause(TIME_AXIS, [1000, 2000], OPTIONS);
    expect(clause.meta?.type).toBe("interval");
    expect(clause.value).toEqual([new Date(1000), new Date(2000)]);
  });

  it("lists the covered categories on a category axis", () => {
    const clause = brushClause(CATEGORY_AXIS, [0, 1], OPTIONS);
    expect(clause.meta?.type).toBe("list");
    expect(clause.predicate).toEqual({
      sql: "region IN (?, ?)",
      params: ["West", "North"],
    });
  });

  it.each([
    { range: [12, 25], edges: [10, 30] },
    { range: [25, 12], edges: [10, 30] },
    { range: [10, 20], edges: [10, 20] },
    { range: [0, 4], edges: [0, 10] },
  ] as const)(
    "snaps a $range value extent out to the bin edges $edges it touches",
    ({ range, edges }) => {
      const clause = brushClause(BINS_AXIS, range, OPTIONS);
      expect(clause.meta?.type).toBe("interval");
      expect(clause.predicate).toEqual({
        sql: "amount BETWEEN ? AND ?",
        params: edges,
      });
    },
  );

  it("emits a predicate-less clause carrying the field when the brush cleared", () => {
    const clause = brushClause(VALUE_AXIS, undefined, OPTIONS);
    expect(clause.predicate).toBeNull();
    expect(clause.fields).toEqual(["amount"]);
  });
});

describe("useBrushSelect", () => {
  it("publishes the brushed extent into the field's selection, skipping its own client", () => {
    const { result } = renderBrushSelect();
    const { filters, brush } = result.current;

    act(() => brush.ended(brushEnd([10, 20]), VALUE_AXIS));

    const clauses = filters.selection("amount").clauses;
    expect(clauses).toHaveLength(1);
    expect(clauses[0]?.predicate).toEqual({
      sql: "amount BETWEEN ? AND ?",
      params: [10, 20],
    });
    expect(clauses[0]?.clients?.has(CLIENT)).toBe(true);
    expect(filters.selection("amount").predicate(CLIENT)).toBeUndefined();
    expect(
      filters.selection("amount").predicate(new IdleQueryClient()),
    ).toEqual({
      sql: "amount BETWEEN ? AND ?",
      params: [10, 20],
    });
  });

  it("publishes live from brushSelected and keeps the clause when brushEnd repeats the extent", () => {
    const { result } = renderBrushSelect();
    const { filters, brush } = result.current;

    act(() => brush.selected(brushSelected([10, 20]), VALUE_AXIS));
    const first = filters.selection("amount").clauses[0];
    expect(first?.predicate).toEqual({
      sql: "amount BETWEEN ? AND ?",
      params: [10, 20],
    });

    act(() => brush.ended(brushEnd([10, 20]), VALUE_AXIS));
    // Replace-by-source would mint a new clause object; the closeTo dedupe
    // keeps the published one — the final event is not a second re-query.
    expect(filters.selection("amount").clauses[0]).toBe(first);
  });

  it("republishes once per source when the extent moves", () => {
    const { result } = renderBrushSelect();
    const { filters, brush } = result.current;

    act(() => brush.ended(brushEnd([10, 20]), VALUE_AXIS));
    act(() => brush.ended(brushEnd([15, 30]), VALUE_AXIS));

    const clauses = filters.selection("amount").clauses;
    expect(clauses).toHaveLength(1);
    expect(clauses[0]?.value).toEqual([15, 30]);
  });

  it("clears on a brush with no areas", () => {
    const { result } = renderBrushSelect();
    const { filters, brush } = result.current;

    act(() => brush.ended(brushEnd([10, 20]), VALUE_AXIS));
    act(() => brush.ended(brushEnd(), VALUE_AXIS));

    expect(filters.selection("amount").clauses).toHaveLength(0);
  });

  it("re-arms the cursor and restores the held brush area on optionApplied", () => {
    const { result } = renderBrushSelect();
    const { brush } = result.current;
    act(() => brush.ended(brushEnd([10, 20]), VALUE_AXIS));

    const instance = new CursorFlushingChart(() => {});
    act(() => brush.optionApplied(instance.asEChart()));

    expect(instance.dispatched).toEqual([ARM_CURSOR, restoreArea([10, 20])]);
  });

  it("keeps the held area and clause when re-arming flushes the repaint's empty brushSelected", () => {
    const { result } = renderBrushSelect();
    const { filters, brush } = result.current;
    act(() => brush.ended(brushEnd([10, 20]), VALUE_AXIS));
    const held = filters.selection("amount").clauses[0];
    const instance = new CursorFlushingChart(() =>
      brush.selected(brushSelected(), VALUE_AXIS),
    );

    act(() => brush.optionApplied(instance.asEChart()));

    expect(instance.dispatched.at(-1)).toEqual(restoreArea([10, 20]));
    expect(filters.selection("amount").clauses[0]).toBe(held);
  });

  it("arms without restoring when no brush is held", () => {
    const { result } = renderBrushSelect();
    const { brush } = result.current;

    const instance = new CursorFlushingChart(() => {});
    act(() => brush.optionApplied(instance.asEChart()));

    expect(instance.dispatched).toEqual([ARM_CURSOR]);
  });
});

echarts.use([
  BarChart,
  BrushComponent,
  GridComponent,
  SVGRenderer,
  ToolboxComponent,
]);

/** The private zrender surface a brushed bar's colour is read from. */
interface RenderedElement {
  type: string;
  style: { fill: string };
}
interface BarChartInternals {
  getViewOfSeriesModel(model: unknown): {
    group: { traverse(visit: (el: RenderedElement) => void): void };
  };
  getModel(): { getSeriesByIndex(index: number): unknown };
  /** echarts applies hover states on its next animation frame. */
  _onframe(): void;
}

describe("BRUSH_OPTION driven by echarts", () => {
  const charts: EChartsType[] = [];
  afterEach(() => charts.splice(0).forEach((chart) => chart.dispose()));

  /** Three value-axis bars at x 5, 15, 25 under the brush fragment. */
  function brushedBars(): EChartsType {
    const chart = echarts.init(null, null, {
      renderer: "svg",
      ssr: true,
      width: 600,
      height: 300,
    });
    charts.push(chart);
    chart.setOption({
      animation: false,
      xAxis: { type: "value", min: 0, max: 30 },
      yAxis: {},
      series: [
        {
          type: "bar",
          color: "#0072b2",
          barCategoryGap: 0,
          data: [
            [5, 4],
            [15, 6],
            [25, 3],
          ],
          emphasis: { focus: "series" },
        },
      ],
      ...BRUSH_OPTION,
    });
    return chart;
  }

  function barFills(chart: EChartsType): string[] {
    const internals = chart as unknown as BarChartInternals;
    const series = internals.getModel().getSeriesByIndex(0);
    const fills: string[] = [];
    internals.getViewOfSeriesModel(series).group.traverse((el) => {
      if (el.type === "rect") fills.push(el.style.fill);
    });
    return fills;
  }

  /** Dispatches `action`, then runs the frame that applies hover states. */
  function dispatchFramed(
    chart: EChartsType,
    action: Parameters<EChartsType["dispatchAction"]>[0],
  ): void {
    chart.dispatchAction(action);
    (chart as unknown as BarChartInternals)._onframe();
  }

  // The pointer rests on an out-of-brush bar, so it is hovered while grey
  // when the click clears the brush, then leaves it.
  it("restores a hovered bar's colour once a cleared brush lets it go", () => {
    const chart = brushedBars();
    const area = { brushType: "lineX", xAxisIndex: 0, coordRange: [20, 30] };
    dispatchFramed(chart, { type: "brush", areas: [area] });
    dispatchFramed(chart, { type: "highlight", seriesIndex: 0, dataIndex: 0 });

    dispatchFramed(chart, { type: "brush", areas: [] });
    dispatchFramed(chart, { type: "downplay", seriesIndex: 0, dataIndex: 0 });

    expect(barFills(chart)).toEqual(["#0072b2", "#0072b2", "#0072b2"]);
  });
});
