# SL-029 — Running the tests leaves `biac dev`'s dep cache warm and leaves no temp dirs behind

Milestone: Phase 1 — Known debt · State: open · Depends on: SL-028 · Closes: Known-debt orphaned `deps_temp_*` row

## Outcome

After any test tier or a full `pnpm gate`, `src/web/node_modules/.vite` gains no `deps_temp_*` dir and still holds the `deps/` cache `biac dev` wrote, so the next `bin/biac dev` starts warm instead of re-bundling 35 deps.

## Demo

1. `ls -d src/web/node_modules/.vite/deps_temp_* | wc -l` → note N; `node -p 'require("./src/web/node_modules/.vite/deps/_metadata.json").configHash'` → note H (run `bin/biac dev`, load `/`, `Ctrl-C` first if `deps/` is absent).
2. `pnpm gate` → passes.
3. Repeat step 1 → still N temp dirs, `deps/` present, configHash still H.
4. `DEBUG=vite:deps bin/biac dev` → `/weekly-review` loads; the log has no `scanning for dependencies` / `creating package.json in …deps_temp_…` line (warm start).
5. `bin/biac dev` → `Ctrl-C` within 1 s of `Local:` → N unchanged.
6. `bin/biac build` → passes.

## Root cause — measured 2026-10-13, vite 8.2.2, vitest 4.1.11

| Fact                                                                                                                                                            | Evidence                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| vite hashes `define: process.env.NODE_ENV \|\| config.mode` into the deps `configHash`                                                                          | `getConfigHash` in `node_modules/.pnpm/vite@8.2.2_…/node_modules/vite/dist/node/chunks/node.js`                                                                                                   |
| vitest sets `process.env.NODE_ENV` to `"test"` in its workers; every child they spawn inherits it                                                               | scratch test asserting `process.env.NODE_ENV` received `"test"` under `vitest run`; plain `node -e` prints `undefined`                                                                            |
| A config-hash mismatch makes vite drop `deps/` and re-optimize into `deps_temp_<hash>`                                                                          | `NODE_ENV=test DEBUG=vite:deps bin/biac dev <tmp project>` + one `curl /` + SIGINT: temp dirs 1167 → 1168, `deps/` 781 files → absent; the same run without `NODE_ENV`: 1167 → 1167, `deps/` kept |
| Stopping a server before its re-optimize commits leaves the temp dir (780 files, no `_metadata.json`) — SIGINT and `server.close()` leak as SIGKILL does        | `runOptimizeDeps` `cancel()` rm's the dir before the rolldown build has stopped writing (suspected, unverified); every sampled `deps_temp_*` held 780 files and no `_metadata.json`               |
| vite deletes `_temp_` dirs only once older than 24 h (`MAX_TEMP_DIR_AGE_MS = 864e5`), on a process's first metadata load                                        | `cleanupDepsCacheStaleDirs` in the same `node.js` chunk                                                                                                                                           |
| `makePagesServer` (`configFile: false`) hashes a different config from `biac dev` even without `NODE_ENV`, so it re-optimizes the shared cache on every server  | `test/lib/pages-vite-server.ts`; ~1 temp dir per test below                                                                                                                                       |
| Once the vitest tiers have dropped `deps/`, cucumber's `biac dev` children (no `NODE_ENV`) also cold-optimize and are stopped before commit                     | cucumber +8 below                                                                                                                                                                                 |
| Browser specs leak nothing: a page load waits for the optimizer to commit before `server.kill()`; that run re-wrote `deps/` with the `biac dev` hash `eefcd2a2` | `test:e2e-browser crossfilter-scale.spec.ts` (3 tests): 1155 → 1155, `deps/` absent → 781 files                                                                                                   |

Per-tier temp-dir deltas, each tier run alone under `devjob` (host 8 cores, 1 min load 6.7–7.4):

| Command                                                                           | Servers                                  | `deps_temp_*` before → after |
| --------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| `pnpm -s vitest run --project integration --maxWorkers=4`                         | all `makePagesServer` + lazy-editor-deps | 1061 → 1103 (+42)            |
| `… --project integration test/integration/pages-plugin.integration.test.ts`       | 23 tests, `makePagesServer` per test     | 1103 → 1122 (+19)            |
| `… --project integration test/integration/page-source.integration.test.ts`        | 15 tests                                 | 1122 → 1137 (+15)            |
| `… --project integration test/integration/data-files.integration.test.ts`         | 8 tests                                  | 1137 → 1145 (+8)             |
| `pnpm -s vitest run --project e2e --maxWorkers=4`                                 | 2 `biac dev` (SIGINT) + preview          | 1145 → 1147 (+2)             |
| `pnpm -s test:cucumber`                                                           | `biac dev` per scenario                  | 1147 → 1155 (+8)             |
| `pnpm -s test:e2e-browser test/e2e-browser/crossfilter-scale.spec.ts`             | 3 `biac dev` (SIGKILL)                   | 1155 → 1155 (0)              |
| `… --project e2e test/e2e/dev-server.e2e.test.ts` with `deps/` warm at `eefcd2a2` | 2 `biac dev`                             | 1155 → 1157, `deps/` dropped |

