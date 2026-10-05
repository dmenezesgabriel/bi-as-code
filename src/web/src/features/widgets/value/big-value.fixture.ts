import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import type { SqlBlock } from "../../pages/types";

/**
 * Shared `<BigValue>` fixture for unit tests and stories: a 1-row `kpi`
 * aggregate and a 13-point `weekly_revenue` series — the two named fences a
 * composed KPI binds. `dbWith` seeds each query's own rows through
 * `FakeDuckDb.rowsWhen`.
 */
export const KPI: SqlBlock = {
  name: "kpi",
  sql: "select revenue, wow_pct, orders from orders",
};

export const WEEKLY: SqlBlock = {
  name: "weekly_revenue",
  sql: "select week, revenue from weekly",
};

export const KPI_ROWS: Row[] = [
  { revenue: 1234567, wow_pct: 0.052, orders: 355 },
];

export const WEEKLY_ROWS: Row[] = Array.from({ length: 13 }, (_, i) => ({
  week: i + 1,
  revenue: 800 + i * 40,
}));

/** `kpi` gets `kpiRows`; the sparkline's `weekly_revenue` gets `weeklyRows`. */
export function dbWith(
  kpiRows: Row[],
  weeklyRows: Row[] = WEEKLY_ROWS,
): FakeDuckDb {
  const db = FakeDuckDb.withRows(kpiRows);
  db.rowsWhen = (sql) => (sql.includes("weekly") ? weeklyRows : null);
  return db;
}
