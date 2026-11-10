# SL-066 — Dependabot opens conventional-titled update PRs and the repository settings are written down

Milestone: Phase 9 — Open-source release · State: partial · Depends on: SL-064, SL-065 (both shipped) · Closes: GAP-091

> Delete this file when the slice ships.
>
> Every path below was checked with `test -e` on 2026-11-08, every number carries its command, and every external claim carries a URL fetched that day. Line ranges are omitted on purpose.

## Outcome

The maintainer opens the repository's Pull requests tab and finds weekly, grouped, conventional-titled Dependabot PRs for GitHub Actions, npm and the Docker base image, and finds the repository's settings written down as a checklist that the owner applies once in the GitHub UI.

## Demo

1. Owner act: merge this branch to `master` (Dependabot reads `.github/dependabot.yml` from the default branch only).
2. `gh pr list --author "app/dependabot" --json title,headRefName` lists PRs whose titles read `ci(deps): …` or `build(deps): …`; each passes the `commit-messages` and `pull-request-title` checks.
3. After the repository is public, the owner applies the checklist in `CONTRIBUTING.md` in the GitHub UI (ruleset, merge methods, Actions policy, secret scanning, push protection, private vulnerability reporting).

## Who else implements this

| Repo      | Has it  | Entry points                                                                                         | Approach in one line                                                                                                                                        |
| --------- | ------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | ABSENT  | `research_repos/evidence/.github/workflows/` (3 workflows, no other file under `.github/`)           | None: no Dependabot, no Renovate, no CODEOWNERS                                                                                                             |
| framework | ABSENT  | `research_repos/framework/.github/` (`ISSUE_TEMPLATE`, `eslint.json`, `workflows/` with 3 workflows) | None: no Dependabot, no Renovate, no CODEOWNERS                                                                                                             |
| mosaic    | PARTIAL | `research_repos/mosaic/.github/dependabot.yml`, `research_repos/mosaic/.github/CODEOWNERS`           | Monthly updates for github-actions, npm, pip, cargo and gomod; one group per ecosystem or dependency type; no cooldown, no commit-message                   |
| streamlit | PARTIAL | `research_repos/streamlit/.github/dependabot.yml`, `research_repos/streamlit/.github/CODEOWNERS`     | Daily npm and uv with `cooldown` 4–5 days, `open-pull-requests-limit: 8`, family groups, `ignore` entries each with a reason, labels; weekly github-actions |

**Count:** 2 of 4 run Dependabot and 0 of 4 keep repository settings (ruleset, merge methods, Actions policy, secret scanning) in the repository: `grep -rliE "ruleset|branch protection|push protection|secret scanning" research_repos/{evidence,framework,mosaic,streamlit}/.github` prints nothing. Dependabot is conventional and worth building. Settings are applied in the GitHub UI and written down in `CONTRIBUTING.md` and an ADR; nothing here reads or checks them.

## Implementation inventory

### Dependabot configuration

