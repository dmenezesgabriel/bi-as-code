import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { clausePoint } from "../../crossfilter/clause";
import type { QueryClient } from "../../crossfilter/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { Filters } from "../../filters/filters";
import {
  FiltersProvider,
  usePageFilters,
} from "../../filters/page-filters-context";
import { useChartPublish } from "./use-chart-publish";

const CLIENT: QueryClient = {
  query: () => undefined,
  queryPending: () => {},
  queryResult: () => {},
  queryError: () => {},
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <FiltersProvider port={new FakeFilterUrlPort("")}>
      {children}
    </FiltersProvider>
  );
}

function renderPublish() {
  return renderHook(
    () => ({
      filters: usePageFilters() as Filters,
      seam: useChartPublish(CLIENT),
    }),
    { wrapper },
  );
}

describe("useChartPublish", () => {
  it("routes a published clause into the selection its field names", () => {
    const { result } = renderPublish();
    const { filters, seam } = result.current;

    act(() => seam.publish(clausePoint("region", "West", seam.clauseOptions)));

    const clauses = filters.selection("region").clauses;
    expect(clauses).toHaveLength(1);
    expect(clauses[0]?.value).toBe("West");
    expect(clauses[0]?.clients?.has(CLIENT)).toBe(true);
  });

  it("publishes on a data column named like the editor's URL key without touching the URL", () => {
    // A chart's field is a column name, not an author-written filter id, so
    // the reserved-id guard must not reach it — and a publish never writes.
    const port = new FakeFilterUrlPort("?edit=true");
    const { result } = renderHook(
      () => ({
        filters: usePageFilters() as Filters,
        seam: useChartPublish(CLIENT),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <FiltersProvider port={port}>{children}</FiltersProvider>
        ),
      },
    );
    const { filters, seam } = result.current;

    act(() => seam.publish(clausePoint("edit", "West", seam.clauseOptions)));

    expect(
      filters.selection("edit").clauses.map((clause) => clause.value),
    ).toContain("West");
    expect(port.written).toEqual([]);
  });

  it("keeps the source stable across renders but distinct per interactor call", () => {
    const { result } = renderHook(
      () => ({
        filters: usePageFilters() as Filters,
        a: useChartPublish(CLIENT),
        b: useChartPublish(CLIENT),
      }),
      { wrapper },
    );
    const firstSource = result.current.a.clauseOptions.source;
    const { a, b, filters } = result.current;
    expect(a.clauseOptions.source).toBe(firstSource);
    expect(a.clauseOptions.source).not.toBe(b.clauseOptions.source);
    expect(a.clauseOptions.clients).toEqual(new Set([CLIENT]));

    // Per-interactor sources: one gesture's clause never replaces the other's.
    act(() => {
      a.publish(clausePoint("region", "West", a.clauseOptions));
      b.publish(clausePoint("region", "North", b.clauseOptions));
    });
    expect(filters.selection("region").clauses).toHaveLength(2);
  });

  it("replaces by source on a second publish from the same interactor", () => {
    const { result } = renderPublish();
    const { filters, seam } = result.current;

    act(() => {
      seam.publish(clausePoint("region", "West", seam.clauseOptions));
      seam.publish(clausePoint("region", "North", seam.clauseOptions));
    });

    expect(filters.selection("region").clauses).toHaveLength(1);
    expect(filters.selection("region").clauses[0]?.value).toBe("North");
  });

  it("cannot route a field-less clause — interactors clear with the field kept", () => {
    const { result } = renderPublish();
    const { filters, seam } = result.current;

    act(() =>
      seam.publish({
        source: {},
        fields: [],
        value: null,
        predicate: null,
      }),
    );

    expect(filters.has("region")).toBe(false);
  });

  it("is a no-op outside a FiltersProvider", () => {
    const { result } = renderHook(() => useChartPublish(CLIENT));
    expect(() =>
      result.current.publish(
        clausePoint("region", "West", result.current.clauseOptions),
      ),
    ).not.toThrow();
  });
});
