import { normalize } from "node:path/posix";
import type { SqlTableMap } from "./types.js";

/**
 * A `sql:` map declares which `data/` files a page or `biac.config.ts`
 * queries: `sql: {orders: data/orders.parquet}` registers table `orders`
 * from `<project>/data/orders.parquet`. Sources are restricted to the
 * project's `data/` directory so the dev URL (`/data/…`) and the copied
 * `dist/data/` from `biac build` resolve identically. Only formats duckdb
 * reads natively are accepted; anything else is an author error worth
 * failing loudly on. `location` labels where the map was declared so the
 * error names its source ("front-matter in pages/a.md", "biac.config.ts").
 *
 * @example
 * sqlTableMap({ orders: "./data/orders.csv" }, "front-matter in pages/a.md");
 * // → { orders: "data/orders.csv" }
 */
export function sqlTableMap(spec: unknown, location: string): SqlTableMap {
  if (spec === undefined) return {};
  if (!isRecord(spec)) {
    throw invalidSql(
      location,
      "sql",
      'a mapping of table name → "data/…" file path',
      spec,
    );
  }
  const tables: SqlTableMap = {};
  for (const [name, source] of Object.entries(spec)) {
    if (!name) {
      throw invalidSql(location, "sql", "a non-empty table name", name);
    }
    if (typeof source !== "string") {
      throw invalidSql(location, `sql.${name}`, "a string path", source);
    }
    tables[name] = normalizeSource(source, location, name);
  }
  return tables;
}

/**
 * Page `sql:` names and `biac.config.ts` `sql:` names share one table
 * registry — a page re-declaring a config name is an author error, not an
 * override, so compilation fails naming both sources.
 */
export function assertNoSqlTableCollision(
  pageTables: SqlTableMap,
  configTables: SqlTableMap,
  location: string,
): void {
  for (const name of Object.keys(pageTables)) {
    const configSource = configTables[name];
    if (configSource === undefined) continue;
    throw invalidSql(
      location,
      `sql.${name}`,
      `a name not already declared by biac.config.ts (${JSON.stringify(configSource)})`,
      pageTables[name],
    );
  }
}

function normalizeSource(
  source: string,
  location: string,
  name: string,
): string {
  const normalized = normalize(source);
  if (
    !normalized.startsWith("data/") ||
    !/\.(csv|json|arrow|parquet)$/i.test(normalized)
  ) {
    throw invalidSql(
      location,
      `sql.${name}`,
      'a "data/…" path ending .csv, .json, .arrow or .parquet',
      source,
    );
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidSql(
  location: string,
  field: string,
  expected: string,
  value: unknown,
): Error {
  return new Error(
    `Invalid ${location} — ${field}: expected ${expected}, got ${JSON.stringify(value)}`,
  );
}
