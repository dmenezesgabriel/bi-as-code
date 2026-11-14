import type { ReactElement } from "react";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { SqlBlock } from "../../pages/types";
import { renderWithRegistry } from "./registry-harness";

/** The `kpi` fence the value widgets' unit tests bind their `data` to. */
export const KPI: SqlBlock = {
  name: "kpi",
  sql: "select revenue, wow_pct from orders",
};

export interface KpiRenderOptions {
  db?: FakeDuckDb;
  blocks?: SqlBlock[];
  provider?: boolean;
  url?: string;
}

/**
 * Mounts a value widget over the `kpi` fence and a fresh `FakeDuckDb`
 * unless the options say otherwise.
 *
 * @example
 * renderKpi(<Value data="kpi" />, { db: FakeDuckDb.withRows(rows) });
 */
export function renderKpi(
  element: ReactElement,
  {
    db = new FakeDuckDb(),
    blocks = [KPI],
    provider = true,
    url,
  }: KpiRenderOptions = {},
): FakeDuckDb {
  return renderWithRegistry(element, { db, blocks, provider, url });
}
