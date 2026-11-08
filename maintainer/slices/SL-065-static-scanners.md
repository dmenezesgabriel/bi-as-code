# SL-065 — Static scanners run on every pull request, on `master` and weekly

Milestone: Phase 9 — Open-source release · State: open · Depends on: SL-063, SL-064 (both shipped) · Closes: GAP-089, GAP-090

> Delete this file when the slice ships.
>
> Every path below was checked with `test -e` on 2026-11-07. Line ranges are omitted on purpose. Owner repositories are read with `gh api repos/dmenezesgabriel/<repo>/contents/<path>`.

## Outcome

A pull request, a push to `master` and a weekly cron run secret, lockfile-advisory, workflow-lint, SAST and image scans that need no account, so a leaked key, a vulnerable locked dependency or an unsafe workflow turns a required check red before the repository goes public.

## Demo

1. Open a pull request: `gh run list --workflow security.yml` shows the run, and `gh run view <id>` lists the jobs `gitleaks`, `osv-scanner`, `pnpm-signatures`, `actionlint`, `zizmor`, `opengrep` green; `codeql`, `dependency-review` and `scorecard` show `skipped` while `gh repo view dmenezesgabriel/bi-as-code --json visibility` answers `PRIVATE`.
2. On a throwaway branch commit a fake AWS key (`AKIAIOSFODNN7EXAMPLE` with a secret-shaped pair): `gitleaks` goes red and its log shows the finding redacted.
3. On a throwaway branch change one `uses:` to a movable tag (`actions/checkout@v7`): `zizmor` goes red naming the file and the `unpinned-uses` finding.
4. On a throwaway branch add a package with a known advisory to `pnpm-lock.yaml`: `osv-scanner` goes red naming the package and the advisory id.
5. `gh workflow run security.yml` (dispatch) runs the `master`-only jobs too; the weekly `schedule` appears in `gh workflow view security.yml`.
6. Delete the throwaway branches.

## Who else implements this

| Repo      | Has it  | Entry points                                                                                                                                                                     | Approach in one line                                                                                                                                           |
| --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | ABSENT  | `research_repos/evidence/.github/workflows/` (`cli-build.yml`, `test.yml`, `upstream-pr.yml`)                                                                                    | No scanner workflow, no Dependabot file                                                                                                                        |
| framework | ABSENT  | `research_repos/framework/.github/workflows/` (`deploy.yml`, `publish.yml`, `test.yml`)                                                                                          | No scanner workflow, no Dependabot file                                                                                                                        |
| mosaic    | PARTIAL | `research_repos/mosaic/.github/dependabot.yml`                                                                                                                                   | Dependabot only (monthly, grouped); no scanning workflow                                                                                                       |
| streamlit | FULL    | `research_repos/streamlit/.github/workflows/codeql-analysis.yml`, `research_repos/streamlit/.github/codeql-config.yml`, `research_repos/streamlit/.github/workflows/semgrep.yml` | CodeQL (javascript, python) on push, PR and weekly cron with a `security-and-quality` pack; Semgrep through a reusable workflow that needs `SEMGREP_APP_TOKEN` |

**Count:** 1 of 4 scan code, 1 more runs Dependabot. A capability most references lack is normally a reason to hesitate; here it is justified by the release itself: the repository goes public and publishes to npm, and the two owner repositories (`jupydroid`, `claude-acc-manager`) already run this exact battery, so the design is proven, not invented. streamlit's Semgrep needs an account token, which the owner's constraint (no account) excludes, so opengrep replaces it.

## Implementation inventory

### streamlit

| Concern                  | Files                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Triggers, matrix         | `research_repos/streamlit/.github/workflows/codeql-analysis.yml` (`push`, `pull_request`, weekly `schedule`; matrix of two languages)               |
| Query pack, path filters | `research_repos/streamlit/.github/codeql-config.yml` (`security-and-quality`, `query-filters` excluding five python rules, `paths`, `paths-ignore`) |
| Permissions              | same workflow (`actions: read`, `contents: read`, `security-events: write` on the job)                                                              |
| Pinning                  | same workflow (checkout and codeql-action pinned by SHA with a `# vX` comment)                                                                      |

### mosaic

| Concern            | Files                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Dependency updates | `research_repos/mosaic/.github/dependabot.yml` (SL-066 owns it, listed for completeness) |

### dmenezesgabriel/jupydroid (owner, private)

