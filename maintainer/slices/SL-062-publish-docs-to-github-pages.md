# SL-062 — A push to master publishes the docs site on GitHub Pages

Milestone: Phase 8 — Documentation site · State: open · Depends on: SL-056, SL-061 (both shipped) · Closes: GAP-067

> Delete this file when the slice ships.
>
> Every path below was checked with `test -e` on 2026-11-05. Line ranges are omitted on purpose.

## Outcome

A reader opens `https://dmenezesgabriel.github.io/bi-as-code/`, follows any link, reloads any page, and pastes any copied URL, and the biac docs answer — and a push to `master` is all it takes to update them.

## Demo

1. Owner prerequisite (not automatable): Settings → Pages → Build and deployment → Source = **GitHub Actions**, on a plan that allows Pages for this repo (it is PRIVATE today: `gh repo view dmenezesgabriel/bi-as-code --json visibility`; `gh api repos/dmenezesgabriel/bi-as-code/pages` answers 404 until Pages is on).
2. Push to `master` (or run the workflow by hand: Actions → Deploy docs → Run workflow). The run ends green and its `deploy` job prints the page URL.
3. Open `https://dmenezesgabriel.github.io/bi-as-code/` — the docs home renders at 1280 px and at 375 px, light and dark.
4. Click `Table` in the sidebar, then reload — still the Table page (Pages answers `/bi-as-code/components/table/` with that route's own `index.html`).
5. Paste `https://dmenezesgabriel.github.io/bi-as-code/components/table` (no trailing slash) — Pages 301s to the slash and the page renders.
6. Open `https://dmenezesgabriel.github.io/bi-as-code/no-such-page/` — the build's `404.html` answers and the SPA's `Page not found` heading shows.
7. Open a filtered URL such as `/bi-as-code/filters/dropdown/?island=Dream`, reload — the filter state persists.
8. DevTools Network on any page: 0 requests to a path outside `/bi-as-code/`; the two `assets/_virtual_biac-*.js` files answer 200; Console: 0 errors.

## Who else implements this

| Repo      | Has it | Entry points                                                                                                                            | Approach in one line                                                                                                                      |
| --------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | ABSENT | `research_repos/evidence/docs/docs.json`                                                                                                | Its docs are Mintlify-hosted; no workflow under `.github/` uses the Pages actions                                                         |
| framework | FULL   | `research_repos/framework/.github/workflows/deploy.yml`, `research_repos/framework/docs/deploying.md`                                   | One `deploy` job: install, build the product, build the docs with the product, upload `docs/.observablehq/dist`, `deploy-pages`           |
| mosaic    | FULL   | `research_repos/mosaic/.github/workflows/deploy.yml`, `research_repos/mosaic/docs/.vitepress/config.js` (`base: '/mosaic/'`)            | One `deploy` job: pnpm install, `pnpm run docs:build`, upload `docs/.vitepress/dist`, `deploy-pages`; `base` committed in the site config |
| streamlit | ABSENT | `research_repos/streamlit/.github/workflows/` (46 workflows, none uses `deploy-pages` or `upload-pages-artifact`; no `docs/` directory) | None for docs                                                                                                                             |

**Count:** 2 of 4 implement this, and both with the same shape (one job, official Pages actions). The 2 that do are the 2 whose docs are built by a tool in the same repo; biac's docs are exactly that. Not an invention.

## Implementation inventory

### framework

| Concern                  | Files                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Triggers                 | `research_repos/framework/.github/workflows/deploy.yml` (`workflow_dispatch`, `push` to `main`, daily `schedule` cron)                                             |
| Permissions, environment | same file (`pages: write`, `id-token: write`, `environment: github-pages` with `url: ${{ steps.deployment.outputs.page_url }}`)                                    |
| Install, cache           | same file (`actions/setup-node` with `cache: yarn`; `actions/cache` of `docs/.observablehq/cache` keyed on `hashFiles('docs/data/*')` and the date)                |
| Build, artifact, deploy  | same file (`yarn build`, `yarn docs:build`, `configure-pages`, `upload-pages-artifact` path, `deploy-pages`); `research_repos/framework/docs/deploying.md` (prose) |
| Base path                | none — framework's docs are published at the Pages root of an org site                                                                                             |

### mosaic

| Concern                | Files                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Triggers, permissions  | `research_repos/mosaic/.github/workflows/deploy.yml` (`workflow_dispatch`, `push` to `main`; workflow-level `permissions`)                         |
| Concurrency            | same file (`group: "pages"`, `cancel-in-progress: false`)                                                                                          |
| Fork guard             | same file (`if: github.repository == 'uwdata/mosaic'`)                                                                                             |
| Install, build, deploy | same file (`pnpm/action-setup`, `setup-node` with `cache: pnpm`, `pnpm install --frozen-lockfile`, `pnpm run docs:build`, the three Pages actions) |
| Base path              | `research_repos/mosaic/docs/.vitepress/config.js` (`base: '/mosaic/'`, committed in the site config)                                               |

### Where the two disagree — decisions this slice makes

| Axis               | framework                        | mosaic                           | Ours (decided)                                                                                                                                                                                                                           |
| ------------------ | -------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Triggers           | push + manual + daily cron       | push + manual                    | push to `master` + manual. No cron: the cron exists for framework's fresh loader data; ours (`docs/data/island-summary.csv.js`) reads committed CSVs                                                                                     |
| Cache              | `actions/cache` of loader output | none                             | `setup-node`'s pnpm store cache only; revisit if the measured run exceeds a few minutes                                                                                                                                                  |
| Concurrency        | none                             | `pages`, no cancel               | `pages`, `cancel-in-progress: false` — a half-finished deploy is never cancelled                                                                                                                                                         |
| Base path          | none (root site)                 | committed in site config         | committed in `docs/biac.config.ts` (owner, 2026-11-05)                                                                                                                                                                                   |
| Action pinning     | major tags (`@v6`, `@v4`, `@v5`) | major tags (`@v7`, `@v6`, `@v5`) | commit SHA with the tag in a trailing comment (AGENTS.md supply-chain rule). The two repos' majors differ, so neither is a source for versions: resolve each with `gh api repos/<owner>/<repo>/releases/latest` in the executing session |
| Gate before deploy | none                             | none                             | none: the gate stays local (AGENTS.md); CI gating is out of scope                                                                                                                                                                        |

## Standards and platform facts

| Fact                                                                                                                                                                                                                                 | Source                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A custom workflow packages the site with `upload-pages-artifact`, sets up with `configure-pages` and publishes with `deploy-pages`; Jekyll runs only when the workflow has an `actions/jekyll-build-pages` step, which ours will not | https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages (fetched 2026-11-05)                                     |
| "Published GitHub Pages sites may be no larger than 1 GB" — `docs/build` is 86 MB in 421 files                                                                                                                                       | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits (fetched 2026-11-05); `du -sh docs/build`; `find docs/build -type f \| wc -l` |
| `build/404.html` is the shell, so Pages' error document reaches the SPA's `Page not found` page; every route is `build/<route>/index.html`, so a deep link answers 200                                                               | `maintainer/adr/0029-the-build-copies-its-shell-per-route-and-honors-an-absolute-base.md`; `src/engine/build-route-pages.ts`                                         |

## Gap analysis

| Concern                                   | Ours today                                                                                                                                                                                             | Best reference                                                                  | Gap                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Publish workflow (GAP-067)                | none — `.github/` does not exist                                                                                                                                                                       | `framework/.github/workflows/deploy.yml`, `mosaic/.github/workflows/deploy.yml` | **absent**                                                                                           |
| Docs project's base                       | `docs/biac.config.ts` has no `base`; the mechanism is complete (`readBase` in `src/engine/biac-config.ts`, `viteBuild({ base })` in `src/cli/commands/build.ts`, `preview` and `serve` serve under it) | `mosaic/docs/.vitepress/config.js`                                              | **absent for `docs/`**, mechanism complete                                                           |
| Deep links and 404 on a rewrite-less host | proven on the example project: `test/e2e-browser/static-host.spec.ts` (default base, then `/bi-as-code/`) over `serveStaticDir` in `test/lib/static-server.ts`                                         | —                                                                               | **complete for the example project, unproven on `docs/`** (48 pages, 421 files, 86 MB): T1 closes it |
| Build in CI                               | `bin/biac` runs compiled `dist/` (`package.json` `build:cli`); `pnpm prepare` runs husky; Node 24 from `.nvmrc`; `packageManager` `pnpm@10.33.2`                                                       | `mosaic` (`pnpm/action-setup`, `cache: pnpm`)                                   | **unproven**: no clean-checkout build has ever run — T2 measures it                                  |

## Surface

| Layer  | Files                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| engine | none                                                                                                                                                         |
| client | none                                                                                                                                                         |
| ui     | none — an infrastructure slice; the stack it crosses is config → build → static host, closed by the live demo                                                |
| config | `docs/biac.config.ts` (`base`), `.github/workflows/deploy.yml` (new)                                                                                         |
| tests  | `test/integration/docs-project.integration.test.ts` (docs `base`), `test/e2e-browser/docs-static-host.spec.ts` (new; `copyDocsProject` and `serveStaticDir`) |

## Tasks

- [ ] T1 — The docs project carries its base: `docs/biac.config.ts` sets `base: "/bi-as-code"`; an integration test pins the resolved `/bi-as-code/`; a browser spec builds the real docs project under it and serves it on `serveStaticDir` — deep link, reload, slash-less redirect, `404.html`, every request under the prefix, console clean; `playwright-cli` over `biac preview docs`.
- [ ] T2 — `.github/workflows/deploy.yml` per the decisions above; verified by a clean checkout running `pnpm install --frozen-lockfile`, `pnpm build:cli`, `bin/biac build docs` under `nice`/`timeout`; then, once the owner has enabled Pages, a push and the Demo above. Closes GAP-067 in `maintainer/research/docs-site.md`, marks SL-062 `shipped` in `maintainer/backlog.md`, deletes this file.

## Out of scope

- A user-facing "Publish to GitHub Pages" how-to under `docs/pages/ship/` — a follow-up the owner decides.
- Running `pnpm gate` in CI, versioned docs (D7 in `maintainer/research/docs-site.md`), a custom domain, per-PR preview deploys.
