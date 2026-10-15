# SL-034 — A file edit under `biac dev` is tested by waiting for the one reload it causes

Milestone: Phase 1 — Known debt · State: open · Depends on: — · Closes: the Known-debt DEF-003 row (a `biac.config.ts` hot reload and a page added while running fail under a 50% CPU quota)

> A PRD exists so the executing agent **never guesses and never assumes**. Every path below was checked on disk on 2026-10-15; every number carries the command that produced it.

## Outcome

The browser tests that prove `biac dev` picks up an edit — `biac.config.ts` retitles the site, a page edit lands, a page added while running is served — pass under a 50% CPU quota, because each edit triggers exactly the reload it is waiting for and the test waits that reload out once, instead of rewriting the file every 3 s and restarting the reload it waits on.

## Demo

A numbered script a human runs from a cold start. The slice is not `shipped` until this has been run in the real app.

1. `pnpm build:cli && bin/biac dev --port 5534`, open `http://localhost:5534/` in Chrome with DevTools → Performance → CPU throttling at 6×.
2. Edit `biac.config.ts` `title` and save once: the page reloads once and the sidebar shows the new title.
3. Add `pages/fresh-page.md` (`# Fresh page`): the open page reloads once, the sidebar lists it, `/fresh-page` renders it. Delete the file and restore `biac.config.ts`.
4. `nice -n 10 timeout 40m systemd-run --user --scope -p CPUQuota=50% pnpm exec playwright test test/e2e-browser/page-chrome.spec.ts:146 test/e2e-browser/dev-server.spec.ts:61 --repeat-each=5 --workers=2` — 10 of 10 pass.
5. `pnpm gate` passes; `bin/biac build && bin/biac preview` → `/` unaffected.

## Evidence — what was measured on 2026-10-15

Host: 8 cores, 1 min load 7.1–17.4 during the runs (another workload shared the host), `MemAvailable` 4.6–6.7 GB, memory PSI avg60 0.09–0.11, temp dir tmpfs, 0 `veth` lines in `journalctl -k --since -10min`. vite 8.2.2, Chromium from `@playwright/test`.

| Fact                                                                      | Number                                                                                                                                                                                                                                                                                            | How                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The debt row's `page-chrome.spec.ts:147` is now `page-chrome.spec.ts:145` | the test starts at 145, its `toPass` closes at 163                                                                                                                                                                                                                                                | `grep -n "^test(" test/e2e-browser/page-chrome.spec.ts`                                                                                                                                                                                                |
| Both tests at a 50% quota                                                 | **0 of 10 passed**: 5 of 5 `page-chrome.spec.ts:145` time out the 20 s `toPass` at line 163; `dev-server.spec.ts:61` fails 4 of 5 at line 97 (`/new-page`; 3 with `page.goto: net::ERR_ABORTED`) and 1 of 5 at line 84 (the page edit); 1.1–2.5 min per test                                      | `nice -n 10 timeout 40m systemd-run --user --scope -q -p CPUQuota=50% pnpm exec playwright test test/e2e-browser/page-chrome.spec.ts:145 test/e2e-browser/dev-server.spec.ts:61 --repeat-each=5 --workers=2 --trace=retain-on-failure --reporter=list` |
| Both tests with no quota (load 11.4–17.4)                                 | 6 of 6 passed, 11.4–12.6 s each                                                                                                                                                                                                                                                                   | the same command without `systemd-run`, `--repeat-each=3`                                                                                                                                                                                              |
| The config test ends mid-reload every time                                | 5 of 5 left `blank-page.txt`: `#root` empty with 0, 16, 28, 42 and 50 requests in flight; the in-flight module requests answered in 0.8–3.2 s when re-requested from node, so one cold reload outlasts the 3 s per-attempt bound                                                                  | `test-results/page-chrome-*/blank-page.txt` (written by `test/e2e-browser/dev-server.fixture.ts` `attachBlankPageReport`), first line and `→ 200 in N ms`                                                                                              |
| Each rewrite restarts the reload                                          | 2–4 `page reload` lines per test in the 20 s window, 3.3–14.2 s apart; vite answers each `biac.config.ts` write with a full reload because nothing accepts `virtual:biac-config`                                                                                                                  | `grep -a "page reload" test-results/page-chrome-*/blank-page.txt`; `src/engine/pages-plugin.ts` `hotUpdate`; `grep -rn "import.meta.hot" src/web/src src/engine` → only `src/engine/manifest-module.ts` accepts                                        |
| `ERR_ABORTED` on `/new-page` is vite's full reload taking the frame       | in `dev-server.spec.ts:61` repeat 3 the test called `goto /new-page` at about 13:43:35.65 and the frame loaded `/` (200) at 13:43:35.849 — the reload vite sends because the added page changes the manifest (`hotUpdate` → `manifestChanged`) — then the second `goto` ran out the 20 s `toPass` | that test's `trace.zip`: `test.trace` `goto` start times against `0-trace.network` document requests (`startedDateTime`)                                                                                                                               |