| Concern                                   | Files                                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pinned binaries, `--redact`, history scan | `.github/workflows/security.yml` jobs `gitleaks` (`GITLEAKS_VERSION` + `GITLEAKS_SHA256`, `gitleaks git` then `gitleaks dir`), `osv-scanner`, `opengrep` (rules fetched by commit), `grype` |
| Visibility guard                          | same file, job `codeql` (`if: github.event.repository.visibility == 'public'`, `security-events: write`)                                                                                    |
| Triggers, concurrency, permissions        | same file header (`push`, `pull_request`, Monday cron, `workflow_dispatch`; `permissions: {}`; sha-keyed concurrency)                                                                       |
| Scorecard                                 | `.github/workflows/scorecard.yml`                                                                                                                                                           |

### dmenezesgabriel/claude-acc-manager (owner, public)

| Concern                | Files                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| zizmor, pedantic       | `.github/workflows/security.yml` job `zizmor` (`--persona pedantic .github/`, plain format because `--format=sarif` always exits 0)          |
| gitleaks (action form) | same file job `gitleaks` (marketplace action, needs `GITHUB_TOKEN` for its owner lookup)                                                     |
| Scorecard              | `.github/workflows/scorecard.yml` (push to default branch, weekly cron, never PRs; `id-token: write`, SARIF upload, `publish_results: true`) |

### Where they disagree — decisions this slice makes

| Axis                 | streamlit                          | owner repos                                                                               | Ours (decided)                                                                                                         |
| -------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| SAST engine          | CodeQL + Semgrep (account token)   | jupydroid: opengrep + CodeQL; claude-acc-manager: CodeQL                                  | CodeQL (public only) plus opengrep, per the research decision "scanners that need no account"                          |
| Scanner installation | marketplace actions, reusable flow | jupydroid: binaries pinned by version and sha256; claude-acc-manager: marketplace actions | Binaries pinned by version and sha256 (`maintainer/research/release-and-security.md`, decision "Scanner installation") |
| Workflow lint        | none                               | claude-acc-manager: zizmor only                                                           | zizmor (pedantic) **and** actionlint, both named by the backlog row                                                    |

## Trade-offs and what we adopt

| Axis              | Options seen (repo → approach)                                                           | Trade-off                                                                       | Our choice, and why                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| File layout       | jupydroid and claude-acc-manager → `security.yml` beside `ci.yml`, `scorecard.yml` apart | A scanner file keeps `ci.yml` a pure gate and gives the cron its own home       | `.github/workflows/security.yml` and `.github/workflows/scorecard.yml`              |
| Blocking policy   | jupydroid → block where findings are real, report-only where hits are design choices     | A scanner that always fails teaches readers to ignore it                        | Decided per scanner from a measured local run on this tree (open decisions 2 and 3) |
| PR vs master-only | jupydroid → image scan and mobile scan only on master, cron, dispatch                    | A pull request pays minutes for an input that changes with the Dockerfile alone | Image scan of the `Dockerfile` base runs on master, cron and dispatch               |

## Gap analysis — what we already have vs the references

| Concern                 | Ours today (file)                                                                                              | Best reference (file)                                                                                      | Gap                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Secret scan config      | `.gitleaks.toml` (extends default rules, allowlists the fake `viewer:s3cret` pair); SL-063 ran it locally once | `jupydroid:.github/workflows/security.yml` (`gitleaks`)                                                    | Config present; **no workflow runs it** — absent in CI                                       |
| Lockfile advisories     | `pnpm-lock.yaml` (14178 lines); `pnpm audit` answers 0 advisories over 1540 packages (2026-11-07)              | `jupydroid:.github/workflows/security.yml` (`osv-scanner`)                                                 | **absent** in CI; osv-scanner reading `pnpm-lock.yaml` is unmeasured                         |
| Registry signatures     | none; `pnpm audit --help` lists `--audit-level`, `--dev`, `--prod`, `--ignore`, `--json`, no signature option  | `npm audit signatures` (reads `package-lock.json` only)                                                    | **absent**; no pnpm equivalent exists (GAP-090), decided in T4                               |
| Workflow lint           | none; `.github/workflows/ci.yml`, `conventional-commits.yml`, `.github/actions/setup/action.yml` unlinted      | `claude-acc-manager:.github/workflows/security.yml` (`zizmor`)                                             | **absent**; actions are already SHA-pinned with `# vX` comments, permissions default to `{}` |
| SAST                    | none                                                                                                           | `streamlit:.github/workflows/codeql-analysis.yml`, `jupydroid:.github/workflows/security.yml` (`opengrep`) | **absent**                                                                                   |
| Image scan              | `Dockerfile` bases `node:24-slim@sha256:55fb5f5a…` (lines 19 and 61), digest-pinned, never scanned             | `jupydroid:.github/workflows/security.yml` (`grype`)                                                       | **absent**                                                                                   |
| Visibility-guarded jobs | none (repository is `PRIVATE`)                                                                                 | `jupydroid` `codeql`; `claude-acc-manager:.github/workflows/scorecard.yml`                                 | **absent**; written now, skipped until public                                                |

