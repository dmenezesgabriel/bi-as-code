import { render } from "@testing-library/react";
import { Layer } from "effect";
import type { ReactElement } from "react";
import { DuckDb } from "../../data/data-service";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { DataRuntimeProvider } from "../../data/runtime";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { FiltersProvider } from "../../filters/page-filters-context";
import { QueryRegistryProvider } from "../../pages/query-registry";
import type { SqlBlock } from "../../pages/types";

/**
 * Mounts a widget exactly as a compiled page does — inside the page's
 * `QueryRegistryProvider` over a `FakeDuckDb` runtime — so a test asserts on
 * the `data`-name binding contract rather than seeded props.
 * `provider: false` renders bare, exercising the no-registry path. `url` or
 * `port` mounts a `FiltersProvider` wrapping the registry (the page's own
 * nesting) — `url` seeds a page filter for the `filters` prop, while `port`
 * hands the test the `FakeFilterUrlPort` instance it created for assertions
 * on `written`. Returns the fake for assertions on `queries`/`registered`.
 *
 * @example
 * renderWithRegistry(<Value data="kpi" />, { db: FakeDuckDb.withRows(rows), blocks: [KPI] });
 * renderWithRegistry(<Dropdown id="region" options={[]} />, { blocks: [], port: new FakeFilterUrlPort() });
 */
export function renderWithRegistry(
  element: ReactElement,
  {
    db = new FakeDuckDb(),
    blocks,
    provider = true,
    url,
    port,
  }: {
    db?: FakeDuckDb;
    blocks: readonly SqlBlock[];
    provider?: boolean;
    url?: string;
    port?: FakeFilterUrlPort;
  },
): FakeDuckDb {
  const registry = (
    <QueryRegistryProvider sqlBlocks={blocks} sqlTables={{}} params={{}}>
      {element}
    </QueryRegistryProvider>
  );
  const filtersPort =
    port ?? (url === undefined ? undefined : new FakeFilterUrlPort(url));
  render(
    provider ? (
      <DataRuntimeProvider layer={Layer.succeed(DuckDb, db)}>
        {filtersPort === undefined ? (
          registry
        ) : (
          <FiltersProvider port={filtersPort}>{registry}</FiltersProvider>
        )}
      </DataRuntimeProvider>
    ) : (
      element
    ),
  );
  return db;
}
