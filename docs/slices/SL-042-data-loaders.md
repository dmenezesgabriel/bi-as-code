# SL-042 — A program beside the data generates the file a page queries

Milestone: Phase 3 — Data loaders · State: open · Depends on: — · Closes: GAP-031, GAP-032, GAP-033, GAP-034, GAP-035, GAP-036

> Delete this file when the slice ships. Every `research_repos/` path below was checked with `test -e` on 2026-10-17; `~N` line hints were checked with `sed -n` the same day.

## Outcome

An author writes `data/<name>.<ext>.js` — a program that prints the file to stdout — and a page's `sql: {t: data/<name>.<ext>}` queries its output in `biac dev` and in a built site, while the program's source is never served or shipped.

## Demo

1. Cold start: `bin/biac dev`, open the example page whose `sql:` names a loader output (the page and `data/*.csv.js` added by T5) — its figures render; the dev log names the loader run once.
2. Reload the page — the figures render again and the dev log shows no second run (cached output, loader unchanged).
3. `curl -i http://localhost:5175/data/<name>.csv` → `200` with the loader's output; `curl -i http://localhost:5175/data/<name>.csv.js` → `404`.
4. Break the loader (`process.exit(1)` at its top), `touch` it, reload the page — the page shows a located error naming `data/<name>.csv.js` and its exit code; the dev log carries the same line and the loader's stderr.
5. Stop the dev server; `bin/biac build` with the loader still broken → the build exits non-zero naming the loader.
6. Restore the loader; `bin/biac build` → succeeds; `find build/data -name '*.js'` prints nothing; `build/data/<name>.csv` exists.
7. `bin/biac preview`, open the example page — the same figures as step 1.

## Who else implements this

| Repo      | Has it | Entry points                                                                    | Approach in one line                                                                                                                                         |
| --------- | ------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| evidence  | ABSENT | `evidence/docs/core-concepts/models.mdx`, `evidence/cli/cli/models.ts`          | SQL "models" materialized by the hosted evidence.studio service on a schedule; the local CLI only lists their status — no local program produces a data file |
| framework | FULL   | `framework/src/loader.ts`, `framework/src/preview.ts`, `framework/src/build.ts` | `quakes.csv.js` beside the data: its stdout is cached as `quakes.csv`, run on first request in preview and for referenced files at build                     |
| mosaic    | ABSENT | `mosaic/packages/server/duckdb-server/pkg/server.py`                            | A query server over a live DuckDB connection; it neither generates nor caches files                                                                          |
| streamlit | ABSENT | `streamlit/lib/streamlit/runtime/caching/cache_data_api.py`                     | In-process memoization of a function's return value (`ttl`, `max_entries`, `persist`) — reference only for cache keys and expiry                             |

**Count:** 1 of 4 implement this. The one that does is the closest product to ours (markdown pages, client-side DuckDB, `sql:` front-matter), and its own SQL guide routes "a SQL query on a remote database" to a data loader (`framework/docs/sql.md:8`). The Phase 3 goal — data that is not a static file in the repo — needs it, and our pipeline today publishes a loader's source as a public file (GAP-032), so shipping it is also a leak fix.

## Implementation inventory

### framework

