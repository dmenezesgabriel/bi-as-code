import { describe, expect, it } from "vitest";
import { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { FakeFilterUrlPort } from "./fake-url-port";
import { FiltersProvider, usePageFilters } from "./page-filters-context";
import { usePageFilter } from "./use-page-filter";
import type { Filters } from "./filters";

function Probe({
  onFilters,
}: {
  onFilters: (filters: Filters | undefined) => void;
}) {
  const filters = usePageFilters();
  useEffect(() => {
    onFilters(filters);
  }, [onFilters, filters]);
  return <p>probe</p>;
}

describe("FiltersProvider", () => {
  it("supplies one stable Filters instance to consumers", () => {
    const seen: (Filters | undefined)[] = [];
    const { rerender } = render(
      <FiltersProvider port={new FakeFilterUrlPort("?region=West")}>
        <Probe onFilters={(filters) => seen.push(filters)} />
      </FiltersProvider>,
    );
    rerender(
      <FiltersProvider port={new FakeFilterUrlPort("?region=West")}>
        <Probe onFilters={(filters) => seen.push(filters)} />
      </FiltersProvider>,
    );
    expect(screen.getByText("probe")).toBeDefined();
    expect(seen[0]).toBeDefined();
    expect(seen[1]).toBe(seen[0]);
  });

  it("exposes usePageFilters as undefined outside a provider", () => {
    const seen: (Filters | undefined)[] = [];
    render(<Probe onFilters={(filters) => seen.push(filters)} />);
    expect(seen[0]).toBeUndefined();
  });

  it("filters created through the context read the port's URL", () => {
    let value: unknown;
    function Reader() {
      const filters = usePageFilters();
      useEffect(() => {
        value = filters?.ensure("region").value;
      }, [filters]);
      return null;
    }
    render(
      <FiltersProvider port={new FakeFilterUrlPort("?region=West")}>
        <Reader />
      </FiltersProvider>,
    );
    expect(value).toBe("West");
  });
});

/** An input-like consumer: ensures its filter during render, as inputs do. */
function SeededInput({
  id,
  initialValue,
}: {
  id: string;
  initialValue: string;
}) {
  usePageFilter<string>(id, { column: false, initialValue });
  return null;
}

describe("FiltersProvider onHeldParamsChange", () => {
  it("reports a value seeded while its children render", () => {
    const reports: Readonly<Record<string, unknown>>[] = [];
    render(
      <FiltersProvider
        port={new FakeFilterUrlPort("")}
        onHeldParamsChange={(params) => reports.push(params)}
      >
        <SeededInput id="span" initialValue="last 7 days" />
      </FiltersProvider>,
    );
    expect(reports).toEqual([{ span: "last 7 days" }]);
  });

  it("reports a later change, and stays quiet on an equal one", () => {
    const reports: Readonly<Record<string, unknown>>[] = [];
    let filters: Filters | undefined;
    render(
      <FiltersProvider
        port={new FakeFilterUrlPort("")}
        onHeldParamsChange={(params) => reports.push(params)}
      >
        <Probe onFilters={(seen) => (filters = seen)} />
      </FiltersProvider>,
    );
    act(() => {
      filters!.ensure("region").value = "West";
    });
    act(() => {
      filters!.ensure("other", { column: false }).value = undefined;
    });
    expect(reports).toEqual([{ region: "West" }]);
  });
  it("re-reads the URL when navigationKey changes, not on first render", () => {
    const port = new FakeFilterUrlPort("");
    let filters: Filters | undefined;
    const tree = (key: string) => (
      <FiltersProvider port={port} navigationKey={key}>
        <Probe onFilters={(f) => (filters = f)} />
      </FiltersProvider>
    );
    const { rerender } = render(tree("a"));
    filters?.ensure("island");
    port.write(new URL("http://biac.test/?island=Dream"));
    expect(filters?.get("island")?.value).toBeUndefined();

    rerender(tree("b"));

    expect(filters?.get("island")?.value).toBe("Dream");
  });
});
