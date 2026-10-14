# SL-031 — `pnpm gate` passes on a loaded host, or says it is waiting for one

Milestone: Phase 1 — Known debt · State: open · Depends on: SL-029 · Closes: Known-debt gate-under-load row

## Outcome

A developer who runs `pnpm gate` while other work loads the host gets either a pass or a printed "waiting: 1 min load X on N cores" — never a red browser test whose only cause is a 10 s or 30 s wait sized for an idle machine.

## Demo

1. Take the AGENTS.md host readings (`nproc`, `/proc/loadavg`, `MemAvailable`, PSI).
2. `pnpm gate` on that host → passes; note each step's `gate: <step> passed (Ns)` line.
3. Contained load: `systemd-run --user --scope -p CPUQuota=50% env BIAC_CAPPED=1 pnpm -s exec playwright test test/e2e-browser/filter-inputs.spec.ts` → 10 of 10 pass (today 9 of 10, see Root cause).
4. `systemd-run --user --scope -p CPUQuota=200% env BIAC_CAPPED=1 pnpm -s exec vitest run` → passes.
5. With the 1 min load above `nproc` (any neighbour job), `pnpm gate` prints its load reading and waits instead of starting the browser tier (the T1 behaviour; the exact rule is the T1 decision).
6. `bin/biac dev` → `/weekly-review`: pick `West` in Region, type `west` in Search regions — the page is unchanged by this slice.

## Root cause — measured 2026-10-13 on this host (8 cores, idle 1 min load 4.1–9.3, `MemAvailable` ~14 GB, memory PSI 0)

The two recorded failures (2026-10-10, recorded in `7bbdeff`): `filter-inputs.spec.ts` `pickRegion` (Region combobox not rendered in 30 s) and the `pages-plugin.integration.test.ts` `afterEach` hook (10 s), each once inside a full gate at 1 min load ~12 on 8 cores.

Load is simulated with a CPU quota on a transient scope, which slows only the job under test and leaves the neighbours alone: `systemd-run --user --scope --quiet -p CPUQuota=<Q> -p MemoryMax=<M> env BIAC_CAPPED=1 nice -n 10 timeout <T> <command>` (`BIAC_CAPPED=1` keeps `scripts/run-capped.sh` from opening a nested scope).

| Run                                                                                                      | Quota | Result                  | Timing                                                                    |
| -------------------------------------------------------------------------------------------------------- | ----- | ----------------------- | ------------------------------------------------------------------------- |
| `devjob pnpm -s exec vitest run --project integration test/integration/pages-plugin.integration.test.ts` | none  | 23 of 23                | 2.38 s; slowest test 215 ms                                               |
| same file                                                                                                | 25%   | 23 of 23                | 11.81 s                                                                   |
| same file                                                                                                | 10%   | 23 of 23                | 31.90 s                                                                   |
| `pnpm -s exec playwright test test/e2e-browser/filter-inputs.spec.ts --reporter=list` (2 workers)        | 100%  | 10 of 10                | 3.4 min; tests 15.1–25.7 s                                                |
| same file                                                                                                | 50%   | **9 of 10**             | 6.6 min; tests 28.5–58.1 s; test 7 took 58.1 s against the 60 s `timeout` |
| `pnpm -s exec vitest run` (every project, one pool, `maxWorkers: "50%"`)                                 | 200%  | 142 files, 1747 of 1747 | 379.5 s (start 1 min load 9.29)                                           |

What fails at 50% is not `pickRegion` but the first assertion that has no explicit timeout: `filter-inputs.spec.ts:386` `await expect(table).toContainText("· 140 rows")`, which ran into the 10 s `expect.timeout` in `playwright.config.ts` while the `q` re-query was still running. `test.slow()` at the top of that test triples the test budget (60 s → 180 s) but leaves every `expect` at 10 s.

