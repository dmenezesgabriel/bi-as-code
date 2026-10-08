#!/usr/bin/env node
/**
 * Regenerates the shipped example project's `data/` fixtures. The row spec
 * below is the single source of truth: `data/orders.csv` is written as
 * reviewable text, then compiled to `data/orders.parquet` by the same
 * @duckdb/duckdb-wasm build the browser runs (its node blocking bindings),
 * so dev, e2e and the demo read the exact bytes this script emits.
 *
 * Region totals are pinned to the example pages' static tables — orders
 * North 120 / South 95 / West 140, revenue $4,800 / $3,700 / $6,100 — so the
 * live query results match the prose. The weekly shape follows the
 * narrative: North leads the first six weeks, West overtakes at week 7 and
 * carries the week's lift; South stays flat (7 for the last three weeks).
 *
 * `order_date` anchors the quarter to the generation week — week 13 ends on
 * the most recent Sunday — so the <DateRange> presets (`last 7 days`,
 * `last 30 days`, `month to date`) always hit fresh rows in the demo, and a
 * regen inside the same week emits an identical file. The committed CSV is
 * a snapshot: regenerate to re-anchor the window.
 *
 * Run from the repo root: `pnpm --filter biac-web generate:data`.
 */

import { rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
const dataDir = join(repoRoot, "data");

const WEEKS = 13;
const REGIONS = [
  {
    name: "North",
    weekly: [14, 13, 12, 11, 10, 10, 9, 9, 8, 7, 7, 5, 5],
    revenue: 4800,
  },
  {
    name: "South",
    weekly: [8, 7, 8, 7, 8, 7, 8, 7, 7, 7, 7, 7, 7],
    revenue: 3700,
  },
  {
    name: "West",
    weekly: [4, 5, 6, 7, 7, 8, 10, 11, 12, 14, 15, 19, 22],
    revenue: 6100,
  },
];

function total(xs) {
  return xs.reduce((sum, x) => sum + x, 0);
}

/**
 * Splits `total` into `count` integer amounts differing by at most $1,
 * spreading the remainder evenly — `sum(amounts) === total` exactly, which
 * keeps the parquet's `sum(amount)` drift-free against the static tables.
 */
function spreadAmounts(count, revenue) {
  const base = Math.floor(revenue / count);
  const remainder = revenue - base * count;
  const bumped = new Set(
    Array.from({ length: remainder }, (_, k) =>
      Math.floor((k * count) / remainder),
    ),
  );
  return Array.from(
    { length: count },
    (_, i) => base + (bumped.has(i) ? 1 : 0),
  );
}

/** Local-date `YYYY-MM-DD` — `toISOString` would shift a day across zones. */
function toIso(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** The most recent Sunday (today included) — the 13-week quarter's close. */
function quarterEnd() {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  end.setDate(end.getDate() - end.getDay());
  return end;
}

function orderRows() {
  const rows = [];
  const end = quarterEnd();
  for (const region of REGIONS) {
    if (region.weekly.length !== WEEKS) {
      throw new Error(
        `${region.name}: expected ${WEEKS} weekly counts, got ${region.weekly.length}`,
      );
    }
    const amounts = spreadAmounts(total(region.weekly), region.revenue);
    let i = 0;
    region.weekly.forEach((count, week) => {
      // The week's orders spread Mon–Sun ending (WEEKS - w) weeks before the
      // quarter close — `floor(n * 7 / count)` spreads evenly over the week.
      const weekStart = new Date(end);
      weekStart.setDate(end.getDate() - (WEEKS - 1 - week) * 7 - 6);
      for (let n = 0; n < count; n++) {
        const orderDate = new Date(weekStart);
        orderDate.setDate(weekStart.getDate() + Math.floor((n * 7) / count));
        rows.push({
          week: week + 1,
          order_date: toIso(orderDate),
          region: region.name,
          amount: amounts[i++],
        });
      }
    });
  }
  return rows
    .sort((a, b) => a.week - b.week || a.region.localeCompare(b.region))
    .map((row, index) => ({ order_id: index + 1, ...row }));
}

function toCsv(rows) {
  const lines = rows.map(
    (row) =>
      `${row.order_id},${row.week},${row.order_date},${row.region},${row.amount}`,
  );
  return `order_id,week,order_date,region,amount\n${lines.join("\n")}\n`;
}

/**
 * Compiles the on-disk csv to parquet via duckdb-wasm's node blocking
 * bindings. Absolute paths — relative ones land in the engine's MEMFS
 * sandbox, shadowed by any same-named real file.
 */
async function writeParquet(csvPath, parquetPath) {
  const require = createRequire(import.meta.url);
  const dist = dirname(
    require.resolve("@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs"),
  );
  const duckdb = require(join(dist, "duckdb-node-blocking.cjs"));
  const db = await duckdb.createDuckDB(
    {
      mvp: { mainModule: join(dist, "duckdb-mvp.wasm") },
      eh: { mainModule: join(dist, "duckdb-eh.wasm") },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await db.instantiate();
  const connection = db.connect();
  const literal = (value) => `'${value.replaceAll("'", "''")}'`;
  try {
    connection.query(
      `copy (from ${literal(csvPath)}) to ${literal(parquetPath)} (format parquet)`,
    );
  } finally {
    connection.close();
  }
}

const csvPath = join(dataDir, "orders.csv");
writeFileSync(csvPath, toCsv(orderRows()));
const parquetPath = join(dataDir, "orders.parquet");
// duckdb-wasm's fs bridge leaves a `tmp_` sibling instead of replacing an
// existing copy target — delete it so the write lands on the real path.
rmSync(parquetPath, { force: true });
await writeParquet(csvPath, parquetPath);
console.log(
  `data/orders.csv: ${total(REGIONS.map((r) => total(r.weekly)))} orders; data/orders.parquet written`,
);
