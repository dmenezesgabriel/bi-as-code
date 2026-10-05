import { normalize } from "node:path/posix";
import type { PageFrontmatter, SqlTableMap } from "./types.js";

/**
 * The `sql:` front-matter key declares which `data/` files a page queries:
 * `sql: {orders: data/orders.parquet}` registers table `orders` from
 * `<project>/data/orders.parquet`. Sources are restricted to the project's
 * `data/` directory so the dev URL (`/data/…`) and the copied `dist/data/`
 * from `biac build` resolve identically. Only formats duckdb reads natively
 * are accepted; anything else is an author error worth failing loudly on.
 *
 * @example
 * sqlTableMap({ sql: { orders: "./data/orders.csv" } }, "pages/a.md");
 * // → { orders: "data/orders.csv" }
 */
export function sqlTableMap(
  frontmatter: PageFrontmatter,
  displayPath: string,
): SqlTableMap {
  const spec = frontmatter.sql;
  if (spec === undefined) return {};
  if (!isRecord(spec)) {
    throw invalidSql(
      displayPath,
      "sql",
      'a mapping of table name → "data/…" file path',
      spec,
    );
  }
  const tables: SqlTableMap = {};
  for (const [name, source] of Object.entries(spec)) {
    if (!name) {
      throw invalidSql(displayPath, "sql", "a non-empty table name", name);
    }
    if (typeof source !== "string") {
      throw invalidSql(displayPath, `sql.${name}`, "a string path", source);
    }
    tables[name] = normalizeSource(source, displayPath, name);
  }
  return tables;
}

function normalizeSource(
  source: string,
  displayPath: string,
  name: string,
): string {
  const normalized = normalize(source);
  if (
    !normalized.startsWith("data/") ||
    !/\.(csv|json|arrow|parquet)$/i.test(normalized)
  ) {
    throw invalidSql(
      displayPath,
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
  displayPath: string,
  field: string,
  expected: string,
  value: unknown,
): Error {
  return new Error(
    `Invalid front-matter in ${displayPath} — ${field}: expected ${expected}, got ${JSON.stringify(value)}`,
  );
}
