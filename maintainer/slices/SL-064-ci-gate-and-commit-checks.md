# SL-064 — A pull request runs the gate on GitHub, and a non-conventional title or commit fails a check

Milestone: Phase 9 — Open-source release · State: open · Depends on: SL-063 (shipped) · Closes: GAP-087, GAP-088

> Delete this file when the slice ships.
>
> Every local path below was checked with `test -e` on 2026-11-06; the three owner/vite workflow paths were read through `gh api repos/<owner>/<repo>/contents/<path>` the same day. Line ranges are omitted on purpose.

## Outcome

A contributor opens a pull request and GitHub runs `pnpm gate` on it and reports `gate` as a check; a pull request whose title, or any commit it adds, is not a conventional commit fails a second check naming the offending subject. Both checks carry the job names a `master` ruleset will later require.

## Demo

1. On a branch, push a trivial change and open a pull request titled `Update stuff` against `master` in the private repository.
2. The `gate` check runs `pnpm gate` and goes green; the `pull-request-title` check goes red and its log prints `Update stuff` with the broken rules (`type-empty`, `subject-empty`).
3. Edit the title to `docs: update stuff` — no push. `pull-request-title` re-runs (activity type `edited`) and goes green; `gate` does not re-run.
4. Push a commit with the subject `wip` — `commit-messages` goes red naming `wip`; amend it to a conventional subject, force-push, it goes green.
5. Read the wall-time of every `gate: <step> passed (Ns)` line from the `gate` job log; they are recorded in the T3 commit body.

Binding the checks as _required_ is an owner act (see Deviations); the demo proves the checks fail and pass, not that a merge is blocked.

## Who else implements this

| Repo      | Has it                                                                                                                          | Entry points                                                                                                                | Approach in one line                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | CI gate PARTIAL (unit tests only) · title/commit check ABSENT                                                                   | `research_repos/evidence/.github/workflows/test.yml`                                                                        | `pnpm install --frozen-lockfile` then `pnpm test`, Node 22.22, tags (`@v4`) not SHAs, no permissions block                                               |
| framework | CI gate PARTIAL (no browser tier) · title/commit check ABSENT                                                                   | `research_repos/framework/.github/workflows/test.yml`                                                                       | matrix Node 20/22 × ubuntu/windows; coverage, `tsc`, eslint with problem matcher, prettier; uploads changed outputs on failure                           |
| mosaic    | CI gate FULL (lint, build, test, browser) · title/commit check ABSENT                                                           | `research_repos/mosaic/.github/workflows/test.yml`                                                                          | `permissions: contents: read`; browser job runs in container `mcr.microsoft.com/playwright:v1.63.0-noble` with `--user 1001`; uploads Playwright results |
| streamlit | CI gate FULL (pre-commit, JS tests, Playwright) · title/commit check PARTIAL (`require-labels.yml` checks labels, never titles) | `research_repos/streamlit/.github/workflows/enforce-pre-commit.yml`, `playwright.yml`, `js-tests.yml`, `require-labels.yml` | runs the repo's own pre-commit verbatim; SHA-pinned actions with `# vX` comments; `concurrency` cancels a stale run; `persist-credentials: false`        |

**Count:** a CI gate exists in 4 of 4 references (2 of 4 run the browser tier); a PR-title or commit-message check exists in 0 of 4 — building it is an invention against the feature references, justified by the owner's `jupydroid` and by `vitejs/vite`, two repositories that do run one, and by `commitlint.config.js` already being the repository's rule. A gate that CI does not run is the stronger gap: every reference runs its own checks on a pull request.

Outside the 4 references (owner and npm peers, `maintainer/research/release-and-security.md` "Who else implements this"):

