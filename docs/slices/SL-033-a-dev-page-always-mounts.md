# SL-033 — A page served by `biac dev` always mounts

Milestone: Phase 1 — Known debt · State: open · Depends on: — · Closes: the Known-debt DEF-002 row (a `biac dev` page that stays blank)

> A PRD exists so the executing agent **never guesses and never assumes**. Every path below was checked on disk on 2026-10-14; every number carries the command or script that produced it.

## Outcome

A page opened from `biac dev` on a loaded host always mounts the app: the browser never waits forever on a module request that `biac dev` has stopped answering, and when a load does fail, the failure says which request hung and on which side.

## Demo

A numbered script a human runs from a cold start. The slice is not `shipped` until this has been run in the real app.

1. `pnpm build:cli && bin/biac dev --port 5533`, open `http://localhost:5533/weekly-review` in Chrome with DevTools → Network open and DevTools → Performance → CPU throttling at 6×.
2. Stop and restart `bin/biac dev`, then reload. Repeat 20 times: every load mounts (sidebar and six charts); no Network row stays `(pending)`.
3. Run the browser tier at a 50% CPU quota: `nice -n 10 timeout 120m systemd-run --user --scope -p CPUQuota=50% pnpm exec playwright test` — no test fails with an empty `#root`.
4. Force one blank-page failure the way T1's regression does: the failure output names the unanswered request URLs, what a node-side re-request of each returned, and the dev server's log.
5. `bin/biac build && bin/biac preview`, load `/weekly-review` — unaffected.

## Evidence — what was measured on 2026-10-14

Host: 8 cores, 1 min load 1.2–6.1, `MemAvailable` 11.7–13.8 GB, memory PSI avg60 0.00–0.24 (stall counter flat); another repo's session shared the host. vite 8.2.2, Chromium from `@playwright/test`, `workers: 2`.

