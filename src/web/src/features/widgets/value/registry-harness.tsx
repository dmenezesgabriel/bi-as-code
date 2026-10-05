import { render } from "@testing-library/react";
import { Layer } from "effect";
import type { ReactElement } from "react";
import { DuckDb } from "../../data/data-service";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { DataRuntimeProvider } from "../../data/runtime";
import { QueryRegistryProvider } from "../../pages/query-registry";
import type { SqlBlock } from "../../pages/types";

/**
 * Mounts a widget exactly as a compiled page does — inside the page's
 * `QueryRegistryProvider` over a `FakeDuckDb` runtime — so a test asserts on
 * the `data`-name binding contract rather than seeded props.
 * `provider: false` renders bare, exercising the no-registry path. Returns
 * the fake for assertions on `queries`/`registered`.
 *
 * @example
 * renderWithRegistry(<Value data="kpi" />, { db: FakeDuckDb.withRows(rows), blocks: [KPI] });
 */
export function renderWithRegistry(
  element: ReactElement,
  {
    db = new FakeDuckDb(),
    blocks,
    provider = true,
  }: { db?: FakeDuckDb; blocks: readonly SqlBlock[]; provider?: boolean },
): FakeDuckDb {
  render(
    provider ? (
      <DataRuntimeProvider layer={Layer.succeed(DuckDb, db)}>
        <QueryRegistryProvider sqlBlocks={blocks} sqlTables={{}} params={{}}>
          {element}
        </QueryRegistryProvider>
      </DataRuntimeProvider>
    ) : (
      element
    ),
  );
  return db;
}