| Source                                        | Entry point                                        | What it shows                                                                                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dmenezesgabriel/jupydroid` (private)         | `.github/workflows/ci.yml` (`commit-messages` job) | commitlint over `base.sha..head.sha` (`fetch-depth: 0`) plus the PR title through `env`, `if: ${{ !cancelled() }}` so both failures show in one run; `permissions: {}` default; SHA-pinned actions |
| `dmenezesgabriel/claude-acc-manager` (public) | `.github/workflows/ci.yml` (`gate` job)            | the job runs the local gate verbatim "so CI can never pass what a commit cannot"; job `name:` values are the required-check API; sha-keyed concurrency; `timeout-minutes` set                      |
| `vitejs/vite`                                 | `.github/workflows/semantic-pull-request.yml`      | `amannn/action-semantic-pull-request` on `pull_request_target` (types include `edited`), reads only the title, own `subjectPattern`; a second source of truth beside any commitlint config         |

## Implementation inventory

### Gate in CI

| Concern                           | Files to open                                                                                                                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole-repo job, install, test     | `research_repos/mosaic/.github/workflows/test.yml` (`node` job), `research_repos/evidence/.github/workflows/test.yml`, `research_repos/framework/.github/workflows/test.yml`                                            |
| Browser tier in CI                | `research_repos/mosaic/.github/workflows/test.yml` (`browser` job, Playwright container), `research_repos/streamlit/.github/workflows/playwright.yml` (browser install action, artifact upload)                         |
| Run the repo's own hooks verbatim | `research_repos/streamlit/.github/workflows/enforce-pre-commit.yml`; owner `claude-acc-manager` and `jupydroid` `.github/workflows/ci.yml`                                                                              |
| Concurrency, permissions, pinning | owner `ci.yml` files (header comments); `research_repos/streamlit/.github/workflows/enforce-pre-commit.yml` (`concurrency`, `persist-credentials: false`)                                                               |
| Our gate and its host handling    | `scripts/gate.sh`, `scripts/run-capped.sh` (no-systemd fallback to `nice` + `timeout`), `scripts/wait-for-host.sh`, `playwright.config.ts` (`process.env.CI`: `retries`, `forbidOnly`, no server reuse), `package.json` |

### PR title and commit check

| Concern                 | Files to open                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Commit range and title  | `dmenezesgabriel/jupydroid:.github/workflows/ci.yml` (`commit-messages`)                                                              |
| Title-only action       | `vitejs/vite:.github/workflows/semantic-pull-request.yml`                                                                             |
| Our rule                | `commitlint.config.js`, `.husky/commit-msg`, `.github/PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md` (conventional-commit paragraph)    |
| Label-based alternative | `research_repos/streamlit/.github/workflows/require-labels.yml` — checks labels with `actions/github-script`, not titles; not adopted |

### Where the references disagree (the decisions)

- **One job or several.** Owner repos run the local gate verbatim in one job; mosaic and streamlit split by tier. Ours measures first (T3).
- **Browser provisioning.** mosaic runs the job in the Playwright image; streamlit installs with an action; `package.json` `test:e2e:setup` installs every browser with `--with-deps`, but `playwright.config.ts` has only a `chromium` project.
- **Title check source.** jupydroid reuses the repo's commitlint config; vite uses an action with its own pattern. Two sources of truth drift.
- **Pinning.** evidence uses tags (`@v4`); streamlit and both owner repos use full SHAs with a version comment.

## Trade-offs and what we adopt

| Axis                 | Options seen (repo → approach)                                               | Trade-off                                                                                                 | Our choice, and why                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate shape           | owner → one job, local gate verbatim; mosaic/streamlit → jobs per tier       | one job reports nothing until it ends; split jobs duplicate setup and can drift from `scripts/gate.sh`    | one job `gate` running `pnpm gate`, so CI cannot pass what `pnpm gate` cannot; split only when the measured wall-time forces it (T3)                                                                                                     |
| Title/commit source  | jupydroid → commitlint config; vite → action with own regex                  | action is one less script, but a second rule set and a third-party action                                 | `commitlint.config.js` through `pnpm exec commitlint`; no third-party action                                                                                                                                                             |
| Event                | vite → `pull_request_target`; jupydroid → `pull_request`                     | `pull_request_target` has secrets and write scope on fork PRs                                             | `pull_request`: read-only token on forks, no secrets; the title is read through `env`, never interpolated into the script                                                                                                                |
| Re-run on title edit | jupydroid → default types (a title fix needs a push); vite → `edited` listed | `edited` also fires on body edits, so putting it in `ci.yml` would re-run the gate on every body edit     | own file `.github/workflows/conventional-commits.yml` with `types: [opened, edited, reopened, synchronize]`; `ci.yml` keeps the default types. GitHub documents the defaults as `opened`, `synchronize`, `reopened`                      |
| Package manager      | evidence, mosaic → `pnpm/action-setup`; none → corepack                      | corepack ships with Node 24 (measured: corepack 0.35.0 beside Node v24.18.0) and honours `packageManager` | `corepack enable` — one fewer third-party action to pin and audit                                                                                                                                                                        |
| Node version         | owner `jupydroid` → exact `24.18.0`; `.nvmrc` → `24`                         | a float turns a runner Node bump into a red gate with no repo change                                      | exact `24.18.0` in the workflow, with a comment naming `.nvmrc` and `engines` (`>=24.12.0 <25`); the local Node is v24.18.0                                                                                                              |
| Browser              | mosaic → container; streamlit → install action                               | container pins the OS libs; install needs `--with-deps` (sudo apt) each run unless cached                 | **open** — start with `pnpm exec playwright install --with-deps chromium`; T3 compares it with the container on cold and warm runs                                                                                                       |
| Hardening            | owner repos, streamlit                                                       | none worth skipping                                                                                       | `permissions: {}` at the top and `contents: read` per job; `persist-credentials: false`; actions pinned to a full SHA with `# vX.Y.Z`; `HUSKY: "0"`; `concurrency` keyed on PR number or sha; `timeout-minutes` above `BIAC_RUNTIME_MAX` |

