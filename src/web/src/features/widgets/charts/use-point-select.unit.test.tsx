import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { ClauseOptions, QueryClient } from "../../crossfilter/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { Filters } from "../../filters/filters";
import {
  FiltersProvider,
  usePageFilters,
} from "../../filters/page-filters-context";
import type { ChartClickParams } from "./types";
import {
  nextPointValues,
  pointSelectClause,
  usePointSelect,
} from "./use-point-select";

const OPTIONS: ClauseOptions = { source: {}, clients: new Set() };

const CLIENT: QueryClient = {
  query: () => undefined,
  queryPending: () => {},
  queryResult: () => {},
  queryError: () => {},
};

/** A series-mark click param in the shape echarts hands a `click` listener. */
function seriesClick(
  x: unknown,
  init?: { shift?: boolean; meta?: boolean },
): ChartClickParams {
  return {
    componentType: "series",
    value: [x, 6100],
    event: {
      event: { shiftKey: init?.shift ?? false, metaKey: init?.meta ?? false },
    },
  };
}

function filtersWrapper({ children }: { children: ReactNode }) {
  return (
    <FiltersProvider port={new FakeFilterUrlPort("")}>
      {children}
    </FiltersProvider>
  );
}

function renderPointSelect(field: string | undefined) {
  return renderHook(
    () => ({
      filters: usePageFilters() as Filters,
      handler: usePointSelect(field, CLIENT),
    }),
    { wrapper: filtersWrapper },
  );
}

/** A mounted point interactor plus a `click` that plays a mark click inside `act`. */
function pointSelectScene(field: string) {
  const { result } = renderPointSelect(field);
  const { filters, handler } = result.current;
  const click = (x: unknown, init?: { shift?: boolean; meta?: boolean }) =>
    act(() => handler?.(seriesClick(x, init)));
  return { filters, click };
}

describe("nextPointValues", () => {
  it("plain clicks replace the held selection, click-same clears it", () => {
    expect(nextPointValues([], "West", false)).toEqual(["West"]);
    expect(nextPointValues(["West"], "North", false)).toEqual(["North"]);
    expect(nextPointValues(["West"], "West", false)).toEqual([]);
    // A plain click on a member of a multi-select narrows to it alone —
    // only the lone selected point clears on a plain click.
    expect(nextPointValues(["West", "North"], "West", false)).toEqual(["West"]);
  });

  it("shift/meta clicks toggle the point in and out of the held list", () => {
    expect(nextPointValues([], "West", true)).toEqual(["West"]);
    expect(nextPointValues(["West"], "North", true)).toEqual(["West", "North"]);
    expect(nextPointValues(["West", "North"], "West", true)).toEqual(["North"]);
    expect(nextPointValues(["West", "North"], "South", true)).toEqual([
      "West",
      "North",
      "South",
    ]);
  });

  it("sees two equal-instant dates as the same point", () => {
    const a = new Date("2026-01-05T00:00:00Z");
    const b = new Date("2026-01-05T00:00:00Z");
    expect(nextPointValues([a], b, false)).toEqual([]);
    expect(
      nextPointValues([a], new Date("2026-01-06T00:00:00Z"), true),
    ).toEqual([a, new Date("2026-01-06T00:00:00Z")]);
  });
});

describe("pointSelectClause", () => {
  it("emits a point clause for one value and a list clause for several", () => {
    const point = pointSelectClause("region", ["West"], OPTIONS);
    expect(point.meta?.type).toBe("point");
    expect(point.predicate).toEqual({
      sql: "region = ?",
      params: ["West"],
    });
    const list = pointSelectClause("region", ["West", "North"], OPTIONS);
    expect(list.meta?.type).toBe("list");
    expect(list.predicate).toEqual({
      sql: "region IN (?, ?)",
      params: ["West", "North"],
    });
  });

  it("emits a predicate-less clause carrying the field when the selection cleared", () => {
    const clause = pointSelectClause("region", [], OPTIONS);
    expect(clause.predicate).toBeNull();
    expect(clause.fields).toEqual(["region"]);
  });
});

describe("usePointSelect", () => {
  it("returns no handler without a bound field", () => {
    const { result } = renderPointSelect(undefined);
    expect(result.current.handler).toBeUndefined();
  });

  it("publishes the clicked mark's x into the field's selection, skipping its own client", () => {
    const { filters, click } = pointSelectScene("region");
    click("West");

    const clauses = filters.selection("region").clauses;
    expect(clauses).toHaveLength(1);
    const clause = clauses[0]!;
    expect(clause.predicate).toEqual({ sql: "region = ?", params: ["West"] });
    expect(clause.clients?.has(CLIENT)).toBe(true);
    // The publisher's own client is skipped; every other client is narrowed.
    expect(filters.selection("region").predicate(CLIENT)).toBeUndefined();
    expect(filters.selection("region").predicate({} as QueryClient)).toEqual({
      sql: "region = ?",
      params: ["West"],
    });
  });

  it("keeps one clause per source: a second plain click replaces, click-same clears", () => {
    const { filters, click } = pointSelectScene("region");

    click("West");
    click("North");
    expect(filters.selection("region").clauses).toHaveLength(1);
    expect(filters.selection("region").clauses[0]?.value).toBe("North");

    click("North");
    expect(filters.selection("region").clauses).toHaveLength(0);
  });

  it("accumulates shift clicks into a list clause and toggles a second shift click off", () => {
    const { filters, click } = pointSelectScene("region");

    click("West");
    click("North", { shift: true });
    const clause = filters.selection("region").clauses[0];
    expect(clause?.meta?.type).toBe("list");
    expect(clause?.value).toEqual(["West", "North"]);

    click("West", { shift: true });
    // Back to one point — the clause re-narrows to a `=` point clause.
    const lone = filters.selection("region").clauses[0];
    expect(lone?.meta?.type).toBe("point");
    expect(lone?.value).toBe("North");
  });

  it("ignores non-series clicks and marks without a datum x", () => {
    const { result } = renderPointSelect("region");
    const { filters, handler } = result.current;

    act(() => handler?.({ componentType: "legend", value: ["West", 1] }));
    act(() => handler?.(seriesClick(null)));
    expect(filters.selection("region").clauses).toHaveLength(0);
  });
});