So the product does what it should: a config edit and a manifest change are full reloads by design (see `src/engine/pages-plugin.ts`, its doc comment), and a single edit lands with no quota. The defect is in the tests: under load one reload takes longer than an attempt, so a retry that rewrites the file (or navigates) cancels the reload it waits on, every time.

## Who else implements this

The capability is "a test proving a dev server picks up a file edit, and does so reliably under load". Each reference has a dev server, so each gets a row.

| Repo      | Has it  | Entry points                                                                                                                                                                                                                 | Approach in one line                                                                                                                                                                                                       |
| --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | ABSENT  | `research_repos/evidence/cli/src/routes/+layout.server.ts`, `research_repos/evidence/cli/vite.config.ts`                                                                                                                     | no config watch: `loadProjectConfig(cwd)` runs on every layout load, so the next navigation sees the edit; no browser e2e harness                                                                                          |
| framework | PARTIAL | `research_repos/framework/src/preview.ts`, `research_repos/framework/src/client/preview.js`, `research_repos/framework/test/preview/preview-test.ts`                                                                         | `handleWatch` sets up the page, loader and config watchers per socket, **then** sends `welcome`; a config change sends `reload` (`location.reload()` in the client); `preview-test.ts` has no watch or reload test         |
| mosaic    | ABSENT  | `research_repos/mosaic/packages/vgplot/spec/playwright.config.js`                                                                                                                                                            | visual tests over a shared `vite` server, no file-edit test                                                                                                                                                                |
| streamlit | PARTIAL | `research_repos/streamlit/lib/streamlit/watcher/event_based_path_watcher.py`, `research_repos/streamlit/lib/tests/streamlit/watcher/event_based_path_watcher_test.py`, `research_repos/streamlit/e2e_playwright/conftest.py` | the watcher is unit-tested with a mocked watchdog `Observer`; e2e tests never edit a running app's file; every e2e waits on an explicit "run finished" marker (`wait_for_app_run`, `wait_for_app_loaded`) before asserting |

**Count:** 0 of 4 test a live file edit in a browser. Two signals to adopt: framework tells the client the watch is live before relying on it (`welcome`), and streamlit waits on one explicit "the app finished" marker, never on a poll that re-triggers the work. We keep our end-to-end proof (the user-visible behaviour is the demo) and make it wait once.

## Implementation inventory

### evidence

| Concern                           | Files                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Config read per request, no watch | `research_repos/evidence/cli/src/routes/+layout.server.ts` (`load` → `loadProjectConfig(cwd)`) |
| Dev watch options                 | `research_repos/evidence/cli/vite.config.ts` (`server.watch.ignored`)                          |

### framework

| Concern                                             | Files                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Watch is live → `welcome`; config change → `reload` | `research_repos/framework/src/preview.ts` (`handleWatch`, `hello`, `configWatcher`)  |
| Client side of `welcome`/`reload`                   | `research_repos/framework/src/client/preview.js` (`case "welcome"`, `case "reload"`) |
| What its tests cover                                | `research_repos/framework/test/preview/preview-test.ts` (HTTP responses only)        |

### streamlit

| Concern                           | Files                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| File watcher                      | `research_repos/streamlit/lib/streamlit/watcher/event_based_path_watcher.py`                                           |
| Watcher test with a fake observer | `research_repos/streamlit/lib/tests/streamlit/watcher/event_based_path_watcher_test.py` (`mock.patch(... "Observer")`) |
| One explicit "done" wait          | `research_repos/streamlit/e2e_playwright/conftest.py` (`wait_for_app_run`, `wait_for_app_loaded`, `wait_until`)        |

**Where they disagree:** streamlit proves the watcher below the browser (unit test, fake observer) and never edits a running app's file; framework signals watch readiness to the client but tests neither. Neither answers "how does a browser test know the server saw the write". Our answer is the server's own log line (`page reload <file>` / `hmr update <file>`, vite `dist/node/chunks/node.js` ~27114, ~27170, ~27188), which `test/lib/dev-server.ts` already records.

## Trade-offs and what we adopt

| Axis                                            | Options seen (repo → approach)                                                                                    | Trade-off                                                                                                                                                                               | Our choice, and why                                                                                                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Knowing the server saw the write                | ours → rewrite every attempt; framework → a `welcome` once the watch is live; streamlit → not tested in a browser | rewriting restarts the reload (measured); a single write can be lost if chokidar has not finished adding the path; a readiness message would be product code that exists only for tests | **rewrite only until the server logs the file** (`page reload` / `hmr update` naming it, read from `DevServer.log()`), then never again — the write cannot be lost and the reload is never restarted |
| Waiting for the UI                              | ours → 3 s per attempt inside a 20 s `toPass`; streamlit → one explicit wait on a done marker                     | a per-attempt bound must exceed one reload under load; a single wait only needs the total                                                                                               | **one `expect(...).toBeVisible` after the acknowledgment**, budget sized from T1's measured reload at the 50% quota, the way SL-031 sized the rest of the tier                                       |
| Navigating to an added page                     | ours → `goto` per attempt, racing the manifest reload; framework/evidence → n/a                                   | a `goto` during vite's `full-reload` is aborted (measured)                                                                                                                              | **wait for the reload the added page causes to land** (the server's log line, then the reloaded page shows the new page in the sidebar), then `goto` once                                            |
| A longer `toPass` or a larger per-attempt bound | —                                                                                                                 | each attempt still rewrites and restarts the reload; it hides the race (`prompt-execution.md` §4, no band-aids)                                                                         | rejected                                                                                                                                                                                             |
| Hot-updating the config in place (no reload)    | framework → full reload; evidence → read per load                                                                 | an HMR boundary for `virtual:biac-config` would also have to re-run the inline theme script in `index.html`                                                                             | rejected: the product's reload matches framework, and the defect is in the test                                                                                                                      |