| Fact                                                                                                                                                                                                                                                        | Evidence                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Browser budgets are fixed numbers sized on an idle host: `timeout: 60_000`, `expect: { timeout: 10_000 }`, `workers: 2`                                                                                                                                     | `playwright.config.ts`                                                                             |
| The specs override them by hand 113 times: 73 × `timeout: 30_000`, 34 × `20_000`, 4 × `3_000`, 1 × `10_000`, 1 × `60_000`; 24 `test.slow()` calls across 5 spec files                                                                                       | `grep -rhoE "timeout: [0-9_]+" test/e2e-browser/*.ts \| sort \| uniq -c`; `grep -rc "test.slow()"` |
| A 50% quota roughly doubles every browser test against 100% (15–26 s → 28–58 s), so a hand-sized wait with less than 2× headroom fails first                                                                                                                | the two playwright rows above                                                                      |
| vitest sets neither `testTimeout` nor `hookTimeout`, so hooks get vitest's 10 s default; `pages-plugin.integration.test.ts` raises only `testTimeout` (`vi.setConfig({ testTimeout: 2 * WATCH_WAIT_MS })`)                                                  | `vitest.config.ts`; `test/integration/pages-plugin.integration.test.ts`                            |
| Its `afterEach` is `server?.close()` + `cleanupProjects()` (`rmSync` of the temp project). Since `58eaebc` `makePagesServer` runs with `optimizeDeps: { noDiscovery: true }`, so no close waits on an in-flight dep optimize — which it could on 2026-10-10 | `test/lib/pages-vite-server.ts`, `test/lib/temp-project.ts`                                        |
| Nothing in the gate looks at the host before starting: `scripts/gate.sh` runs every step back to back; `scripts/run-capped.sh` caps CPU weight, memory and runtime but never waits for load                                                                 | `scripts/gate.sh`, `scripts/run-capped.sh`                                                         |
| The host's own job runner already has an admission rule: with another job running and the 1 min load at or above `DEVJOB_MAX_LOAD` (default `nproc`) a job waits; `pnpm gate` does not go through it                                                        | `~/.local/bin/devjob` header (host tool, not part of this repo)                                    |

## Who else implements this

This is test robustness, not a product feature: the question is how each reference keeps its own suite green on a slow or busy machine.

