import { describe, expect, it } from "vitest";
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { FakeFilterUrlPort } from "./fake-url-port";
import { FiltersProvider, usePageFilters } from "./page-filters-context";
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
