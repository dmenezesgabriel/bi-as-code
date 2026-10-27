/**
 * The duckdb-wasm `open({ query })` casts that keep result cells in
 * JS-native types for widgets. The browser engine and the node engine the
 * integration tests run both open with them, so tests meet the same cells.
 *
 * @example
 * await db.open({ query: DUCKDB_QUERY_CASTS });
 */
export const DUCKDB_QUERY_CASTS = {
  castTimestampToDate: true,
  castBigIntToDouble: true,
  // sum() and decimal literals land as Arrow Decimal128 bignums;
  // without this every aggregated KPI column is an object to the
  // widgets — the same JS-native contract the two casts above set.
  castDecimalToDouble: true,
} as const;
