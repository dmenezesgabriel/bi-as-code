# ADR-0035 — The repository settings are written down and the owner applies them in the GitHub UI

Status: accepted
Date: 2026-11-08
Relates to: [ADR-0001](0001-record-architecture-decisions.md)

## Context

The pull-request checks (`.github/workflows/ci.yml`, `conventional-commits.yml`, `security.yml`) only gate a merge once a repository ruleset requires them, and the Actions policy and the merge methods decide what a merge commit looks like and which action may run. None of that lives in the repository's files, so without a record the policy exists only in the owner's memory.

The facts that bind the design, measured on 2026-11-08 with `gh api repos/dmenezesgabriel/bi-as-code`:

- `…/rulesets` answers 403 "Upgrade to GitHub Pro or make this repository public to enable this feature." A ruleset cannot be created or read while the repository is private on the free plan.
- `…/private-vulnerability-reporting` answers 404, and `security_and_analysis` is `null`. Secret scanning, push protection and private vulnerability reporting are unreachable on the same plan.
- The merge settings are `allow_squash_merge`, `allow_merge_commit` and `allow_rebase_merge` all true, `allow_auto_merge` false, `delete_branch_on_merge` false, `squash_merge_commit_title` `COMMIT_OR_PR_TITLE`. With that title value a one-commit pull request lands under its commit title, not under the pull-request title that the `pull-request-title` job checked.
- `…/actions/permissions` answers `allowed_actions: all`, `sha_pinning_required: false`; `…/actions/permissions/workflow` answers `default_workflow_permissions: read`, `can_approve_pull_request_reviews: false`.
- Every `uses:` under `.github/` is pinned to a full commit SHA, and the only owners are `actions`, `github` and `ossf`, plus the repository's own `./` composite actions (`grep -rhoE "uses: [^ ]+" .github`).
- A ruleset binds a check by the job's `name:`. A job skipped by an `if:` on the event never reports, so a required check that does not run on a pull request blocks every merge. `grype` runs on `master` and weekly only; `codeql (…)` and `dependency-review` run only while the repository is public.
- Dependabot's pull-request titles are set by `commit-message` in `.github/dependabot.yml` and must pass the same `commit-messages` and `pull-request-title` jobs as a human's.

## Decision drivers

- A merge that skips a check, or a commit on `master` that is not a conventional commit, must be impossible rather than discouraged.
- Nothing is added to the repository that nothing can run or check.
- A new contributor or a returning owner can reproduce the settings from one page.
- The solo owner can still merge their own pull request.

## Options considered

| Axis               | Option                                                                 | Pro                                              | Con                                                                                       |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Where it lives     | A checked-in settings file plus a script that applies or diffs it      | Drift is detectable                              | The API answers 403/404 today, so the script could not be run or tested; it is a new tool |
| Where it lives     | A written checklist in `CONTRIBUTING.md`, the values and why in an ADR | Costs nothing to run; readable by any maintainer | Nothing detects drift                                                                     |
| Merge methods      | Squash only                                                            | One commit per pull request, titled by the PR    | The branch's own commit history is dropped on merge                                       |
| Merge methods      | Squash, merge commit and rebase                                        | Flexible                                         | A merge commit or a rebased series reaches `master` unchecked by the title rule           |
| Squash title       | `PR_TITLE` with `PR_BODY`                                              | The checked title is the commit on `master`      | A merger can still edit it in the merge box                                               |
| Squash title       | `COMMIT_OR_PR_TITLE`                                                   | GitHub's default                                 | A one-commit pull request lands under a title no job checked                              |
| Approvals          | 0 required, `.github/CODEOWNERS` advisory                              | A solo owner can merge                           | No second pair of eyes is enforced                                                        |
| Approvals          | 1 required, code owners required                                       | Enforces review                                  | The owner cannot approve their own pull request, so every merge is blocked                |
| Actions allow-list | `all`, SHA pinning not required                                        | Nothing is ever blocked                          | An unpinned or unvetted third-party action can be added unnoticed                         |
| Actions allow-list | `selected` to `actions/*`, `github/*`, `ossf/*`, SHA pinning required  | The policy already holds for every `uses:`       | A new owner's action fails until the allow-list is edited in the UI                       |
| Required checks    | Every job                                                              | Nothing is skipped                               | `grype`, `codeql (…)` and `dependency-review` do not report on a private pull request     |
| Required checks    | The jobs that report on every pull request                             | No merge is blocked by a job that never runs     | The list is edited by hand when a job is renamed or added                                 |

## Decision

The owner applies the settings below in the GitHub UI once the repository is public, and `CONTRIBUTING.md` holds the click path for each.

- **Merge methods**: squash only. `squash_merge_commit_title` is `PR_TITLE` and `squash_merge_commit_message` is `PR_BODY`, so the pull-request title that `pull-request-title` checked is the commit on `master`. `allow_auto_merge` and `delete_branch_on_merge` are true.
- **Ruleset on `master`**: active, restrict deletions, block force pushes, require a pull request before merging with 0 approvals, and require these status checks: `gate`, `e2e-browser (1/4)`, `e2e-browser (2/4)`, `e2e-browser (3/4)`, `e2e-browser (4/4)`, `storybook`, `commit-messages`, `pull-request-title`, `gitleaks`, `osv-scanner`, `pnpm-signatures`, `actionlint`, `zizmor`, `opengrep`. `.github/CODEOWNERS` stays advisory.
- **Actions policy**: allow select actions, limited to actions created by GitHub plus the allow-list `actions/*, github/*, ossf/*`; require actions to be pinned to a full-length commit SHA; the default `GITHUB_TOKEN` stays read-only and cannot approve pull requests.
- **Security settings**: secret scanning, push protection and private vulnerability reporting on, as `SECURITY.md` promises.

`codeql (…)` and `dependency-review` join the required list only after they are seen reporting on a pull request in the public repository. `grype` and `scorecard` are never required: neither runs on a pull request.

The values are written down rather than coded because the settings API is not reachable on the plan the repository is on today, and a script nobody can run would be an invention (the sources the values rest on are GitHub's own descriptions of each setting, [rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) and the [repository REST fields](https://docs.github.com/en/rest/repos/repos#update-a-repository)).

## Consequences

- A pull request reaches `master` only through a squash that defaults to its checked title, with every listed job green.
- Adding an action from another owner fails every workflow that uses it until the allow-list in Settings → Actions → General names that owner.
- Renaming or adding a job in a workflow means editing the required-check list in the ruleset by hand; each workflow's header says a ruleset binds the job names. A renamed job that is still required blocks every merge until the list is edited.
- Nothing detects drift between this ADR and the live settings. That is the cost accepted; if the settings API becomes reachable and drift turns out to happen, a checker is a later decision with its own ADR.
- A merger can still edit the squash title in the merge box, and no job re-checks it afterwards: `conventional-commits.yml` runs on `pull_request` only. The default being `PR_TITLE` is what makes the checked title the usual one, not a guarantee.
- The repository's own `./.github/actions/*` composite actions need no allow-list entry: GitHub's Actions settings page says local actions are allowed under the select-actions policy.
- The 0-approval value is not a statement that review is unneeded: it exists because a solo owner cannot approve their own pull request.