`lazy-editor-deps.integration.test.ts` already owns a `mkdtempSync` `cacheDir` and removes it in `afterAll`; it is the only test server that does.

## Who else implements this

This is test isolation, not a product feature: the question is how each reference keeps the servers its tests start from sharing or corrupting a cache.

| Repo      | Has it  | Entry points                                                                                                                    | Approach in one line                                                                                                                      |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | PARTIAL | `research_repos/evidence/cli/cli/server.shared.test.ts`, `research_repos/evidence/cli/vite.config.ts`                           | Each test gets a `mkdtemp` project dir, removed in `afterEach`; no test starts a vite dev server, and `vite.config.ts` sets no `cacheDir` |
| framework | FULL    | `research_repos/framework/test/build-test.ts`                                                                                   | Each build test gets its own `mkdtemp` input, output and cache dir, all `rm`'d after; framework does not run vite                         |
| mosaic    | PARTIAL | `research_repos/mosaic/packages/vgplot/spec/playwright.config.js`                                                               | One shared vite server per run (`webServer`, `reuseExistingServer: true`, `workers: 1`), so the cache is written once and never contended |
| streamlit | PARTIAL | `research_repos/streamlit/e2e_playwright/conftest.py` (`_stop_process`), `research_repos/streamlit/frontend/app/vite.config.ts` | e2e servers stop with `terminate()` + a 20 s wait before `kill()`; no `cacheDir` in its vite config                                       |

**Count:** 1 of 4 isolates per-test caches outright (framework); mosaic avoids contention with one server; streamlit stops gracefully. External: a unique `cacheDir` per vite instance is the documented fix when several instances share one `node_modules` (`https://dev.to/scottnath/bugfix-multiple-vite-storybooks-from-same-nodemodules-4mg1`, search result); vite documents `cacheDir` default `node_modules/.vite` (`https://vite.dev/config/shared-options#cachedir`, fetched 2026-10-13).

## Implementation inventory

### framework

| Concern            | Files                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Per-test cache dir | `research_repos/framework/test/build-test.ts` (`mkdtemp(tmpPrefix + "output-")` as `cacheDir`)         |
| Teardown           | `research_repos/framework/test/build-test.ts` (`Promise.all([inputDir, cacheDir, outputDir].map(rm))`) |

### evidence

| Concern           | Files                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Per-test temp dir | `research_repos/evidence/cli/cli/server.shared.test.ts` (`beforeEach`)                                |
| Env restore       | `research_repos/evidence/cli/cli/server.shared.test.ts` (`afterEach` restores `EVIDENCE_PROJECT_CWD`) |
| vite cache        | `research_repos/evidence/cli/vite.config.ts` (no `cacheDir`; `optimizeDeps.include` only)             |

### mosaic

| Concern           | Files                                                             |
| ----------------- | ----------------------------------------------------------------- |
| One shared server | `research_repos/mosaic/packages/vgplot/spec/playwright.config.js` |

### streamlit

| Concern       | Files                                                                                |
| ------------- | ------------------------------------------------------------------------------------ |
| Graceful stop | `research_repos/streamlit/e2e_playwright/conftest.py` (`_stop_process`, `terminate`) |
| vite config   | `research_repos/streamlit/frontend/app/vite.config.ts`                               |

**Disagreement:** framework isolates every test's cache (cold each time, never contended); mosaic shares one warm server (fast, but one server per run); streamlit relies on a graceful stop — which we measured does **not** prevent the leak here (SIGINT leaked in `dev-server.e2e.test.ts`). Ours must pick between isolating and sharing per spawner.

## Trade-offs and what we adopt

| Axis                                   | Options seen (repo → approach)                                                                  | Trade-off                                                                                                                            | Our choice, and why                                                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spawned `biac dev` children (CLI tier) | mosaic → share one warm cache; framework → own cache per test                                   | Sharing is warm and fast, but only if the child's config hash equals a user's `biac dev`; isolating costs a cold optimize per server | Share: spawn children with the user's environment — `NODE_ENV` removed from the child env in `test/lib/dev-server.ts` — so they hash `eefcd2a2` like `bin/biac dev` and hit the warm cache. A browser test already proves it leaks 0 |
| In-process `makePagesServer`           | framework → own cache per test; our `lazy-editor-deps.integration.test.ts` → own cache per file | `configFile: false` can never match `biac dev`'s hash; one cache per server means one cold optimize per test                         | Own cache per server, injected through `makePagesServer`, removed after `close()`. Open decision: per test vs per file — measure the cold-optimize cost first                                                                        |
| Stop signal                            | streamlit → graceful terminate; ours → SIGKILL in browser fixture, SIGINT in e2e/cucumber       | Measured: SIGINT leaks as SIGKILL does while an optimize is in flight                                                                | Unchanged — the signal is not the cause                                                                                                                                                                                              |
| Existing 1168 dirs                     | vite → removes `_temp_` dirs older than 24 h itself                                             | Deleting is irreversible but they are orphaned build output                                                                          | Not deleted by code; vite's 24 h sweep reclaims them once no new ones appear. A manual `rm` is the human's call at demo time                                                                                                         |

