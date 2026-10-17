# ADR-0017 — A data loader runs beside the data and ships only its output

Status: accepted
Date: 2026-10-17

## Context

A page names its tables in `sql:` front-matter as paths under `data/` (`src/engine/sql-frontmatter.ts`), and the browser reads them over HTTP into DuckDB-WASM ([ADR-0005](0005-queries-run-client-side-in-duckdb-wasm.md)). Data that is not a static file in the repo — a warehouse extract, an API response — needs a program to produce it. A data loader is that program: `data/<name>.<ext>.js` prints the file to stdout, and `data/<name>.<ext>` is its output (`src/engine/data-loader.ts`).

A loader can hold what must not be published: a connection string, a token, an internal hostname. Before loaders existed, `biac dev` served any file under `data/` and `biac build` copied the whole tree into `build/data/`, so a `.js` file there was public. The static build is a plain folder ([ADR-0008](0008-static-build-is-a-spa-folder.md)) that has no server to run anything, so every output must already be in it.

Three choices had to be made: which loaders a build runs, where their output is cached, and how a failing loader reaches the author when DuckDB's HTTP reader reports every failed fetch as `Failed to open file: <path>`, without its status or body.

## Decision drivers

- A built site serves the same `/data/<target>` set a dev page can fetch.
- A loader's source never leaves the machine that runs it.
- A failing loader names itself, its exit code and its stderr, in the page and in the terminal.
- `data/` and `build/` hold only what the author wrote and what ships.

## Options considered

| Option                                                                                                 | Pro                                               | Con                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Build runs only the outputs some `sql:` references                                                     | Skips loaders no page reads                       | Needs the union of every page's and `biac.config.ts`'s `sql:`; a page that fetches another path works in dev only |
| Build runs every loader under `data/`                                                                  | Same set as dev, with no reference analysis       | Runs a loader no page reads                                                                                       |
| Cache output inside `data/`                                                                            | Served and copied by the existing paths           | Generated files mix with authored ones, and get committed                                                         |
| Cache output at `.biac/cache/data/<target>`                                                            | Outside `data/` and `build/`, gitignored          | One more directory at the project root                                                                            |
| Let DuckDB's error stand                                                                               | No extra request                                  | `Failed to open file` names neither the loader nor why it failed                                                  |
| Dev answers a failing loader with a plain-text `500`; the client re-fetches it once after DuckDB fails | The block shows the loader's own message, located | A failing loader runs twice per page load; Chromium logs one `Failed to load resource` line for the re-fetch      |

## Decision

`biac build` runs every loader under `data/` whose target keeps its own extension and has no static file beside it, caches each output at `.biac/cache/data/<target>`, copies only outputs into `build/data/`, and never copies a `.js` file from `data/`. In dev, a failing loader is answered with a `text/plain` `500` carrying its error, and the client re-fetches a source DuckDB could not read to put that body in the block's error.

- **Every loader at build.** `listDataLoaderTargets` (`src/engine/data-loader.ts`) lists exactly the targets `findDataLoader` serves in dev, so whatever a dev page fetches, the build also ships. The loaders run in the plugin's `buildStart` (`src/engine/pages-plugin.ts`), so a failing loader fails the build before anything is written. A target without an extension has no loader, so a helper module such as `data/lib/rows.js` is never run as a loader.
- **Sources stay private.** `isDataLoaderSource` names every `.js` path under `data/`: `serveDataDir` (`src/engine/serve-data-dir.ts`) answers `404` for it, and `copyDataDir` (`src/engine/pages-plugin.ts`) skips it. That covers both loaders and the helper modules they import.
- **Cache outside the served trees.** `createDataLoaderCache` writes to `.biac/cache/data/<target>` through a temp file it renames on success. The output is fresh while its mtime is not older than the loader's.
- **Located failure.** `sendLoaderFailure` answers the `500` directly instead of passing it to vite's error overlay. `registerSource` calls `diagnoseUnreadable` (`src/web/src/features/data/register-source.ts`) only after DuckDB fails, and the block reads `fetch <url> → HTTP 500: data loader data/<target>.js exited with code N, expected 0; stderr: …`.

## Consequences

- Adding a loader adds an output to every build, whether or not a page reads it. Removing a loader that nothing reads is how to stop shipping its output.
- Freshness is the loader file's mtime. An edit to the loader's own inputs (a remote table, a file it reads) is not detected: delete `.biac/cache/` to force a re-run.
- A `.js` file under `data/` is never served, even one an author meant as a static asset. That is the price of a rule simple enough to trust with a secret. A future reader will be tempted to serve "helper" `.js` files that are not loaders. Don't: a helper is where a connection string ends up.
- A loader runs with the project root as its working directory (`runLoader` in `src/engine/data-loader.ts`), not the shell's: `biac dev <dir>` takes a root that need not be the cwd, so a relative path like `data/orders.csv` means the same file however `biac` was started.
- A failing loader runs twice per dev page load, once for DuckDB and once for the diagnostic re-fetch. There is no backoff: two runs are not a storm, and a backoff would hide a fix until it expired.