## Gap analysis — what we already have vs the references

| Concern          | Ours today (file)                                                                                                                    | Best reference (file)                                     | Gap                                                                                                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI workflow      | none — `.github/` holds `CODEOWNERS`, `ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`; `ls .github/workflows` fails (GAP-087)          | owner `claude-acc-manager:.github/workflows/ci.yml`       | absent                                                                                                                                                                                                                                                                                                         |
| Gate script      | `scripts/gate.sh` runs inside `scripts/run-capped.sh`, which already falls back to `nice` + `timeout` without a systemd user manager | the same owner `ci.yml` (runs its gate verbatim)          | partial — its probe checked the user manager, not scope placement, so on a GitHub-hosted runner `systemd-run --slice-inherit` failed and the gate exited 1 before any step (first real run); fixed by probing a real scope, with a regression test. CI also sets `BIAC_RUNTIME_MAX` for the measured wall-time |
| Host wait        | `scripts/wait-for-host.sh` waits up to 10 min before the vitest and browser tiers while 1 min load exceeds `nproc`, then exits 75    | —                                                         | partial for CI — a private runner has 2 vCPU, so a load above 2 during install can stall the gate; T3 reads the reading from the log and decides                                                                                                                                                               |
| Browser setup    | `playwright.config.ts` is CI-aware (`retries: 2`, `forbidOnly`, no storybook reuse when `CI` is set) with a `chromium` project only  | `research_repos/mosaic/.github/workflows/test.yml`        | partial — browsers are not installed on a clean runner; `test:e2e:setup` installs all three browsers, which is more than the config uses                                                                                                                                                                       |
| Commit rule      | `commitlint.config.js` runs only in `.husky/commit-msg` (client-side, skippable with `--no-verify`) (GAP-088)                        | `dmenezesgabriel/jupydroid:.github/workflows/ci.yml`      | present but unreachable from the server                                                                                                                                                                                                                                                                        |
| PR title rule    | `.github/PULL_REQUEST_TEMPLATE.md` asks for a conventional title by checkbox                                                         | `vitejs/vite:.github/workflows/semantic-pull-request.yml` | absent                                                                                                                                                                                                                                                                                                         |
| Existing history | 0 non-conventional subjects in `git log --format=%s` (measured 2026-11-06)                                                           | `jupydroid` skips push-to-main for its 3 legacy subjects  | complete — only the pull-request range needs checking; no push-to-`master` commit check                                                                                                                                                                                                                        |

Nothing in `maintainer/` or the backlog claims either gap is shipped.

## Deviations

- The backlog row says "fails a required check". Rulesets and required status checks need the repository to be public (or a paid plan) and are an owner act listed in `maintainer/research/release-and-security.md` "Owner-only acts". This slice ships the checks and their stable job `name:` values (`gate`, `commit-messages`, `pull-request-title`); binding them is the owner's, on the day the repository goes public. A job `name:` is the required-check API, so renaming one means updating the ruleset in the same change.
- The default branch is `master`; the owner's reference workflows trigger on `main`.
- The gate runs as two jobs, not one. On a 2 vCPU private runner `pnpm gate` took 78 s of static checks, 592 s of vitest and 25 s of cucumber, then the browser tier (466 tests) was still at about 290 tests after an hour and hit the 110 minute cap. `ci.yml` runs `pnpm gate` with `BIAC_GATE_SKIP_BROWSER=1` as job `gate`, and the browser tier as four Playwright shards, `e2e-browser (N/4)`; the required-check names are therefore `gate` and the four shard names. The first sharded run showed `gate` green in 10 minutes and shards 1–3 green in 8–21 minutes, but the two storybook-sweep tests (one story visit loop, one docs-page loop) cannot be split by `--shard`: one attempt took 13 to 29 minutes and shard 4 hit its cap. They now run as job `storybook`, and the shards exclude them with `--grep-invert="storybook stories"`. The sweep's first attempt failed after 9.8 minutes on `pages-markdownpage--plain-page` with vite's `504 (Outdated Optimize Dep)` and passed on the retry; a cold Storybook server re-optimizing a dependency mid-sweep is a flake in the suite, not in CI, and is left for the owner to schedule.

