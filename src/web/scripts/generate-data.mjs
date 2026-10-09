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
 * `data/flights.parquet` is the cross-filter scale fixture: 200,000 synthetic
 * flights (`delay` minutes, `distance` miles, `time` hour of day) in the
 * shape of mosaic's flights-200k benchmark
 * (https://github.com/uwdata/mosaic/blob/main/specs/yaml/flights-200k.yaml).
 * It is built in SQL from `range()` with `hash()`-derived values, so a regen
 * is byte-identical.
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

const FLIGHTS = 200_000;

/**
 * Uniform [0, 1) per row and stream — `hash(i, stream)` decorrelates the
 * three columns' draws while staying deterministic.
 */
function uniform(stream) {
  return `(hash(i, '${stream}') % 1000000) / 1000000.0`;
}

/**
 * Daytime departures (06–22h); short hops dominate (`u²` skew); delays are
 * exponential with a mean that grows through the day, so brushing late
 * departures visibly shifts the delay histogram right.
 */
function flightsSql() {
  return `select
  round(-ln(1 - ${uniform("delay")}) * (8 + 2 * time) - 10)::integer as delay,
  round(100 + 2900 * pow(${uniform("distance")}, 2))::integer as distance,
  time
from (
  select i, round(6 + 16 * ${uniform("time")}, 2) as time
  from range(${FLIGHTS}) t(i)
)`;
}

/**
 * Opens a duckdb-wasm connection through its node blocking bindings — the
 * same build the browser runs, so dev, e2e and the demo read the exact
 * bytes this script emits.
 */
async function connectDuckDb() {
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
  return db.connect();
}

const literal = (value) => `'${value.replaceAll("'", "''")}'`;

/**
 * Writes `source` (a query) to `parquetPath`. Absolute paths — relative ones
 * land in the engine's MEMFS sandbox, shadowed by any same-named real file.
 */
function copyToParquet(connection, source, parquetPath, options = "") {
  // duckdb-wasm's fs bridge leaves a `tmp_` sibling instead of replacing an
  // existing copy target — delete it so the write lands on the real path.
  rmSync(parquetPath, { force: true });
  connection.query(
    `copy (${source}) to ${literal(parquetPath)} (format parquet${options})`,
  );
}

const csvPath = join(dataDir, "orders.csv");
writeFileSync(csvPath, toCsv(orderRows()));
const connection = await connectDuckDb();
try {
  copyToParquet(
    connection,
    `from ${literal(csvPath)}`,
    join(dataDir, "orders.parquet"),
  );
  copyToParquet(
    connection,
    flightsSql(),
    join(dataDir, "flights.parquet"),
    ", compression zstd",
  );
} finally {
  connection.close();
}
console.log(
  `data/orders.csv: ${total(REGIONS.map((r) => total(r.weekly)))} orders; data/orders.parquet, data/flights.parquet (${FLIGHTS} rows) written`,
);
