import { act, renderHook } from "@testing-library/react";
import type { EChartsType } from "echarts/core";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { ClauseOptions, QueryClient } from "../../crossfilter/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { Filters } from "../../filters/filters";
import {
  FiltersProvider,
  usePageFilters,
} from "../../filters/page-filters-context";
import type {
  BrushAxis,
  ChartBrushEndParams,
  ChartBrushSelectedParams,
  HistogramBin,
} from "./types";
import { brushClause, useBrushSelect } from "./use-brush-select";

const OPTIONS: ClauseOptions = { source: {}, clients: new Set() };

const CLIENT: QueryClient = {
  query: () => undefined,
  queryPending: () => {},
  queryResult: () => {},
  queryError: () => {},
};

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

function filtersWrapper({ children }: { children: ReactNode }) {
  return (
    <FiltersProvider port={new FakeFilterUrlPort("")}>
      {children}
    </FiltersProvider>
  );
}

function renderBrushSelect() {
  return renderHook(
    () => ({
      filters: usePageFilters() as Filters,
      brush: useBrushSelect(CLIENT),
    }),
    { wrapper: filtersWrapper },
  );
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

  it("maps covered bin indexes to the bin-edge window", () => {
    const clause = brushClause(BINS_AXIS, [1, 2], OPTIONS);
    expect(clause.meta?.type).toBe("interval");
    expect(clause.predicate).toEqual({
      sql: "amount BETWEEN ? AND ?",
      params: [10, 30],
    });
  });

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
    expect(filters.selection("amount").predicate({} as QueryClient)).toEqual({
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

    const dispatched: unknown[] = [];
    const instance = {
      dispatchAction: (action: unknown) => dispatched.push(action),
    } as unknown as EChartsType;
    act(() => brush.optionApplied(instance));

    expect(dispatched).toEqual([
      {
        type: "takeGlobalCursor",
        key: "brush",
        brushOption: { brushType: "lineX", brushMode: "single" },
      },
      {
        type: "brush",
        areas: [
          { brushType: "lineX", coordRange: [10, 20], panelId: "grid--0" },
        ],
      },
    ]);
  });

  it("arms without restoring when no brush is held", () => {
    const { result } = renderBrushSelect();
    const { brush } = result.current;

    const dispatched: unknown[] = [];
    const instance = {
      dispatchAction: (action: unknown) => dispatched.push(action),
    } as unknown as EChartsType;
    act(() => brush.optionApplied(instance));

    expect(dispatched).toEqual([
      {
        type: "takeGlobalCursor",
        key: "brush",
        brushOption: { brushType: "lineX", brushMode: "single" },
      },
    ]);
  });
});
