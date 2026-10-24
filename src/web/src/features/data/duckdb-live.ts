import { AsyncDuckDB, selectBundle, VoidLogger } from "@duckdb/duckdb-wasm";
import { Effect, Layer, Semaphore } from "effect";
import { duckDbBundles } from "./bundles";
import { DuckDb, type DuckDbService } from "./data-service";
import { registerSource } from "./register-source";
import { runQuery } from "./run-query";
import { toRows } from "./to-rows";
import { DataError } from "./types";

/**
 * selectBundle → worker → instantiate → open. `castTimestampToDate` and
 * `castBigIntToDouble` keep timestamps/ints in JS-native types for widgets.
 * Not unit-tested: jsdom has no Worker/wasm — the e2e-browser spec owns it.
 */
const acquireDuckDb = Effect.acquireRelease(
  Effect.tryPromise({
    try: async () => {
      const bundle = await selectBundle(duckDbBundles);
      if (!bundle.mainWorker) {
        throw new Error("selected duckdb-wasm bundle has no worker script");
      }
      const db = new AsyncDuckDB(
        new VoidLogger(),
        await startWorker(bundle.mainWorker),
      );
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      await db.open({
        query: {
          castTimestampToDate: true,
          castBigIntToDouble: true,
          // sum() and decimal literals land as Arrow Decimal128 bignums;
          // without this every aggregated KPI column is an object to the
          // widgets — the same JS-native contract the two casts above set.
          castDecimalToDouble: true,
        },
      });
      await disableExternalFileCache(db);
      return db;
    },
    catch: (cause) =>
      new DataError({
        operation: "instantiate",
        detail: "duckdb-wasm bootstrap",
        cause,
      }),
  }),
  (db) => Effect.promise(() => db.terminate()),
);

/**
 * DuckDB's external file cache keeps a file's bytes and size by path, so
 * once a data file changes under `biac dev` a re-registration reads the
 * old copy — a smaller parquet fails "No magic bytes found at end of
 * file". Tables are materialized at registration, so only registration
 * reads go through the cache.
 */
async function disableExternalFileCache(db: AsyncDuckDB): Promise<void> {
  const connection = await db.connect();
  try {
    await connection.query("SET GLOBAL enable_external_file_cache = false");
  } finally {
    await connection.close();
  }
}

/**
 * The live `DuckDb` layer: one lazily-acquired `AsyncDuckDB` whose worker
 * dies when the layer's scope closes (`ManagedRuntime.dispose`). The layer
 * is thin glue — the query path lives in `run-query.ts` and source dispatch
 * in `register-source.ts`, both unit-tested without wasm.
 *
 * `dataBase` overrides where the data files live: an exported widget
 * module passes its deployment base (`new URL("../", import.meta.url)` in
 * `module-runtime.ts`), so registration resolves `data/…` beside the
 * module instead of under the host page's root. The SPA's `DuckDbLive`
 * passes nothing — the page's origin plus the baked base path.
 *
 * @example
 * const moduleLayer = duckDbLive({
 *   dataBase: "https://biac.example.com/bi-as-code/",
 * });
 */
export function duckDbLive(
  options: { dataBase?: string } = {},
): Layer.Layer<DuckDb, DataError> {
  return Layer.effect(
    DuckDb,
    Effect.zipWith(acquireDuckDb, Semaphore.make(1), (db, registrations) =>
      serviceOf(db, registrations, options.dataBase),
    ),
  );
}

export const DuckDbLive: Layer.Layer<DuckDb, DataError> = duckDbLive();

/**
 * Registrations run one at a time: each drops and re-registers its file,
 * so two overlapping registrations of one source (a page left mid-load
 * while the next registers the same project-wide table) would drop the
 * file under the other's read — duckdb then fails it with "No files found
 * that match the pattern".
 */
function serviceOf(
  db: AsyncDuckDB,
  registrations: Semaphore.Semaphore,
  dataBase: string | undefined,
): DuckDbService {
  return {
    registerTable: (name, source) =>
      registrations.withPermit(registerTableEffect(db, name, source, dataBase)),
    query: (sql, params = []) => runQuery(db, sql, params),
    queryRows: (sql, params = []) =>
      Effect.map(runQuery(db, sql, params), toRows),
  };
}

function registerTableEffect(
  db: AsyncDuckDB,
  name: string,
  source: string,
  dataBase: string | undefined,
): Effect.Effect<void, DataError> {
  const fail = (cause: unknown) =>
    new DataError({
      operation: "registerTable",
      detail: `${name} ← ${source}`,
      cause,
    });
  return Effect.gen(function* () {
    const connection = yield* Effect.acquireRelease(
      Effect.tryPromise({ try: () => db.connect(), catch: fail }),
      (conn) => Effect.promise(() => conn.close()),
    );
    yield* Effect.tryPromise({
      try: () => registerSource(db, connection, name, source, dataBase),
      catch: fail,
    });
  }).pipe(Effect.scoped);
}

/**
 * A worker's URL resolves against the document's location and the script
 * must be same-origin with the document
 * (https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker). The
 * SPA's worker is; an exported module's lives on the publishing origin, so
 * its script is fetched and started from a blob URL — same-origin by
 * construction. The fetch needs the module CORS grant (the wasm/worker
 * assets answer the origins the module grant lists).
 */
async function startWorker(url: string): Promise<Worker> {
  if (new URL(url, location.href).origin === location.origin) {
    return new Worker(url);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `fetch ${url} → HTTP ${response.status} — the duckdb worker script`,
    );
  }
  const source = await response.text();
  const blob = new Blob([source], { type: "text/javascript" });
  return new Worker(URL.createObjectURL(blob));
}