## Open decisions

| Decision                                                    | Evidence to gather                                                                                                             | Default if the evidence is a tie                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| One `gate` job, or split by tier                            | settled by T1: split — `gate`, four `e2e-browser` shards and `storybook` ran green in 37 minutes of wall-time (see Deviations) | —                                                                     |
| Playwright install or container, and whether to cache       | cold and warm wall-time of `playwright install --with-deps chromium` against the container pull                                | install, cached on the pinned `@playwright/test` version              |
| pnpm store cache through `actions/setup-node` `cache: pnpm` | cold vs warm `pnpm install --frozen-lockfile`; the publish workflow (SL-068) must not restore caches                           | enable on the PR gate only                                            |
| `fallow:score` in CI                                        | it runs in `.husky/pre-commit` but not in `scripts/gate.sh`; measure its wall-time                                             | leave out — the gate is the contract (`CONTRIBUTING.md`, PR template) |
| `wait-for-host.sh` on a runner                              | the printed load reading in the first runs                                                                                     | leave as is unless it stalls a run                                    |

Each decision settled in T3 is recorded in the commit body; one that changes the repository's shape gets an ADR.

## Surface

| Layer  | Files                                                                                                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | none                                                                                                                                                                                |
| client | none                                                                                                                                                                                |
| ui     | none — an infrastructure slice; the stack it crosses is workflow → gate → check run, closed by the live pull request                                                                |
| config | `.github/workflows/ci.yml` (new), `.github/workflows/conventional-commits.yml` (new)                                                                                                |
| tests  | none in `test/` — a workflow is not unit-testable; verification is a clean-container run of its commands, `pnpm exec commitlint` on good and bad samples, and the live pull request |

## Tasks

- [x] T1 — `.github/workflows/ci.yml`, job `gate`: checkout (`persist-credentials: false`) → `actions/setup-node` Node 24.18.0 → `corepack enable` → `pnpm install --frozen-lockfile` with `HUSKY=0` → `pnpm exec playwright install --with-deps chromium` → `pnpm gate`. Triggers `pull_request`, `push` to `master`, `workflow_dispatch`; `permissions: {}` with `contents: read` on the job; `concurrency` and `timeout-minutes` set. Verified by running the same commands in a clean `ubuntu:24.04` container under `nice`/`timeout` (host measured first), then by the real run once the owner approves pushing a branch.
- [x] T2 — `.github/workflows/conventional-commits.yml`: jobs `commit-messages` (range `base.sha..head.sha`, `fetch-depth: 0`) and `pull-request-title`, both through `pnpm exec commitlint` against `commitlint.config.js`; event values through `env`; no `!cancelled()` guard, since two jobs already run independently; both use `.github/actions/setup` with its `browser` input set to `"false"`. Verified locally by feeding `pnpm exec commitlint` conventional and non-conventional samples (including a subject over 100 characters and a sentence-case subject), then on GitHub with the Demo steps 1–4.
- [ ] T3 — Measure the `gate` wall-time on the runner (cold and warm), settle the Open decisions, mark GAP-087 and GAP-088 closed in `maintainer/research/release-and-security.md`, mark SL-064 `shipped` in `maintainer/backlog.md` once a human has run the Demo, delete this file. Results go in the commit body.

## Out of scope

- Static scanners (gitleaks, osv-scanner, zizmor, actionlint, opengrep, CodeQL, dependency review, Scorecard) — SL-065.
- Dependabot configuration and its commit-message prefix — SL-066.
- Release workflow, versioning and npm publishing — SL-067, SL-068.
- Making `gate`, `commit-messages` and `pull-request-title` required, and enabling a `master` ruleset — owner act after the repository is public.
- A Windows or Node-version matrix; `engines` allows only Node 24.
