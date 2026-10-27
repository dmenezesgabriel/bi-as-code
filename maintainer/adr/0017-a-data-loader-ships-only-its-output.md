# ADR-0017 — A data loader runs beside the data and ships only its output

Status: accepted
Date: 2026-10-17

## Context

A page names its tables in `sql:` front-matter as paths under `data/` (`src/engine/sql-frontmatter.ts`), and the browser reads them over HTTP into DuckDB-WASM ([ADR-0005](0005-queries-run-client-side-in-duckdb-wasm.md)). Data that is not a static file in the repo — a warehouse extract, an API response — needs a program to produce it. A data loader is that program: `data/<name>.<ext>.<lang>` prints the file to stdout, and `data/<name>.<ext>` is its output (`src/engine/data-loader.ts`). `<lang>` is any extension in the interpreter table (`DEFAULT_INTERPRETERS` in `src/engine/data-loader-interpreters.ts`): `.js`, `.ts`, `.py`, `.r`, `.R`, `.rs`, `.go`, `.java`, `.jl`, `.php`, `.sh` and `.exe`, the same twelve as Observable Framework's `interpreters` option (https://github.com/observablehq/framework/blob/main/docs/config.md#interpreters). A project changes the table through `interpreters` in `biac.config.ts` (`readInterpreters` in `src/engine/biac-config.ts`): `{ ".pl": ["perl"] }` adds a language, a new argv replaces a default's, and `null` drops one so its files are ordinary data again. The table is re-read on every dev request and at every build, so an edit applies without a restart; it never reaches the browser, because it holds host paths.

A loader can hold what must not be published: a connection string, a token, an internal hostname. Before loaders existed, `biac dev` served any file under `data/` and `biac build` copied the whole tree into `build/data/`, so a loader file there was public. The static build is a plain folder ([ADR-0008](0008-static-build-is-a-spa-folder.md)) that has no server to run anything, so every output must already be in it.

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

`biac build` runs every loader under `data/` whose target keeps its own extension and has no static file beside it, caches each output at `.biac/cache/data/<target>`, copies only outputs into `build/data/`, and never copies a file from `data/` whose extension is in the interpreter table. In dev, a failing loader is answered with a `text/plain` `500` carrying its error, and the client re-fetches a source DuckDB could not read to put that body in the block's error.

- **Every loader at build.** `listDataLoaderTargets` (`src/engine/data-loader.ts`) lists exactly the targets `findDataLoader` serves in dev, so whatever a dev page fetches, the build also ships. The loaders run in the plugin's `buildStart` (`src/engine/pages-plugin.ts`), so a failing loader fails the build before anything is written. A target without an extension has no loader, so a helper module such as `data/lib/rows.py` is never run as a loader.
- **Sources stay private.** `isDataLoaderSource` names every path under `data/` that ends in an interpreter-table extension, case-insensitively so `a.csv.PY` stays private on a case-insensitive filesystem: `serveDataDir` (`src/engine/serve-data-dir.ts`) answers `404` for it, and `copyDataDir` (`src/engine/pages-plugin.ts`) skips it. That covers both loaders and the helper modules they import.
- **One interpreter per extension.** `runLoader` spawns the table's argv for the loader's extension with the loader's path appended; an empty argv (`.exe`) runs the file itself. `.js` and `.ts` run with the node running biac (`process.execPath`), not a `node` or `tsx` from `PATH`; `.ts` relies on Node's type stripping (https://nodejs.org/docs/latest-v24.x/api/typescript.html), which is why `package.json` requires Node `>=24.12.0`. An interpreter missing from `PATH` is a located failure, `data loader <loader> could not start: command "<cmd>" not found on PATH`, not the raw `spawn ENOENT`.
- **One loader per target.** Two loaders for one target (`data/a.csv.js` beside `data/a.csv.py`) is an error naming both — a dev `500` and a failed build — rather than first-match precedence, which would silently leave one of them stale. A static file at the target still wins over any loader.
- **Cache outside the served trees.** `createDataLoaderCache` writes to `.biac/cache/data/<target>` through a temp file it renames on success. The output is fresh while its mtime is not older than the loader's.
- **Located failure.** `sendLoaderFailure` answers the `500` directly instead of passing it to vite's error overlay. `registerSource` calls `diagnoseUnreadable` (`src/web/src/features/data/register-source.ts`) only after DuckDB fails, and the block reads `fetch <url> → HTTP 500: data loader data/<target>.<lang> exited with code N, expected 0; stderr: …`.

## Consequences

- Adding a loader adds an output to every build, whether or not a page reads it. Removing a loader that nothing reads is how to stop shipping its output.
- Freshness is the loader file's mtime. An edit to the loader's own inputs (a remote table, a file it reads) or a new argv for its language in `interpreters` is not detected: delete `.biac/cache/` to force a re-run.
- A file under `data/` with an interpreter-table extension (`.js`, `.py`, `.sh`, …) is never served, even one an author meant as a static asset. That is the price of a rule simple enough to trust with a secret. A future reader will be tempted to serve "helper" program files that are not loaders. Don't: a helper is where a connection string ends up.
- A loader runs with the project root as its working directory (`runLoader` in `src/engine/data-loader.ts`), not the shell's: `biac dev <dir>` takes a root that need not be the cwd, so a relative path like `data/orders.csv` means the same file however `biac` was started.
- A failing loader runs twice per dev page load, once for DuckDB and once for the diagnostic re-fetch. There is no backoff: two runs are not a storm, and a backoff would hide a fix until it expired.