## Gap analysis — what we already have vs the references

| Concern                          | Ours today (file)                                                                                                                               | Best reference (file)                                                  | Gap                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Config reload                    | `src/engine/pages-plugin.ts` (`hotUpdate`: invalidate `virtual:biac-config` + page modules → full reload)                                       | `research_repos/framework/src/preview.ts` (`configWatcher` → `reload`) | **complete** — no change                                                                                                       |
| Manifest reload on an added page | `src/engine/pages-plugin.ts` (`manifestChanged` → invalidate the manifest)                                                                      | —                                                                      | **complete** — no change                                                                                                       |
| Server log available to a test   | `test/lib/dev-server.ts` (`DevServer.log()`); `test/e2e-browser/dev-server.fixture.ts` passes it only into `blankPageReport`                    | streamlit `conftest.py` (server output kept per module)                | **partial** — `BiacDev` does not expose the log to a test body                                                                 |
| "Write until seen" helper        | none — each test inlines `writeFileSync` inside `toPass` (`test/e2e-browser/page-chrome.spec.ts:145`, `test/e2e-browser/dev-server.spec.ts:61`) | none                                                                   | **absent** (invention, justified by the measured race)                                                                         |
| Config-edit test                 | `test/e2e-browser/page-chrome.spec.ts:145` (rewrite per 3 s attempt)                                                                            | streamlit `wait_for_app_run` (one wait)                                | **present and broken under load** — 0 of 5 at 50%                                                                              |
| Page-edit and added-page test    | `test/e2e-browser/dev-server.spec.ts:61` (rewrite per attempt at line 84; `goto` per attempt at line 97)                                        | same                                                                   | **present and broken under load** — 0 of 5 at 50%                                                                              |
| The other `toPass` rewrite       | `test/e2e-browser/dev-server.spec.ts:102` (content edit swapped in place, `toPass` at line 137)                                                 | —                                                                      | same shape, not in DEF-003; an `hmr update` swap, no reload to restart — T2 moves it to the helper so the pattern has one home |

Nothing in the ledger claims this is shipped.

## Deviations

- The acknowledgment reads vite's log text (`page reload`, `hmr update`). That text is vite's, not ours: the helper names the vite version it was read from in a comment, and a vite upgrade that changes it fails the helper's own test, not silently.

## Open decisions

- None. The single UI wait's budget was settled in T1: acknowledgment → title measured 6.1–15.6 s at the 50% quota (each write acknowledged on the first attempt, 246–551 ms), under half the 70 s `expect.timeout` that `7eed95b` sized, so the wait takes the tier default and no per-call override.

## Surface

| Layer  | Files                                                                                                                                                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | none                                                                                                                                                                                                                                    |
| client | none                                                                                                                                                                                                                                    |
| ui     | none                                                                                                                                                                                                                                    |
| tests  | `test/lib/dev-server.ts` (or a sibling module: the write-until-seen helper), `test/e2e-browser/dev-server.fixture.ts` (`BiacDev` exposes the server log), `test/e2e-browser/page-chrome.spec.ts`, `test/e2e-browser/dev-server.spec.ts` |

## Tasks

One TDD unit each, one conventional commit each. Each closes with the 50% quota run of its tests ×5 and `pnpm gate`.

- [x] T1 — The config edit waits for one reload: `rewriteUntilServerLogs` in `test/lib/write-until-logged.ts` rewrites a file until the dev server logs a `page reload`/`hmr update` naming it (fake-log cases in `test/integration/write-until-logged.integration.test.ts`; a real `biac dev` case in `test/e2e/dev-server.e2e.test.ts`, where the suite already spawns it serially), `BiacDev` exposes `log()`, `page-chrome.spec.ts:146` writes until acknowledged then waits once under the tier `expect.timeout` — RED: 1 of 5 at the quota; GREEN: 5 of 5.
- [ ] T2 — The page edit and the added page wait for one reload: `dev-server.spec.ts:61` uses the helper for the edit (line 84) and the added page (line 97), waits for the reloaded page to list `Fresh page` in the sidebar before one `goto`, and `dev-server.spec.ts:102` moves to the helper — RED: 0 of 5 at the quota; GREEN: 5 of 5; then mark DEF-003 closed.

## Out of scope

- Making `biac.config.ts` hot-update without a reload — a product change no reference makes (framework reloads too).
- A watch-ready message from `biac dev` to the browser (framework's `welcome`) — product code that only tests would read.