## Gap analysis — what we already have vs the references

| Concern                         | Ours today (file)                                                                                                                                                                                | Best reference (file)                                                               | Gap                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Spawned CLI env                 | `test/lib/dev-server.ts` `startBiacServer` — `spawn` inherits vitest's `NODE_ENV=test`                                                                                                           | `research_repos/mosaic/packages/vgplot/spec/playwright.config.js` (one warm server) | absent — children hash a different config and drop the shared `deps/`                                                                         |
| In-process server cache         | `test/lib/pages-vite-server.ts` `makePagesServer` — default `cacheDir`, `configFile: false`                                                                                                      | `research_repos/framework/test/build-test.ts`                                       | absent — 3 files, ~1 temp dir per test                                                                                                        |
| Per-file cache already isolated | `test/integration/lazy-editor-deps.integration.test.ts` — `mkdtempSync` under `node_modules/.cache/` + `rmSync`                                                                                  | `research_repos/framework/test/build-test.ts`                                       | complete — the pattern to reuse; it lives in one test file, not in the shared helper                                                          |
| Browser fixture                 | `test/e2e-browser/dev-server.fixture.ts` — `startDevServer` then `server.kill()`                                                                                                                 | `research_repos/streamlit/e2e_playwright/conftest.py`                               | complete for leaks (0 measured); inherits the `startBiacServer` env fix                                                                       |
| cucumber steps                  | `test/integration/features/step_definitions/page-chrome.steps.ts`, `data-service.steps.ts` (via `startDevServer`); `dev-server.steps.ts` (its own `spawn` of `bin/biac dev`, SIGKILL in `After`) | —                                                                                   | partial — cucumber runs in plain node (`NODE_ENV` unset), so it leaks only because earlier tiers dropped `deps/`; fixed by the two rows above |
| Product `biac dev`              | `src/cli/commands/dev.ts`, `src/cli/commands/web-project.ts` `closeOnExitSignals`                                                                                                                | —                                                                                   | complete — warm SIGINT leaks 0; a cold SIGINT before commit can still leak one dir (vite behaviour, out of scope)                             |

## Deviations

None from the references. `NODE_ENV` is cleared for spawned children, not set to `development`: vite's hash uses `process.env.NODE_ENV || config.mode`, so an unset value equals what a user's shell produces; the reason is stated in a comment at the `spawn` site.

## Open decisions

- Per-test vs per-file cache for `makePagesServer`: measure one cold optimize under `/usr/bin/time -v` and a file's runtime both ways before picking; the 10 s `afterEach` timeout in `pages-plugin.integration.test.ts` bounds it (Known-debt gate-under-load row).
- Whether `startBiacServer` drops `NODE_ENV` only, or passes an explicit env — read `test/lib/dev-server.ts` callers first.

## Surface

| Layer  | Files                                                                                                                                                                                                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | —                                                                                                                                                                                                                                                               |
| client | —                                                                                                                                                                                                                                                               |
| ui     | —                                                                                                                                                                                                                                                               |
| tests  | `test/lib/dev-server.ts`, `test/lib/pages-vite-server.ts`, `test/integration/pages-plugin.integration.test.ts`, `test/integration/page-source.integration.test.ts`, `test/integration/data-files.integration.test.ts`, a regression test counting `deps_temp_*` |

## Tasks

- [ ] T1 — `startBiacServer` spawns `biac` without `NODE_ENV`; regression: an e2e test starts `biac dev` from vitest, stops it within 1 s of `Local:`, and asserts the `deps_temp_*` count and `deps/_metadata.json` `configHash` are unchanged (RED today: +1 and dropped). Re-measure `test:e2e` and `test:cucumber` deltas.
- [ ] T2 — `makePagesServer` takes a `cacheDir` and its callers remove it after `close()` (per test or per file, from the open decision); regression: the integration tier leaves the count and `deps/` unchanged. Re-measure the integration delta, then run the Demo; `playwright-cli` pass over `/weekly-review` and `/?edit=true`.

## Out of scope

- A cold `biac dev` stopped before its first optimize commits can still leave one temp dir: vite's `cancel()` path, upstream behaviour, owned by vite.
- Deleting the existing orphaned dirs: vite's 24 h sweep, or a human `rm` at demo time.
- The gate-under-load timeouts: their own Known-debt row.