Our `.github/workflows/` holds `ci.yml` and `conventional-commits.yml` only; `.github/` has no `dependabot.yml`. The ledger claims nothing shipped for GAP-089 or GAP-090, so no existing claim needs re-checking.

## Deviations

- opengrep replaces Semgrep: streamlit's Semgrep job needs `SEMGREP_APP_TOKEN`, an account the owner excluded.
- Scanner binaries, not marketplace actions (research decision), except where only an official action exists (`github/codeql-action`, `actions/dependency-review-action`, `ossf/scorecard-action`), pinned by SHA.

## Open decisions

1. **GAP-090 signature audit.** Decided in T4: `pnpm audit signatures` from pnpm 12.15.0 (https://pnpm.io/cli/audit), run by a second pinned pnpm in the `pnpm-signatures` job. Measured: osv-scanner 2.7.0 reads 1535 packages for advisories and has no signature option; npm needs `--legacy-peer-deps` after `ERESOLVE`, resolves a tree that lacks 142 of pnpm's 1535 pins and adds 172 versions pnpm never locked, and must install 1.1 GB before `npm audit signatures` (1510 verified) can run; pnpm 10.33.2 treats `signatures` as a stray argument and passes a plain advisory audit; pnpm 12.15.0 verifies 1535 of 1535 from `pnpm-lock.yaml` alone. The repo's `packageManager: pnpm@10…` pin makes pnpm 12 hand over to pnpm 10 unless `pnpm_config_manage_package_manager_versions=false`, so the job also requires the "verified registry signatures" summary line. Moving the repo to pnpm 12 would drop the second binary; that is its own change.
2. **opengrep: block or report.** Decided in T2: report. The security rule directories flag 28 places over `src/`, `scripts/`, `test/`, `.github/` and the `Dockerfile` with the pinned rule commit, none a defect; the best-practice and i18n directories add about 400 more and are left out.
3. **osv-scanner at PR time.** Whether any advisory blocks, given `aa27c11` upgraded past 33 advisories and `pnpm audit` is clean today.
4. **zizmor persona.** `pedantic` as in claude-acc-manager; run it on our two workflows and the setup composite, fix real findings in the same commit.
5. **actionlint pinning.** Version and sha256 of the release archive, taken from the project's published checksum file in the session that writes the job.

## Surface

| Layer  | Files                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| engine | none — no `src/` file changes                                                                                                |
| client | none                                                                                                                         |
| ui     | none; `playwright-cli` smoke over `bin/biac dev` closes each task (nothing user-visible changes)                             |
| ci     | `.github/workflows/security.yml`, `.github/workflows/scorecard.yml`, `.gitleaks.toml` (only if a finding needs an allowlist) |
| tests  | local scanner runs recorded in each commit body; seeded failures on throwaway branches (Demo steps 2–4), never committed     |

## Tasks

- [x] T1 — `security.yml` with `gitleaks` (history and checkout), `osv-scanner`, `actionlint` and `zizmor`, binaries pinned by version and sha256, `permissions: {}`, sha-keyed concurrency, triggers `push` to `master`, `pull_request`, Monday cron, `workflow_dispatch`. RED: each scanner run locally on the tree, findings recorded; GREEN: the jobs pass, real findings fixed.
- [x] T2 — `opengrep` (version + sha256, rules by commit) and `grype` on the `Dockerfile` base, the latter off the pull-request path. `grype` blocks on fixable medium and above and is red today (8 High, 12 Medium in the pinned `node:24-slim` digest), so `master` stays red until the `Dockerfile` digest is bumped.
- [x] T3 — `codeql`, `dependency-review` and `scorecard.yml`, each guarded by `github.event.repository.visibility == 'public'`.
- [x] T4 — GAP-090: `pnpm-signatures` job in `security.yml`, pnpm 12.15.0 pinned by version and sha256, chosen from the measurements in open decision 1.
- [ ] T5 — close: mark GAP-089 and GAP-090 `closed` in `maintainer/research/release-and-security.md`, set SL-065 `shipped` in `maintainer/backlog.md`, run the Demo, delete this file.

## Out of scope

Dependabot and the repo-settings checklist (SL-066); the npm tarball and publishing (SL-067, SL-068); making the repository public and enabling code scanning, secret scanning and push protection (owner-only acts, listed in `maintainer/research/release-and-security.md`).
