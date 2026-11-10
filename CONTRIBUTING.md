# Contributing

Thanks for looking at this. This file exists so review spends its time on your idea rather than on the same handful of mechanical things.

## Before you open a PR

You need Node.js 24.12 or a later 24.x release (`.nvmrc`), pnpm 10 (`packageManager` in `package.json`) and Git. Install and run the gate:

```sh
pnpm install   # also installs the git hooks through husky
pnpm gate
```

`pnpm gate` is the whole quality gate, fail-fast, cheapest step first; `scripts/gate.sh` lists the steps: typecheck, lint, lint:style, format:check, knip, dep:cruise, jscpd, then the unit, web-unit, integration and e2e tests, cucumber and the browser e2e tests. The commit hooks in `.husky/` run a lighter chain (commitlint, lint-staged, typecheck) on every commit.

The gate loads the host: run one at a time, and re-run a failure alone before calling it a regression.

## How changes land

- **Rules**: `AGENTS.md` holds the code style, comment, dependency and structure rules. Read it before the first change; it is short.
- **Strict TDD**: red → green → refactor, with the test and the implementation in the same commit. Bug fixes include a regression test that fails without the fix.
- **Conventional commits**: `type(scope): imperative subject`. `commitlint.config.js` enforces the type list, a lower-case scope, a header of at most 100 characters and a subject that is not sentence-case. The same title rule applies to a pull request title.
- **One logical change per commit.** Nothing lands red.
- **A UI component ships a colocated `<name>.stories.tsx`** with a story for every meaningful state ([ADR-0006](maintainer/adr/0006-component-stories-are-the-ui-validation-surface.md)).
- **Docs that mention what you changed**: the user documentation is the project in `docs/` (`bin/biac dev docs`). A page that still describes the old behavior is worse than none.
- **Decisions**: a change to the system's shape gets an ADR in `maintainer/adr/`, written from `maintainer/adr/0000-template.md`.

## Repository settings (owner)

The merge rules, the ruleset and the Actions policy live in GitHub, not in the repository. The owner applies them once, after the repository is public; the click paths below are for the UI. The values and the reasons are in [ADR-0035](maintainer/adr/0035-the-repository-settings-are-written-down-and-applied-in-the-ui.md).

**Settings → General → Pull Requests**

- Leave **Allow squash merging** ticked and untick the merge-commit and rebase-merge checkboxes above it.
- Set the squash default commit message to the pull request title and the pull request description.
- Tick **Allow auto-merge** and **Automatically delete head branches**.

**Settings → Rules → Rulesets → New ruleset → New branch ruleset**

- Enforcement status **Active**, target branch `master`.
- Restrict deletions and block force pushes stay on.
- Require a pull request before merging, with 0 approvals.
- Require status checks before merging: `gate`, `e2e-browser (1/4)`, `e2e-browser (2/4)`, `e2e-browser (3/4)`, `e2e-browser (4/4)`, `storybook`, `commit-messages`, `pull-request-title`, `gitleaks`, `osv-scanner`, `pnpm-signatures`, `actionlint`, `zizmor`, `opengrep`. Add `codeql (…)` and `dependency-review` only once a pull request has shown them reporting. A job renamed in a workflow is renamed here in the same change.

**Settings → Actions → General**

- Actions permissions: allow the owner's and select non-owner actions; tick **Allow actions created by GitHub**; in the allow-list enter `actions/*, github/*, ossf/*, googleapis/release-please-action@*` (the last one is the release workflow's, [ADR-0037](maintainer/adr/0037-releases-come-from-conventional-commits-and-publish-behind-an-environment.md)); tick **Require actions to be pinned to a full-length commit SHA**; save.
- Workflow permissions: the restricted, read-only option.

**Settings → Advanced Security**

- Enable **Secret Protection** and its **Push protection**, and **Private vulnerability reporting** ([SECURITY.md](SECURITY.md) tells reporters to use it).

## Releasing

A merged `fix:` or `feat:` opens a release pull request; merging it tags the release, and approving the `npm` environment publishes `@biac/cli` to npm with provenance. The design and the reasons are in [ADR-0037](maintainer/adr/0037-releases-come-from-conventional-commits-and-publish-behind-an-environment.md). The owner does these once, in this order:

- Create a GitHub App with **Contents**, **Issues** and **Pull requests** read and write (`release.yml` requests all three, and the token step fails if the installation lacks one), install it on this repository, and store its client id as the Actions secret `RELEASE_APP_ID` and its private key as `RELEASE_APP_PRIVATE_KEY`. Without them the `release-please` job fails.
- Settings → Environments → New environment `npm`, tick **Required reviewers** and add yourself.
- Create the npm organization `biac` on npmjs.com: it is the scope of `@biac/cli`, because npm refuses the unscoped name `biac` as too similar to existing packages.
- Turn on two-factor authentication for the npm account, then publish `@biac/cli@0.1.0` by hand (`npm publish` from a clean checkout of that commit): npm accepts a trusted publisher only for a package that exists.
- Within 2 days of creating it, run `npm trust github @biac/cli --repository dmenezesgabriel/bi-as-code --file release.yml --environment npm --allow-publish`. An unused trust expires after 2 days.
- Add `"bootstrap-sha": "<the 0.1.0 commit>"` to `release-please-config.json`, so the first release pull request is `0.1.1` after a `fix:` rather than `0.2.0`.
- Make the repository public before the first publish from Actions: provenance needs a public repository.

To release: merge a `fix:` or `feat:` pull request, merge the release pull request that appears, approve the `npm` environment in the Actions run, then check `npm view @biac/cli version` and, in an empty directory, `npm i @biac/cli && npm audit signatures`. Renaming `release.yml` or the `npm` environment breaks the trust until `npm trust` is run again.

## Picking up work

`maintainer/backlog.md` is the ledger of what is planned and what is next. For anything beyond a small fix, open an issue first so the approach is agreed before the code is written.

## Reporting bugs

Use the bug-report issue template; it asks for the commit, the Node version and the command output. Never paste credentials or private data into an issue. Security problems go through [SECURITY.md](SECURITY.md), not the tracker.