| Concern                          | Files                                                                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User contract                    | `framework/docs/data-loaders.md` § Routing (~144), Execution (~164; working directory ~206), Output (~231; stdout is the file, stderr is the log ~233), Building (~235), Caching (~292), Errors (~314)     |
| Resolution: target path → loader | `framework/src/loader.ts` — `LoaderResolver.find` ~125, `findFile` ~146: a static file at the target wins, else `<target><interpreter-ext>`                                                                |
| Interpreters                     | `framework/src/loader.ts` — `defaultInterpreters` ~26 (`.js` → `node --no-warnings=ExperimentalWarning`); `framework/docs/config.md` § interpreters ~262                                                   |
| Execution                        | `framework/src/loader.ts` — `CommandLoader.exec` ~467–497: `spawn(command, args, {stdio: ["ignore", output, "inherit"]})`, no `cwd` (inherits the CLI's), non-zero exit throws `loader exited with code N` |
| Cache, freshness, atomic write   | `framework/src/loader.ts` — `AbstractLoader.load` ~401–442: output in `.observablehq/cache/<target>`, fresh when cache mtime ≥ loader mtime, written to `<target>.<pid>` then renamed                      |
| Concurrent requests              | `framework/src/loader.ts` — `runningCommands` ~24: one run per target, every caller awaits the same promise                                                                                                |
| Failure backoff                  | `framework/src/loader.ts` — inside `AbstractLoader.load`: the temp file is renamed to `.err`; a failure newer than the loader and under 1 s old throws `loader skipped due to recent error`                |
| Dev serving                      | `framework/src/preview.ts` ~179–183: the `/_file/` branch calls `loaders.find(path)` then `loader.load()`                                                                                                  |
| Empty / error states             | `framework/src/preview.ts` ~222–235: missing → 404 `File not found` (text/plain); any other error → 500 + `console.error`; `framework/src/loader.ts` logs `success <size>` / `empty output` / `error …`    |
| Build: which loaders run         | `framework/src/resolvers.ts` ~133–134: `page.data.sql` values join the page's referenced files; `framework/src/build.ts` ~230–236: each referenced file runs `loader.load({useStale: true})`               |
| Build: stale cache               | `framework/src/build.ts` + `AbstractLoader.load` — `useStale: true` serves any cached output regardless of mtime (docs § Caching: CI caches don't preserve mtimes)                                         |
| Tests and fixtures               | `framework/test/loader-test.ts`; `framework/test/input/build/data-loaders/` (`test.txt.js`, `index.md`, `import-test.js`, `test.js`)                                                                       |

### evidence, mosaic, streamlit — read for contrast only

| Concern                | Files                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted materialization | `evidence/docs/core-concepts/models.mdx`; `evidence/cli/cli/models.ts`                                                                                           |
| Query server, no files | `mosaic/packages/server/duckdb-server/pkg/server.py`                                                                                                             |
| Cache keys and expiry  | `streamlit/lib/streamlit/runtime/caching/cache_data_api.py`; `streamlit/lib/streamlit/runtime/caching/storage/local_disk_cache_storage.py` (on-disk persistence) |

The disagreement between them is the loader model itself (D1): a local program's stdout (framework) vs a hosted scheduled materialization (evidence) vs no files at all (mosaic, streamlit). Only the first fits a local `biac dev` and a static `biac build`.

## Trade-offs and what we adopt

| Axis                     | Options seen (repo → approach)                                             | Trade-off                                                                                                          | Our choice, and why                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| D1 Loader model          | framework → stdout is the file; evidence → hosted SQL models               | Hosted needs a service and an account; stdout needs nothing                                                        | stdout → file — the only one that runs locally and ends in a static `build/`                                                    |
| D2 When it runs in dev   | framework → first request for the output                                   | Eager start-up runs would slow `biac dev` start by every loader's runtime, including ones no open page needs       | First request                                                                                                                   |
| D3 Freshness key         | framework → loader mtime vs cache mtime; streamlit → hashed inputs + `ttl` | mtime misses a loader's own inputs changing; hashing inputs needs to know them                                     | mtime — a loader's inputs are unknowable to us; a `ttl` is not asked for                                                        |
| D5 Stale cache at build  | framework → `useStale: true` (any cached output wins)                      | `useStale` lets a CI cache skip slow loaders, and ships a stale output after an edit that kept the old mtime order | Re-run when stale — we have no CI cache story; a build that ships what the loader produces today is the less surprising default |
| D6 Cache location        | framework → `.observablehq/cache/` inside the source root                  | Inside `data/` it would be served by the `/data` mount and copied by the build                                     | `.biac/cache/data/<target>` at the project root — outside `data/`, outside `build/`, gitignored                                 |
| D8 Interpreters          | framework → 12 defaults + config map                                       | Each interpreter is a dependency on the host                                                                       | `.js` only, run with `process.execPath` (the node already running biac — no `PATH` lookup)                                      |
| Loader working directory | framework → inherits the CLI's cwd (docs ~206)                             | `biac dev <dir>` takes a project root that need not be the cwd                                                     | The project root, set explicitly as `cwd` — the same directory `biac` resolves `pages/` and `data/` from                        |
| Concurrent requests      | framework → one run per target (`runningCommands`)                         | DuckDB's HTTP filesystem issues several ranged GETs for one file at once; without dedupe each would spawn a run    | One in-flight run per target, every request awaits it                                                                           |

## Gap analysis — what we already have vs the references

| Concern                         | Ours today (file)                                                                                                                                                                                                                       | Best reference (file)                                   | Gap                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| Output served in dev            | `src/engine/serve-data-dir.ts` `serveDataDir` → `statFile` → 404 for anything not on disk                                                                                                                                               | `framework/src/preview.ts` `/_file/` branch             | GAP-031 — absent                             |
| Loader source kept private      | `src/engine/serve-data-dir.ts` streams any file under `data/`, `*.js` as `application/octet-stream` (R6 measured `200`, 37 bytes, the source)                                                                                           | `framework/src/loader.ts` `findFile` routes only output | GAP-032 — absent                             |
| Build output                    | `src/engine/pages-plugin.ts` `writeBundle` → `copyDataDir` → `cp(dataDir, outDataDir, {recursive: true, dereference: true})`; `src/cli/commands/build.ts` only calls `viteBuild`                                                        | `framework/src/build.ts` copy loop                      | GAP-033 — absent: sources copied, none run   |
| `sql:` accepts a generated file | `src/engine/sql-frontmatter.ts` `normalizeSource` accepts any `data/…` path ending `.csv/.json/.arrow/.parquet` — the output path already validates; it 404s at fetch                                                                   | `framework/src/resolvers.ts` ~133                       | GAP-034 — partial: validator stays unchanged |
| Cache                           | none; `.gitignore` has no cache entry                                                                                                                                                                                                   | `framework/src/loader.ts` `AbstractLoader.load`         | GAP-035 — absent                             |
| Failure                         | none to fail. A source that fails to fetch today surfaces via `src/web/src/features/data/register-source.ts` `registerSource` → `src/web/src/features/pages/query-registry.tsx` `registerAll` → every block's display-ready `DataError` | `framework/src/preview.ts` ~222–235; `CommandLoader`    | GAP-036 — absent                             |

Nothing in the ledger claims `shipped` for any part of this.

## Deviations

- URL and layout: we keep `/data/<path>` in dev and unhashed `build/data/<path>` (the contract stated on `serveDataDir` and `copyDataDir`), not framework's `/_file/<path>?sha=…` with hashed aliases — page SQL never rewrites between modes.
- No `.err` 1 s backoff unless T3 measures a failing loader being re-spawned by DuckDB's parallel ranged GETs after the in-flight run ends; the in-flight dedupe may already cover it.
- Loader `cwd` is the project root, not the process cwd (see Trade-offs).

## Open decisions

| Id  | Decision                                   | Evidence to gather before deciding                                                                                                                                                                                                                                                                                                         | Leaning                                                                                                              |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | D4 — which loaders `biac build` runs       | framework runs only outputs referenced by a page's `sql:` (`framework/src/resolvers.ts` ~133). Ours copies the whole `data/` tree, and `biac.config.ts` `sql:` tables are project-wide, so "referenced" means the union of every page's and the config's `sql:`. Count what each would run on `pages/` + `data/`                           | Every loader under `data/` — matches copy-everything; a loader nobody references is the author's to delete           |
| 2   | D7 — how a failing loader reaches the page | DuckDB's HTTP filesystem does not surface a response body. Measure the block error message a `500` on a `.csv` and on a `.parquet` source produces today; candidates: (a) a `500` whose status text names the loader and exit code, (b) `registerSource` pre-fetching with `HEAD`/`GET` and reading a `text/plain` body before registering | Whichever puts `data/<name>.csv.js` and the exit code in the block's error with no extra request on the success path |
| 3   | Loader stderr                              | framework inherits stderr into the server terminal. Decide whether the dev log line and the build error also quote the last lines of stderr (a buffered tail) so an error is located without scrolling                                                                                                                                     | Inherit to the terminal, and quote a bounded tail in the thrown error                                                |
| 4   | Empty output                               | framework logs `empty output` and serves it. Measure what DuckDB reports for a zero-byte `.csv` / `.parquet`                                                                                                                                                                                                                               | Serve it; the log line says `empty`                                                                                  |

Each settled decision that outlives the slice (D4, D6, D7) is recorded in an ADR before the slice ships.

## Surface

| Layer  | Files                                                                                                                                                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | new `src/engine/data-loader.ts` (+ `data-loader.unit.test.ts`): resolve a target to a loader, run it, cache the output; `src/engine/serve-data-dir.ts` (serve loader output, 404 loader sources); `src/engine/pages-plugin.ts` (`writeBundle` / `copyDataDir`) |
| client | `src/web/src/features/data/register-source.ts` only if open decision 2 picks (b)                                                                                                                                                                               |
| ui     | none expected — the block error state already renders a `DataError` message                                                                                                                                                                                    |
| config | `.gitignore` (`.biac/`)                                                                                                                                                                                                                                        |
| pages  | an example `data/<name>.csv.js` and a page under `pages/` whose `sql:` names its output                                                                                                                                                                        |
| tests  | `test/integration/data-files.integration.test.ts`, `test/integration/static-build.integration.test.ts`, `test/e2e/dev-server.e2e.test.ts`, `test/e2e/static-build.e2e.test.ts`, a new `test/e2e-browser/data-loaders.spec.ts`                                  |

## Tasks

- [x] T1 — Engine: resolve, run and cache a `.js` loader. Unit tests: a static file at the target wins over a loader; the output is the loader's stdout; written to a temp file then renamed into `.biac/cache/`; fresh when cache mtime ≥ loader mtime, re-run when older; concurrent loads of one target spawn one process; a non-zero exit throws naming the loader path, exit code and stderr tail; `cwd` is the project root. Closes GAP-035.
- [ ] T2 — Dev serving: `/data/<name>.csv` serves the loader's output through the existing range/HEAD path, `/data/<name>.csv.js` → 404. Integration tests in `test/integration/data-files.integration.test.ts`; `curl` against `bin/biac dev`. Closes GAP-031, GAP-032.
- [ ] T3 — Dev failure: settle open decisions 2–4; a failing loader shows a located error in the page's blocks and in the dev log. `playwright-cli`: the example page with a broken loader — screenshot, `eval` the block error text, console. Closes GAP-036 (dev).
- [ ] T4 — Build: settle open decision 1; `biac build` runs loaders (re-running stale ones), writes only outputs into `build/data/`, never copies a loader source, and fails naming the loader when one fails. Tests in `test/integration/static-build.integration.test.ts` and `test/e2e/static-build.e2e.test.ts`. Closes GAP-033, GAP-036 (build).
- [ ] T5 — Example and browser e2e: the example loader + page, `test/e2e-browser/data-loaders.spec.ts` driving the page in dev and preview, the ADR for D4/D6/D7, then the Demo. Closes GAP-034.

## Out of scope

- Re-running a loader or refreshing the page when a loader or static `data/` file is edited under `biac dev` — SL-043 (GAP-037).
- Interpreters beyond `.js` and an `interpreters` map in `biac.config.ts` — SL-044 (GAP-038).
- Archives (`.zip`/`.tar` extraction) and `[param]` loaders — not proposed for Phase 3.
- Remote warehouse connectors — the Connectors phase.
