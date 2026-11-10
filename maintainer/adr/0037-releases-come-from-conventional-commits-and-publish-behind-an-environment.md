# ADR-0037 — Releases come from conventional commits and publish to npm behind a reviewer-gated environment

Status: accepted
Date: 2026-11-10
Relates to: [ADR-0035](0035-the-repository-settings-are-written-down-and-applied-in-the-ui.md)

## Context

`biac` is installable from npm (`package.json` has `name: biac`, `bin`, `files` and a `prepack` that builds `dist/cli`), and every commit and pull-request title on `master` is already a conventional commit (`commitlint.config.js`, `.github/workflows/conventional-commits.yml`). Nothing yet turns that history into a version, a changelog, a tag or a published tarball, so a release would be a manual `npm publish` from a laptop with a long-lived token and no provenance.

The facts that bind the design, fetched on 2026-11-10:

- Trusted publishing exchanges the job's OIDC token for a short-lived publish credential; it needs npm CLI 11.5.1 or later and Node 22.14.0 or later, generates provenance by default from GitHub Actions, and requires a public source repository and a public package ([npm docs](https://docs.npmjs.com/trusted-publishers)). A new trusted-publisher configuration expires if its first publish does not happen within 2 days. Node 24, the version in `.nvmrc`, bundles npm 11.16.0.
- npm binds a trusted publisher to one workflow file name and, optionally, one environment name (`npm trust github --file release.yml --environment npm`), and the package must already exist on the registry ([npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust)).
- `release-please-action`'s `token` input defaults to `GITHUB_TOKEN`, and a pull request or tag created with it starts no workflow run, so the release PR would never receive its required checks and could never merge ([README](https://github.com/googleapis/release-please-action)). The job needs `contents`, `issues` and `pull-requests` write, and the outputs `release_created` and `tag_name` gate a later publish.
- release-please's manifest mode reads `release-please-config.json` and `.release-please-manifest.json`, and takes the latest release from the manifest version when no release exists ([manifest releaser](https://raw.githubusercontent.com/googleapis/release-please/main/docs/manifest-releaser.md)).
- The Actions policy in ADR-0035 allows `actions/*`, `github/*` and `ossf/*` and requires every `uses:` to be pinned to a full commit SHA. `googleapis/release-please-action` is outside that list. GitHub documents `OWNER/REPOSITORY@*` as a valid allow-list entry and treats the SHA-pinning requirement as a separate setting ([Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)).
- The generated `CHANGELOG.md` uses `*` bullets and doubled blank lines, which `pnpm format:check` rejects.

## Decision drivers

- No registry credential is stored anywhere, and a published tarball carries a verifiable provenance attestation.
- A human approves every publish; nothing reaches the registry because a workflow ran.
- The version is derived from the commit history the repository already enforces, not typed by a person.
- The release pull request passes the same required checks as any other.
- One workflow, so the npm trust binding names one file.

## Options considered

| Axis                     | Option                                                                 | Pro                                                                      | Con                                                                      |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Version source           | A version typed into a `workflow_dispatch` input                       | Simple                                                                   | The version drifts from the history it names                             |
| Version source           | A release pull request derived from conventional commits               | The history is the single source; the changelog is a by-product          | One more pull request to merge                                           |
| Release tool             | release-please, manifest mode, `release-type: node`                    | Reads `package.json` natively, works with a protected `master`           | An action outside the allow-list                                         |
| Release tool             | semantic-release with a git plugin                                     | Fully automatic                                                          | Pushes to `master`, so it needs a ruleset bypass                         |
| Release tool             | changesets                                                             | Explicit intent per change                                               | A file per pull request, duplicating the commit title                    |
| Token for the release PR | `GITHUB_TOKEN`                                                         | Nothing to create                                                        | The release PR gets no required checks and can never merge               |
| Token for the release PR | A personal access token                                                | What the README documents                                                | Tied to a person, long-lived                                             |
| Token for the release PR | A GitHub App installation token from `actions/create-github-app-token` | Scoped per run, owned by the repository, the action is in the allow-list | The owner creates the App and stores two secrets                         |
| Layout                   | One workflow file, jobs `release-please` then `publish`                | One file for npm to trust; `needs` carries the tag                       | A single file holds two privilege levels, so permissions are set per job |
| Layout                   | A tag-push chain of three workflows                                    | Each step is small                                                       | npm trusts one file, and each hop needs its own App token                |
| Publish credential       | `NPM_TOKEN` secret                                                     | Works before trust is configured                                         | A stored credential, no provenance without extra setup                   |
| Publish credential       | OIDC trusted publishing                                                | No stored credential, provenance by default                              | The package must exist first and the repository must be public           |
| Publish gate             | Environment `npm` with a required reviewer                             | One click is the human decision; the trust binds to it                   | One approval per release                                                 |
| Publish gate             | No environment                                                         | Fully automatic                                                          | Merging the release PR publishes with no second look                     |
| Merging the release PR   | Auto-merge                                                             | No manual step                                                           | Skips the review that precedes the environment approval                  |
| Merging the release PR   | Manual merge                                                           | A deliberate act before the approval; no extra code                      | One more click                                                           |