| Repo      | Has it  | Entry points                                                                                                                                                             | Approach in one line                                                                                                                                        |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | ABSENT  | `research_repos/evidence/vitest.config.ts`, `research_repos/evidence/cli/vitest.config.ts`                                                                               | No timeout, retry or load setting at all (`pool: 'forks'` only); no playwright config in the checkout                                                       |
| framework | PARTIAL | `research_repos/framework/package.json` (`test:mocha:serial`)                                                                                                            | One generous global ceiling: `mocha --timeout 30000` for every test (mocha's default is 2 s); no retries                                                    |
| mosaic    | PARTIAL | `research_repos/mosaic/packages/vgplot/spec/playwright.config.js`                                                                                                        | `workers: 1` and `retries: process.env.CI ? 2 : 0`; playwright's default budgets otherwise                                                                  |
| streamlit | FULL    | `research_repos/streamlit/e2e_playwright/pytest.ini`, `research_repos/streamlit/.github/workflows/playwright.yml`, `research_repos/streamlit/e2e_playwright/conftest.py` | Per-test ceiling `timeout = 180` (`timeout_func_only`), `--reruns 0` locally and `--reruns 1` in CI, per-call waits (`timeout=30000`), a 20 s graceful stop |

**Count:** 3 of 4 do something, and all of it is one of three levers: a large global ceiling (framework 30 s per test, streamlit 180 s), fewer workers (mosaic 1), or retries confined to CI (mosaic 2, streamlit 1). None of them looks at the host's load; a load-aware gate would be ours alone, and is justified by this repo's AGENTS.md "Wait when the host is busy" rule, which `pnpm gate` does not yet follow.

## Implementation inventory

### framework

| Concern        | Files                                                                                  |
| -------------- | -------------------------------------------------------------------------------------- |
| Global ceiling | `research_repos/framework/package.json` (`test:mocha:serial`: `mocha --timeout 30000`) |
| Per-test setup | `research_repos/framework/test/build-test.ts`                                          |

### mosaic

| Concern             | Files                                                             |
| ------------------- | ----------------------------------------------------------------- |
| Workers and retries | `research_repos/mosaic/packages/vgplot/spec/playwright.config.js` |

### streamlit

| Concern                   | Files                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Per-test ceiling, reruns  | `research_repos/streamlit/e2e_playwright/pytest.ini` (`timeout = 180`, `timeout_func_only`, `--reruns 0`)         |
| CI-only reruns            | `research_repos/streamlit/.github/workflows/playwright.yml` (`--reruns 1`, `timeout-minutes: 30`)                 |
| Server start/stop budgets | `research_repos/streamlit/e2e_playwright/conftest.py` (`_stop_process` 20 s wait, `wait_for_app_server_to_start`) |

**Disagreement:** framework and streamlit buy headroom with one large ceiling; mosaic buys it with fewer workers; mosaic and streamlit both refuse local retries (they would hide a real race). The slice must pick between scaling the budgets, cutting parallelism, and not starting at all on a busy host.

## Trade-offs and what we adopt

| Axis                    | Options seen (repo → approach)                                                       | Trade-off                                                                                                  | Our choice, and why                                                                                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Busy host at gate start | none → (absent everywhere); devjob → wait while load ≥ `nproc`                       | Waiting delays a gate; starting anyway produces failures that measure the neighbours (AGENTS.md)           | T1: `scripts/gate.sh` reads the 1 min load before the heavy tiers and waits (bounded, printing the reading) while it is above `nproc` — the rule this repo already asks humans to follow                                                                                                                     |
| Browser `expect` budget | framework/streamlit → one generous ceiling; ours → 10 s default + 113 hand overrides | A bigger default hides nothing a correct test needs; it only makes a genuine failure take longer to report | T2: size `expect.timeout` (and `timeout`) in `playwright.config.ts` from the 50% quota run with ≥ 2× headroom; delete every per-call assertion override at or below the new default (`toPass`, `click`, `waitForFunction` and the deliberate `3_000` bounds keep theirs — they do not read `expect.timeout`) |
| Retries                 | mosaic/streamlit → CI only                                                           | A local retry turns a real race into a pass                                                                | Unchanged: `retries: process.env.CI ? 2 : 0` already matches both                                                                                                                                                                                                                                            |
| Workers                 | mosaic → 1; ours → 2                                                                 | 1 worker roughly doubles the browser tier's wall time on an idle host                                      | Unchanged; revisit only if T2's budgets cannot be met at 50% quota                                                                                                                                                                                                                                           |
| Integration `afterEach` | vitest default 10 s `hookTimeout`                                                    | Raising it blind repeats the hand-sizing problem                                                           | Decided by the measured 200% run above: no change — the hook passed at 10% (single file) and 200% (every project); no task. T1's load admission covers whatever load the 2026-10-10 run met                                                                                                                  |

## Gap analysis — what we already have vs the references

| Concern                  | Ours today (file)                                                                                  | Best reference (file)                                                | Gap                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Load admission           | `scripts/gate.sh` (none), `scripts/run-capped.sh` (caps, no wait)                                  | none in the references; host `devjob` admission rule                 | absent                                                                     |
| Browser per-test budget  | `playwright.config.ts` `timeout: 60_000` + `test.slow()`                                           | `research_repos/streamlit/e2e_playwright/pytest.ini` `timeout = 180` | partial — 58.1 s of 60 s used at 50% quota                                 |
| Browser assertion budget | `playwright.config.ts` `expect: { timeout: 10_000 }` + 113 overrides in `test/e2e-browser/*.ts`    | `research_repos/framework/package.json` one 30 s ceiling             | partial — the un-overridden `filter-inputs.spec.ts:386` fails at 50% quota |
| Retries                  | `playwright.config.ts` `retries: process.env.CI ? 2 : 0`                                           | `research_repos/mosaic/packages/vgplot/spec/playwright.config.js`    | complete                                                                   |
| Integration hook budget  | `vitest.config.ts` (default 10 s), `test/integration/pages-plugin.integration.test.ts` `afterEach` | `research_repos/framework/package.json` (30 s covers hooks too)      | complete since `58eaebc` — not reproduced at 10% or 200% quota             |

## Open decisions

- T1's admission rule: wait while `load1 > nproc` (AGENTS.md's wording) or `≥` (devjob's); the maximum wait before the gate gives up and prints the readings; whether the check runs once before the vitest tier or before each heavy tier. Settle by reading `scripts/gate.sh` step order and timing one gate.
- T2's numbers: the new `expect.timeout` and `timeout` come from the slowest step of the 50% quota run, not from this PRD.

## Surface

| Layer  | Files                                                                                                                                                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | —                                                                                                                                                                                                                                   |
| client | —                                                                                                                                                                                                                                   |
| ui     | —                                                                                                                                                                                                                                   |
| tests  | `scripts/gate.sh`, `test/integration/gate-load.integration.test.ts` (new, beside `test/integration/run-capped.integration.test.ts`), `playwright.config.ts`, `test/e2e-browser/*.spec.ts`, `test/e2e-browser/dev-server.fixture.ts` |

## Tasks

- [x] T1 — `scripts/gate.sh` waits for a host whose 1 min load exceeds `nproc` before its heavy tiers, printing the reading, bounded by a maximum wait; RED first in an integration test that injects the load reading and core count (no real load), then the §5 pass
- [x] T2 — browser budgets sized from a measured 50% quota run: `playwright.config.ts` `timeout: 230_000`/`expect.timeout: 70_000` (2× the slowest passing test, 114 s, and assertion, 31.8 s), every assertion override at or below the new default removed; RED was `filter-inputs.spec.ts:386` at `CPUQuota=50%`; the full browser tier at 50% then failed 8 of 115 on defects no budget fixes — DEF-001, DEF-002, DEF-003 in `docs/backlog.md` Known debt, left failing, not masked

## Out of scope

- Making the app itself faster under load (query latency, chart render) — no measurement here points at app code.
- Local retries — both references with retries confine them to CI.
- Routing `pnpm gate` through the host's `devjob` — host tooling, not part of this repo.