| Fact                                                                      | Number                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | How                                                                                                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| The debt row's own tests, alone at the quota                              | 0 of 16 blank (`charts.spec.ts:248`, `charts.spec.ts:276`, `dev-server.spec.ts:102`, `crossfilter-scale.spec.ts:133`, ×4; 13.4 min)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `nice -n 10 timeout 50m systemd-run --user --scope -p CPUQuota=50% pnpm exec playwright test <the four> --repeat-each=4 --trace=retain-on-failure` |
| The debt row's `page-chrome.spec.ts:119` is now `page-chrome.spec.ts:117` | the theme-toggle test moved 2 lines in `7eed95b`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `grep -n "^test(" test/e2e-browser/page-chrome.spec.ts`                                                                                            |
| The full browser tier at the quota                                        | **reproduced**: 2 of 106 finished tests blank — `charts.spec.ts:25` and `chart-selections.spec.ts:150`, 0 of 6 `[data-echarts-ready]` for the 70 s `expect`, screenshot all white; both were the 3rd and 4th tests started (~1.8 min into the run). The other failures: `dev-server.spec.ts:61` and `page-chrome.spec.ts:145` (DEF-003's hot reload) and 2 cut by the 80 min `timeout`                                                                                                                                                                                                                        | `nice -n 10 timeout 80m systemd-run --user --scope -p CPUQuota=50% pnpm exec playwright test --trace=retain-on-failure --reporter=list`            |
| Blank page 1 (`charts.spec.ts:25`): what the browser got                  | HTML, `main.tsx`, `@vite/client`, react/react-dom-client/router/effect/duckdb dep chunks and `duckdb-live.ts`, `runtime.tsx`, `router.tsx`, `styles.css` all `200`; **9 requests never answered**: `src/features/data/run-query.ts`, `to-rows.ts`, `types.ts`, `@id/__x00__virtual:biac-pages`, `@id/__x00__virtual:biac-config`, `src/features/editor/page-source-client.ts`, `src/features/pages/page-router.tsx`, `node_modules/.vite/deps/react-dom.js?v=d837cfb1` — while `effect.js` (issued with them) and a later `/@fs/…/vite/…` request **were** answered, and the HMR websocket stayed open 59.9 s | the trace's `0-trace.network` (`resource-snapshot` entries; `status -1` = no response)                                                             |
| Blank page 2 (`chart-selections.spec.ts:150`)                             | only 2 unanswered: `node_modules/.vite/deps/react_jsx-dev-runtime.js?v=d837cfb1` and `rolldown-runtime-DC62tzP2.js?v=d837cfb1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | same                                                                                                                                               |
| The dep cache never changed                                               | 1,151 samples every 5 s over both runs: `deps/_metadata.json` `hash 0a8bb989`, no `deps_temp_*`, no re-optimize; every unanswered dep (`react-dom`, `react/jsx-dev-runtime`, the `rolldown-runtime` chunk) is in its `optimized`/`chunks`, `?v=` equal to its `browserHash`                                                                                                                                                                                                                                                                                                                                   | a shell loop over `ls src/web/node_modules/.vite` + `grep hash _metadata.json`; `python3` over `_metadata.json`                                    |
| A fresh server per load alone does not reproduce                          | 0 of 80 blank: 2 parallel lanes × 40 rounds, each a fresh project copy + `bin/biac dev --port 0` + a new page on `/weekly-review`, SIGKILL after; loads 30.8–35.2 s (median 32.9 s)                                                                                                                                                                                                                                                                                                                                                                                                                           | a scratch `@playwright/test` `chromium` script under `systemd-run --user --scope -p CPUQuota=50%`, not committed                                   |
| The one other blank recorded                                              | `crossfilter-scale.spec.ts:159` "0 canvases after Back" mid-run (SL-032's quota run)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | commit `9fd2cc4`'s body; no network trace survived                                                                                                 |

### What the evidence rules out, and what it leaves open

| Hypothesis                                                                                          | Verdict                          | Why                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two servers swap the shared `src/web/node_modules/.vite/deps` under each other                      | **ruled out for these failures** | the cache never changed during either run; vite 8.2.2 only renames `deps/` on a re-optimize commit (`node_modules/.pnpm/vite@8.2.2*/node_modules/vite/dist/node/chunks/node.js`, `commit:` ~32240–32270)                              |
| A SIGKILLed server leaves a half-written cache                                                      | **ruled out**                    | no `deps_temp_*` ever appeared                                                                                                                                                                                                        |
| A dep request waits on the optimizer                                                                | **ruled out by source**          | the dep `load` awaits only `info.processing` (~5384–5412), which a consistent cached metadata never sets (`init`, ~34420–34440: `cachedMetadata` → no scan, no processing promise)                                                    |
| A `biac:pages` hook blocks                                                                          | **unlikely**                     | `virtual:biac-config`'s `load` awaits only the memoized `getConfig()` (`src/engine/pages-plugin.ts`, `configPromise ??=`), already resolved by `transformIndexHtml` for the answered HTML; plain `.ts` modules and dep files hung too |
| The server stops answering some in-flight transforms                                                | **open**                         | consistent with page 1: concurrent requests answered while the others hung                                                                                                                                                            |
| The requests never left Chrome (6 HTTP/1.1 connections per host, stuck or reset keep-alive sockets) | **open**                         | a `status -1` row is "no response by trace end", which a request queued behind stuck sockets shows too; page 2's two static dep files have nothing to wait on server-side                                                             |

So the root cause is **not yet known**. One trace cannot tell a request the server never answered from one Chrome never sent, and the fixture discards the dev server's output (`test/lib/dev-server.ts` keeps it only until the URL matches). T1 makes the next occurrence say which; T2 is decided from that.

## Who else implements this

The capability is "a dev server whose served app mounts reliably, and a test harness that names a load that did not". Each reference has a dev server and a browser test harness, so each gets a row.

| Repo      | Has it  | Entry points                                                                                  | Approach in one line                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | ------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | PARTIAL | `research_repos/evidence/cli/cli/server.dev.ts`, `research_repos/evidence/cli/vite.config.ts` | `evidence dev` spawns `vite dev` with the cli package as cwd, so every project shares the cli's vite dep cache, as ours shares `src/web/node_modules/.vite`; `optimizeDeps.include` lists deps the crawl misses, because a mid-session re-optimize "breaks client-side hydration"; no browser e2e harness in the checkout (`find research_repos/evidence -name '*.spec.ts' -path '*e2e*'` → 0) |
| framework | PARTIAL | `research_repos/framework/src/preview.ts`, `research_repos/framework/src/npm.ts`              | its own `node:http` preview server, no vite transform pipeline; npm deps are resolved into a **per-project** cache `<root>/.observablehq/cache/_npm`; tests are mocha over builds, no browser harness                                                                                                                                                                                          |
| mosaic    | PARTIAL | `research_repos/mosaic/packages/vgplot/spec/playwright.config.js`                             | the visual tests run **one** shared `vite` `webServer` (`reuseExistingServer`) with `workers: 1` — never two dev servers, never a server per test                                                                                                                                                                                                                                              |
| streamlit | FULL    | `research_repos/streamlit/e2e_playwright/conftest.py`                                         | one app server per test module (`app_server`, `scope="module"`), stopped with `terminate()` then `kill()` and its **stdout printed** after the module; every test waits on an explicit mount marker (`wait_for_app_loaded`: `stAppViewContainer` attached, 30 s) before asserting anything                                                                                                     |

**Count:** 1 of 4 has the whole capability (streamlit's mount gate + captured server output); 3 of 4 avoid our shape (a fresh vite server per test, two at once, output discarded) entirely. Naming a load that never mounted is the consensus where a harness exists; no reference fixes a vite request hang, because none has reported one.

## Implementation inventory

### evidence

| Concern                              | Files                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Dev server launch, cache location    | `research_repos/evidence/cli/cli/server.dev.ts` (`spawn('pnpm', ['run','dev',…], { cwd: cliRoot })`)                       |
| Pre-bundling the deps a crawl misses | `research_repos/evidence/cli/vite.config.ts` (`optimizeDeps.include`/`exclude` and the comment on the re-optimize cascade) |

### framework

| Concern               | Files                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Dev/preview server    | `research_repos/framework/src/preview.ts` (`createServer` from `node:http`, `_server`)          |
| Per-project dep cache | `research_repos/framework/src/npm.ts` (`.observablehq/cache/_npm`, `initializeNpmVersionCache`) |
| Build cache           | `research_repos/framework/src/build.ts` (`cacheDir`, `_build.json`)                             |

### mosaic

| Concern                       | Files                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Browser test server lifecycle | `research_repos/mosaic/packages/vgplot/spec/playwright.config.js` (`webServer`, `reuseExistingServer`, `workers: 1`) |

### streamlit

| Concern                            | Files                                                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Server per module, graceful stop   | `research_repos/streamlit/e2e_playwright/conftest.py` (`AsyncSubprocess`, `_stop_process` → `terminate()` then `kill()`, `app_server` fixture) |
| Server output kept for the failure | same file (`AsyncSubprocess` writes stdout to a file, `app_server` prints it after the module)                                                 |
| Explicit "app mounted" gate        | same file (`wait_for_app_loaded`, `wait_for_app_run`)                                                                                          |
| Server readiness                   | same file (`wait_for_app_server_to_start`, `start_app_server`)                                                                                 |

**Where they disagree:** a server per test (streamlit per module, ours per test) vs one shared server (mosaic); and a shared dep cache (evidence, ours) vs a per-project one (framework). Neither choice is on the failure path the evidence shows, so neither is decided here — T1's verdict decides whether T2 touches the server lifecycle at all.

## Trade-offs and what we adopt

| Axis                      | Options seen (repo → approach)                                                                         | Trade-off                                                                            | Our choice, and why                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server output             | streamlit → captured, printed per module; ours → kept until the URL matches, then dropped              | captured output costs memory per test; dropped output made this defect undiagnosable | capture it and attach it to a failed test (T1)                                                                                                                           |
| Mount detection           | streamlit → explicit mount marker before any assertion; ours → each test waits on its widgets for 70 s | a mount gate fails fast and names the cause; per-widget waits report "0 of 6 charts" | a fixture-level "the app mounted" check that, on failure, records the unanswered requests (T1)                                                                           |
| Diagnosing a hung request | none of the references                                                                                 | —                                                                                    | re-request each unanswered URL from node against the same live server: answered → the request never reached or never left Chrome; hangs → the server is stuck on it (T1) |
| Retrying a blank load     | none of the references retry                                                                           | a retry would hide a product hang a user would also hit                              | no retry, no longer budget — a band-aid (`prompt-execution.md` §4)                                                                                                       |

## Gap analysis — what we already have vs the references

| Concern                   | Ours today (file)                                                                                                        | Best reference (file)                                                     | Gap                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Server output on failure  | `test/lib/dev-server.ts` (`startBiacServer`: `output` accumulated only for the URL match and the exit error)             | `research_repos/streamlit/e2e_playwright/conftest.py` (`AsyncSubprocess`) | **absent** — a passing server's log is never seen                                                     |
| Server stop               | `test/e2e-browser/dev-server.fixture.ts` (`server.kill()` → SIGKILL)                                                     | same streamlit file (`terminate()` then `kill()`)                         | **partial** — not on the failure path (the cache never changed), kept as is unless T1 shows otherwise |
| Mount gate                | none — `test/e2e-browser/charts.spec.ts` and the rest wait on widgets (`readyCharts`)                                    | streamlit `wait_for_app_loaded`                                           | **absent**                                                                                            |
| Unanswered-request report | none — only a trace, and only with `--trace=retain-on-failure` (config: `trace: "on-first-retry"`, `retries: 0` locally) | none                                                                      | **absent** (invention, justified: the defect is undiagnosable without it)                             |
| The served app            | `src/web/index.html` → `src/web/src/main.tsx` (mounts once every static import resolves)                                 | —                                                                         | complete; it cannot mount when a module never arrives                                                 |
| Dev server config         | `src/cli/commands/dev.ts` (`configFile: src/web/vite.config.ts`), `src/web/vite.config.ts` (`optimizeDeps.include`)      | `research_repos/evidence/cli/vite.config.ts`                              | complete for this defect — no re-optimize happened                                                    |

Nothing in the ledger claims this is shipped.

## Deviations

- The unanswered-request report has no reference: it is justified by this defect alone, and it lives in the test fixture, never in `src/`.

## Open decisions

- **Server-side or browser-side?** T1 settles it with evidence; T2 is written from T1's verdict. If server-side, T2 needs the stuck `await` named (candidates: vite's transform pipeline, `@vitejs/plugin-react`, `@tailwindcss/vite`, `biac:pages`) — `DEBUG=vite:*` timings in the captured log will name the last hook entered for each hung URL. If browser-side, T2 needs the socket state (Chrome's per-host connection limit, node's `keepAliveTimeout`) measured, not assumed.
- **Is a user exposed?** If T1 shows a server-side stall, a user on a loaded laptop hits it too and T2 is a product fix in `src/`; if it is Chrome's connection pool under the harness's load only, T2 says so plainly and the demo's steps 1–2 are its user-facing proof.

## Surface

| Layer  | Files                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | `src/engine/pages-plugin.ts` — only if T1 names one of its hooks                                                                                                             |
| client | `src/cli/commands/dev.ts` — only if T1 names the server config                                                                                                               |
| ui     | none expected                                                                                                                                                                |
| tests  | `test/lib/dev-server.ts` (keep the output), `test/e2e-browser/dev-server.fixture.ts` (mount check + unanswered-request report), a unit test for the report under `test/lib/` |

## Tasks

One TDD unit each, one conventional commit each. A task that changes a screen names what to navigate and measure — the executing session closes it with a `playwright-cli` pass (`prompt-execution.md` §5).

- [ ] T1 — Make a blank page say why. (a) `startBiacServer` keeps the server's output for the server's whole life (timestamped lines) and exposes it; (b) the `biacDev` fixture records each page's requests that never finish, and after a failed test whose `#root` has no children, attaches: the unanswered URLs with their start times, a node-side re-request of each against the still-running server (status and latency, or the timeout), and the server log; (c) unit tests for the report's pure parts (formatting, the answered/hung classification) with a named fake server, and a browser test that forces a hang on one module (a stalling middleware on a temp project) and asserts the attachment names it. Then run the full browser tier at a 50% quota (measure the host first; `nice -n 10 timeout 120m systemd-run --user --scope -p CPUQuota=50% pnpm exec playwright test`) until one blank page is captured, at most 3 runs, and write the verdict and T2 into this PRD.
- [ ] T2 — Fix the cause T1 names, RED regression first; the demo above run on the fix.

## Out of scope

- DEF-003 (`biac.config.ts` hot reload past its 3 s bound) — its own Known-debt row and slice.
- Sharing one dev server across tests or a per-project dep cache — a harness redesign, decided only if T1 puts it on the failure path.
