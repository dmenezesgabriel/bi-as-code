import type { DuckDBBundles } from "@duckdb/duckdb-wasm";
import mvpModule from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import ehModule from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

/**
 * Self-hosted duckdb-wasm bundles: each `?url` makes vite emit the file as
 * a fingerprinted asset and hand back its URL, so the wasm module and its
 * worker script never leave the origin — no CDN fetch, no importScripts
 * blob. `coi` is omitted: it needs cross-origin-isolation headers the dev
 * server does not send, and `selectBundle` would only pick it under them.
 */
export const duckDbBundles: DuckDBBundles = {
  mvp: { mainModule: mvpModule, mainWorker: mvpWorker },
  eh: { mainModule: ehModule, mainWorker: ehWorker },
};