| Concern                    | Files                                                                                                                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ecosystems and directories | `research_repos/mosaic/.github/dependabot.yml` (one block per ecosystem), `research_repos/streamlit/.github/dependabot.yml` (github-actions block at the end)                                                                                       |
| Cooldown                   | `research_repos/streamlit/.github/dependabot.yml` (`cooldown.default-days`); the owner repo `claude-acc-manager:.github/dependabot.yml` (7 days, with the reason: "a freshly published version is the window in which most compromises are caught") |
| Grouping                   | `research_repos/mosaic/.github/dependabot.yml` (`dependency-type` groups), `research_repos/streamlit/.github/dependabot.yml` (name-pattern groups, then a catch-all `update-types: [minor, patch]` group)                                           |
| Limiting noise             | `research_repos/streamlit/.github/dependabot.yml` (`open-pull-requests-limit`, `ignore` with reasons)                                                                                                                                               |
| Commit message and labels  | `research_repos/streamlit/.github/dependabot.yml` (`labels`); none of the 4 sets `commit-message`                                                                                                                                                   |
| What audits the file       | zizmor `dependabot-cooldown` and `dependabot-execution` (https://docs.zizmor.sh/audits/); our job `zizmor` in `.github/workflows/security.yml` runs `--persona pedantic` over `.github/`                                                            |
| Our titles' rules          | `commitlint.config.js` (type-enum, `scope-case`, `subject-case`, `header-max-length` 100), `.github/workflows/conventional-commits.yml` (jobs `commit-messages` and `pull-request-title`)                                                           |

### Repository settings

| Concern                                      | Files                                                                                                                                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Required-check names                         | `.github/workflows/ci.yml`, `.github/workflows/conventional-commits.yml`, `.github/workflows/security.yml`, `.github/workflows/scorecard.yml` (every job `name:`; each file's header says a ruleset binds them)                                      |
| Code owners                                  | `.github/CODEOWNERS`, `research_repos/mosaic/.github/CODEOWNERS`, `research_repos/streamlit/.github/CODEOWNERS`                                                                                                                                      |
| Policy already decided                       | `maintainer/research/release-and-security.md` sections "Decisions the slices must carry out" (squash only, Actions pinning) and "Owner-only acts"                                                                                                    |
| GitHub's description of each setting         | https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference (Dependabot options); `gh api repos/dmenezesgabriel/bi-as-code` (merge settings), `…/actions/permissions`, `…/actions/permissions/workflow` |
| Reference repos with a settings-as-code file | none (the grep above)                                                                                                                                                                                                                                |

## Trade-offs and what we adopt

| Axis                 | Options seen (repo → approach)                                                                                               | Trade-off                                                                              | Our choice, and why                                                                                                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cadence and cooldown | streamlit → daily, 4–5 days; mosaic → monthly, none; owner repos → weekly, 7 days                                            | Daily is noisy; no cooldown installs a version minutes after publication               | Weekly, `cooldown.default-days: 7`: zizmor's `dependabot-cooldown` default minimum, matches both owner repos. Security updates are never delayed (docs, 2026-11-08)                                                                                                                                                      |
| PR and commit title  | none sets `commit-message`; Dependabot detects the repository's style when unset                                             | Detection is unspecified; our server check fails a non-conventional title              | Explicit `commit-message`: `prefix: ci` for github-actions, `prefix: build` for npm and docker, `include: scope` so titles read `build(deps): bump …` and `build(deps-dev): …`                                                                                                                                           |
| Header length        | `commitlint.config.js` caps the header at 100 characters; Dependabot appends ` in /dir` for a non-root directory             | A long scoped package name overflows 100 and the PR fails its own title check          | T1 measures the worst title commitlint accepts and the worst real one; groups keep titles short (`bump the npm-minor-patch group with N updates`)                                                                                                                                                                        |
| Grouping             | mosaic → by dependency type; streamlit → by family plus a minor/patch catch-all                                              | Many ungrouped PRs hit the limit of 5; one giant group hides a breaking bump           | One `minor`+`patch` group per ecosystem; majors stay one PR each                                                                                                                                                                                                                                                         |
| npm directory        | all references point Dependabot at the manifest directory; none has a pnpm workspace                                         | The docs are silent on pnpm workspaces (`src/web` is a workspace package)              | **Open**: start with `directory: /`; T3 measures whether `src/web` dependencies appear; fallback `directories: ["/", "/src/web"]`                                                                                                                                                                                        |
| Docker digest pin    | none of the references pins a base image by digest                                                                           | The docs are silent on `tag@sha256:` updates                                           | **Open**: T3 measures; if the digest is not bumped it stays a manual bump and `dependabot.yml` says so in a comment                                                                                                                                                                                                      |
| Required approvals   | `claude-acc-manager` ruleset requires checks only, no review                                                                 | A solo owner cannot approve their own PR; `CODEOWNERS` review would block every merge  | 0 required approvals; `.github/CODEOWNERS` stays advisory                                                                                                                                                                                                                                                                |
| Actions policy       | owner repos → `allowed_actions: all`, `sha_pinning_required: false`                                                          | `selected` blocks an action the day someone adds an unpinned or unlisted one           | `sha_pinning_required: true` and `allowed_actions: selected` limited to `actions/*`, `github/*`, `ossf/*`, the only owners in `grep -rn "uses:" .github`                                                                                                                                                                 |
| Merge methods        | `maintainer/research/release-and-security.md` decided squash only; `squash_merge_commit_title` is `COMMIT_OR_PR_TITLE` today | With that value a one-commit PR lands under its commit title, not the checked PR title | Squash only, `squash_merge_commit_title: PR_TITLE`, `squash_merge_commit_message: PR_BODY`, `delete_branch_on_merge: true`, `allow_auto_merge: true`                                                                                                                                                                     |
| Required checks      | ruleset binds job `name:`s; a job skipped by `if:` on the event never reports                                                | A required check that does not run on a PR blocks every merge                          | Require `gate`, `e2e-browser (1/4)`…`(4/4)`, `storybook`, `commit-messages`, `pull-request-title`, `gitleaks`, `osv-scanner`, `pnpm-signatures`, `actionlint`, `zizmor`, `opengrep`; leave out `grype` (not on `pull_request`); add the public-only `codeql (…)`, `dependency-review` after T3 measures that they report |

## Gap analysis — what we already have vs the references

| Concern                                                           | Ours today (file)                                                                                                           | Best reference (file)                                  | Gap                                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Dependency update PRs                                             | none: `git ls-files '.github/*'` lists no `dependabot.yml`                                                                  | `research_repos/streamlit/.github/dependabot.yml`      | Absent                                                                                                                 |
| Titles that pass our own check                                    | `commitlint.config.js`, `.github/workflows/conventional-commits.yml`                                                        | none (no reference sets `commit-message`)              | Partial: the check exists, nothing makes Dependabot satisfy it                                                         |
| Audit of the Dependabot file                                      | job `zizmor` in `.github/workflows/security.yml` scans `.github/`                                                           | https://docs.zizmor.sh/audits/                         | Complete once the file exists: `dependabot-cooldown` and `dependabot-execution` run unchanged                          |
| Ruleset on `master`                                               | none; `gh api repos/dmenezesgabriel/bi-as-code/rulesets` answers 403 "Upgrade to GitHub Pro or make this repository public" | the owner's UI-applied ruleset on `claude-acc-manager` | Absent, and unreachable on this plan until the repository is public; the owner applies it in the UI from the checklist |
| Merge methods                                                     | squash, merge commit and rebase allowed; auto-merge off; delete-branch off; title `COMMIT_OR_PR_TITLE`                      | none                                                   | Partial: SL-063's decision (squash only) is not applied                                                                |
| Actions policy                                                    | `allowed_actions: all`, `sha_pinning_required: false`, token `read`, `can_approve_pull_request_reviews: false`              | none                                                   | Partial: token scope already right; pinning and the allow-list are not enforced although every `uses:` is SHA-pinned   |
| Secret scanning, push protection, private vulnerability reporting | `security_and_analysis` is null; `…/private-vulnerability-reporting` answers 404                                            | none                                                   | Absent, and unreachable on the free private plan                                                                       |
| A record of the policy                                            | `maintainer/research/release-and-security.md` (Owner-only acts), deleted when Phase 9 closes                                | none                                                   | Absent in a durable place                                                                                              |

All eight rows were measured on 2026-11-08 with the `gh api … --jq` GETs named above. Nothing in the ledger claims `shipped` for any of it.

## Deviations

- Dependabot opens PRs but nothing merges them automatically; auto-merge on the Dependabot PRs is a later decision, after the first run shows how noisy it is.
- No `ignore` entries and no labels yet: streamlit's `ignore` list records version caps found over time, and this repository has none to record.

## Open decisions

- Does the npm updater read `src/web/package.json` through the root lockfile of a pnpm workspace? The docs (https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories) list pnpm v7–v12 under `npm` and say nothing about workspaces. Measured in T3 from the first run's PRs.
- Does the docker updater bump `FROM node:24-slim@sha256:…`? The docs say nothing about digest pins. Measured in T3.
- Are `codeql (…)` and `dependency-review` reporting names a ruleset can require? Their `if:` keeps them from running while the repository is private. Measured in T3.

## Surface

| Layer  | Files                                                                               |
| ------ | ----------------------------------------------------------------------------------- |
| engine | none                                                                                |
| client | none                                                                                |
| ui     | none                                                                                |
| config | `.github/dependabot.yml` (T1), `maintainer/adr/0035-…md` and `CONTRIBUTING.md` (T2) |

## Tasks

- [x] T1 — `.github/dependabot.yml`: github-actions, npm and docker, weekly, `cooldown.default-days: 7`, explicit `commit-message`, one minor/patch group per ecosystem. RED first: a test parses the file with `yaml` and asserts each ecosystem's cooldown, schedule and prefix, then pipes the worst-case title each prefix can produce through `pnpm exec commitlint` and expects exit 0. Validate the file against the SchemaStore `dependabot-2.0` schema once, by hand, and say so in the commit body.
- [x] T2 — Durable record: an ADR for the policy values (squash only with the PR title as the commit, SHA pinning required, `selected` actions, 0 approvals, the required-check list) and a settings checklist in `CONTRIBUTING.md` with the owner's GitHub UI click path. Docs only. Backlog row edited in place.
- [ ] T3 — Waits for the public flip, like SL-062 T2: the owner merges to `master`, the first Dependabot run answers the three open decisions, the owner applies the checklist in the UI. Then GAP-091 is marked closed in `maintainer/research/release-and-security.md` and this file is deleted.

## Out of scope

- Release PRs and publishing: SL-068.
- The npm package shape and the tarball: SL-067.
- Making the repository public and creating the GitHub App: owner acts listed in `maintainer/research/release-and-security.md`.
