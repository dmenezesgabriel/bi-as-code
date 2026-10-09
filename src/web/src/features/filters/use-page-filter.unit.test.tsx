import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeFilterUrlPort } from "./fake-url-port";
import type { Filter, FilterOptions } from "./filter";
import { FiltersProvider } from "./page-filters-context";
import { usePageFilter } from "./use-page-filter";

const ARRAY_CODEC: FilterOptions<string | string[]> = {
  serialize: (value) => {
    if (value === undefined || value === "") return undefined;
    return Array.isArray(value) ? JSON.stringify(value) : value;
  },
  deserialize: (raw) => (raw.startsWith("[") ? JSON.parse(raw) : raw),
};

function probe(
  id: string,
  opts: FilterOptions<string | string[]> | undefined,
  seen: (Filter<string | string[]> | undefined)[],
) {
  return function Probe() {
    const filter = usePageFilter<string | string[]>(id, opts);
    seen.push(filter);
    return null;
  };
}

describe("usePageFilter", () => {
  it("is undefined outside a FiltersProvider", () => {
    const seen: (Filter<string | string[]> | undefined)[] = [];
    const Probe = probe("region", undefined, seen);
    render(<Probe />);
    expect(seen[0]).toBeUndefined();
  });

  it("ensures the filter with its options — visible on the first render", () => {
    const seen: (Filter<string | string[]> | undefined)[] = [];
    const Probe = probe(
      "channel",
      { column: "sales_channel", ...ARRAY_CODEC },
      seen,
    );
    render(
      <FiltersProvider port={new FakeFilterUrlPort('?channel=["a","b"]')}>
        <Probe />
      </FiltersProvider>,
    );
    const filter = seen[0];
    expect(filter).toBeDefined();
    expect(filter!.value).toEqual(["a", "b"]);
    expect(filter!.selection.clauses[0]?.predicate).toEqual({
      sql: "sales_channel IN (?, ?)",
      params: ["a", "b"],
    });
  });

  it("re-renders when the filter's value changes", () => {
    const seen: (Filter<string | string[]> | undefined)[] = [];
    const Probe = probe("region", undefined, seen);
    render(
      <FiltersProvider port={new FakeFilterUrlPort("")}>
        <Probe />
      </FiltersProvider>,
    );
    const filter = seen[seen.length - 1];
    act(() => {
      filter!.value = "West";
    });
    expect(seen[seen.length - 1]!.value).toBe("West");
  });

  it("seeds initialValue when nothing holds a value", () => {
    const seen: (Filter<string | string[]> | undefined)[] = [];
    const port = new FakeFilterUrlPort("");
    const Probe = probe("region", { initialValue: "West" }, seen);
    render(
      <FiltersProvider port={port}>
        <Probe />
      </FiltersProvider>,
    );
    expect(seen[0]!.value).toBe("West");
    expect(port.written).toHaveLength(0);
  });
});
