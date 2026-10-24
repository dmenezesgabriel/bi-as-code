import type { Layer } from "effect";
import type { DuckDb } from "../data/data-service";
import { duckDbLive } from "../data/duckdb-live";

/**
 * The exported widget module's DuckDB layer. The module is served from the
 * publishing origin, so its runtime and data URLs resolve against that
 * origin — never the host page's:
 *
 * - the wasm and worker assets are emitted beside the SPA's own, referenced
 *   module-relative (vite's relative base), so `import.meta.url` puts them
 *   on the publishing origin;
 * - the worker script must be same-origin with the document
 *   (https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker), so a
 *   cross-origin one is fetched and started from a blob URL
 *   (`duckdb-live.ts` `startWorker`);
 * - the data files live beside the module on the publishing origin: the
 *   module is always emitted at `<base>/widgets/<name>.js` and `data/` at
 *   `<base>/data/`, so `new URL("../", import.meta.url)` is the data base
 *   under any origin and any configured base (`register-source.ts`
 *   `dataBase`). `import.meta.env.BASE_URL` cannot carry it — the lib
 *   build's `base: ""` bakes it empty.
 *
 * @example
 * const layer = moduleDuckDbLive();
 * mountWidget(container, spec, { layer });
 */
export function moduleDuckDbLive(): Layer.Layer<DuckDb, unknown> {
  return duckDbLive({
    // `../` resolves at runtime against the emitted module's URL — vite
    // must not try to resolve it to a build-time asset.
    dataBase: new URL(/* @vite-ignore */ "../", import.meta.url).href,
  });
}