## Decision

A merged `fix:` or `feat:` produces one release pull request, merging it tags and creates the GitHub Release, and a reviewer's approval of the `npm` environment publishes `biac` with provenance, all from `.github/workflows/release.yml`.

- **Version**: release-please in manifest mode (`release-please-config.json`: `release-type: node`, `include-component-in-tag: false`, `bump-minor-pre-major`; `.release-please-manifest.json`: `{".": "0.1.0"}`). Before `1.0.0` a `feat:` bumps the minor and a `fix:` the patch. `CHANGELOG.md` is generated and listed in `.prettierignore`.
- **Jobs**: `release-please` runs on every push to `master` in this repository only, and mints a GitHub App installation token narrowed to `contents`, `pull-requests` and `issues` write, so the release PR starts the required checks. `publish` runs only when `release_created` is `true`, checks out `tag_name`, builds through `prepack` and runs `npm publish` from the Node that `.github/actions/setup` installs.
- **Permissions**: the workflow's `permissions` is `{}`; `publish` alone gets `contents: read` and `id-token: write`. A run never cancels another (`concurrency` with `cancel-in-progress: false`).
- **Gate**: the `publish` job is bound to environment `npm` with a required reviewer, and npm's trusted publisher names `release.yml` and `npm`. The release PR is merged by hand.
- **Allow-list**: `googleapis/release-please-action@*` joins `actions/*, github/*, ossf/*`. SHA pinning stays required, and the workflow pins the action to a full commit SHA with a `# vX.Y.Z` comment.
- **Bootstrap**: npm accepts a trusted publisher only for an existing package, so the owner publishes `0.1.0` by hand once, runs `npm trust github biac --repository dmenezesgabriel/bi-as-code --file release.yml --environment npm --allow-publish` within 2 days, and then adds `bootstrap-sha` (that commit) to `release-please-config.json` so the first release PR is `0.1.1` after a `fix:`. Without it the history holds `feat:` commits and the first release PR would be `0.2.0`.

The owner's one-time steps (App, secrets, environment, npm trust, public repository) are the checklist in `CONTRIBUTING.md`.

## Consequences

- A release is two human acts, merging the release PR and approving the environment, and no registry credential exists to leak or rotate.
- The `release-please` job fails until the owner has created the App and stored `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`, and the first run fails until `googleapis/release-please-action@*` is in the Actions allow-list.
- Provenance needs a public repository, so the first publish happens after the repository is made public. `npm audit signatures` in an empty install is how a consumer verifies it.
- npm's trust binds to the file name `release.yml` and the environment name `npm`: renaming either breaks publishing until the trust is re-created, and a trust that sees no publish for 2 days expires.
- `@*` on one owner's action admits any version of it into the allow-list; the SHA-pinning setting, not the allow-list, is what holds the exact commit.
- The environment's reviewer can be the owner, so this is a deliberate pause, not a second-person review.
- A tempting simplification is `GITHUB_TOKEN` for the release PR; it leaves the PR with no checks, and the required-checks ruleset then blocks its merge forever.
