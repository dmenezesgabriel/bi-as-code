# SL-016 — build my pages into a static site and serve it locally

Milestone: Phase 1 · State: open · Depends on: SL-003 · Closes: —

## Outcome

A user runs `biac build` in a project directory and gets a self-contained static site in `<project>/build/` (SPA shell, compiled page chunks, duckdb-wasm assets, a copy of `data/`). `biac preview` serves that folder so every page, deep link and query works exactly as in `biac dev`, with no dev server and no backend.

## Demo

1. Cold start: `pnpm build:cli && bin/biac build`. It exits 0 and prints the output dir. `ls build/ build/data/` shows `index.html`, `assets/`, and `data/{channels.csv,flights.parquet,orders.csv,orders.parquet}`.
2. `bin/biac preview`, then open the printed URL plus `/weekly-review`. The charts, tables and Region dropdown render from `/data/…` served out of `build/`.
3. Click a Regional split bar. The other widgets re-query (cross-filter works off the static copy).
4. Reload `/crossfilter-scale` directly in the address bar. It renders (SPA fallback), and the Distance slider re-queries the 200k-row parquet (ranged reads served from `build/data/`).
5. Open `/nope`. The not-found page renders inside the app shell, with no blank screen.
6. Stop `biac preview` and run `bin/biac preview` in a directory with no `build/`. It exits 1, naming the missing path and telling the user to run `biac build` first.

## Who else implements this

| Repo      | Has it                                 | Entry points                                                                                                                                               | Approach in one line                                                                                                                                                                                |
| --------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | PARTIAL                                | `research_repos/evidence/cli/cli/index.ts` (`case 'serve'`), `research_repos/evidence/cli/cli/server.ts` (`handleStaticRequest`, `respondWithFile`)        | This checkout has no static export. `serve` is a long-lived Bun server: prerendered `.html` per route, immutable caching under `/<appDir>/immutable/`, and a `connection.yaml` connector required   |
| framework | FULL (build) · ABSENT (static preview) | `research_repos/framework/src/build.ts` (`build`, `FileBuildEffects`), `research_repos/framework/src/bin/observable.ts` (`case "build"`, `case "preview"`) | `observable build` writes one `<path>.html` per page and copies only referenced files, content-hashed under `/_file/`. `observable preview` is the live-reload dev server, not a server for `dist/` |
| mosaic    | ABSENT                                 | `research_repos/mosaic/packages/` (`mosaic/`, `server/`, `vgplot/`, `examples/`)                                                                           | A library plus data servers. Nothing builds a site                                                                                                                                                  |
| streamlit | ABSENT                                 | `research_repos/streamlit/lib/streamlit/web/cli.py`                                                                                                        | Server-only Python runtime. Apps cannot be exported statically                                                                                                                                      |

**Count:** 1 of 4 has a static build (framework), and none has a server that previews a built folder. The build is still in scope: `docs/architecture.md` commits to "no runtime backend" ([ADR-0005](../adr/0005-queries-run-client-side-in-duckdb-wasm.md)), so a static folder is our only deploy unit, and the CLI already advertises `build`/`preview` in `src/cli/main.ts` `USAGE`. `preview` is a thin convenience over vite's own preview server, not an invention.

## Implementation inventory

### framework

| Concern               | Files                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI entry             | `research_repos/framework/src/bin/observable.ts` (`case "build"` → `build.build({config})`. `case "preview"` options: `--host`, `--port`, `--open`, `--cors`) |
| Output prep / safety  | `research_repos/framework/src/build.ts` `FileBuildEffects.prepare` (L498): only `rm`s an outputRoot inside `process.cwd()`, otherwise it warns and refuses    |
| Pipeline / execution  | `research_repos/framework/src/build.ts` `build()` (L53): loads every page, accumulates files/imports/stylesheets, then copies, hashes and renders             |
| Data file copy        | `research_repos/framework/src/build.ts` "Copy over referenced files" loop: content hash, `/_file/<path>.<hash>.<ext>` alias, resolver rewrite                 |
| Per-page HTML         | `research_repos/framework/src/build.ts` "Render pages!" loop: `effects.writeFile(\`${path}.html\`, html)`                                                     |
| duckdb-wasm assets    | `research_repos/framework/src/build.ts` `/_duckdb/` alias block. `research_repos/framework/src/duckdb.ts` `getDuckDBManifest`                                 |
| Not-found page        | `research_repos/framework/src/config.ts` (`404.md` excluded from the sidebar). `research_repos/framework/src/preview.ts` (GET 404 → render `/404` page)       |
| Edge cases it handles | drafts skipped (`page.data.draft`), missing referenced file → `enoent`, unknown specifiers fall back unhashed                                                 |

### evidence

| Concern         | Files                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI entry       | `research_repos/evidence/cli/cli/index.ts` `case 'serve'`: preflight (`connection.yaml`), `EVIDENCE_SERVE=1`, `startServer`                     |
| Static serving  | `research_repos/evidence/cli/cli/server.ts` `handleStaticRequest`: prerendered routes → `<route>.html`, then assets, then SvelteKit fallthrough |
| Caching headers | same function: `max-age=0, must-revalidate` by default, `public, max-age=31536000, immutable` for hashed app assets                             |
| Compression     | `research_repos/evidence/cli/cli/server.ts` `respondWithFile`: serves embedded gzip, or decompresses for clients without gzip                   |
| Host binding    | `research_repos/evidence/cli/cli/server.ts` `ServerOptions.host`: serve mode binds `127.0.0.1` by default                                       |

**Where they disagree:** framework emits one HTML document per page (a multi-page site), while evidence prerenders routes but still runs a server. Neither shape fits ours. We are a client-routed SPA (TanStack router, lazy page chunks), so the decision below is to keep one `index.html` and rely on an SPA fallback in the server.

## Trade-offs and what we adopt

| Axis                  | Options seen (repo → approach)                                                                          | Trade-off                                                                                                                          | Our choice, and why                                                                                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page output shape     | framework → `<page>.html` per page. evidence → prerendered `.html` plus a server                        | Per-page HTML works on any dumb host but needs SSR/prerender, which we don't have. A SPA needs a host-side fallback for deep links | One `index.html` plus the code-split page chunks that `vite build` already emits from the `virtual:biac-pages` manifest. Deep links rely on the server's SPA fallback                                                                                                                                    |
| Data files            | framework → only referenced files, content-hashed, URLs rewritten                                       | Hashing gives immutable caching but forces a URL rewrite of every `sql:` source                                                    | Copy all of `data/` to `build/data/` unhashed. `src/web/src/features/data/register-source.ts` builds the URL as `"/" + source`, and `src/engine/serve-data-dir.ts` already documents the identical-URL promise, so page SQL never changes between modes                                                  |
| Output directory      | framework → `dist/`. evidence (historic) → `build/`                                                     | The example project's root is the repo root, where `dist/` holds `dist/cli` (the binary `bin/biac` runs) and `dist/web`            | `<project>/build/`, emptied on each build (user decision). `.gitignore` gains `build/`. No `--out` flag yet                                                                                                                                                                                              |
| Preview server        | framework → none for `dist/`. evidence → a custom Bun static server                                     | A custom server duplicates range, MIME and fallback logic                                                                          | vite's `preview()` with the same `src/web/vite.config.ts` and `build.outDir` pointed at `<project>/build`. Vite 8.2.2 serves `distDir` through sirv and installs `htmlFallbackMiddleware(distDir, true)` for `appType: "spa"` (`node_modules/vite/dist/node/chunks/node.js` ~L35862, checked 2026-10-10) |
| Byte ranges (parquet) | evidence → none needed (server-side queries). Ours → duckdb-wasm reads parquet footers with ranged GETs | Without `206` support, parquet sources fail in preview                                                                             | sirv advertises ranges. **T3 must prove it**: `Range: bytes=0-3` on `/data/flights.parquet` → `206` with `Content-Range`. If it fails, mount `serveDataDir` from `src/engine/serve-data-dir.ts` at `/data` via `configurePreviewServer` instead                                                          |
| Unknown routes        | framework → render a `404.md` page                                                                      | —                                                                                                                                  | The SPA fallback returns `index.html`. The router renders `src/web/src/features/pages/not-found-page.tsx`, exactly as in dev                                                                                                                                                                             |

## Gap analysis — what we already have vs the references

| Concern                      | Ours today (file)                                                                                                         | Best reference (file)                                        | Gap                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| CLI dispatch                 | `src/cli/main.ts`: `build`/`preview` print "not implemented yet" and exit 1                                               | `research_repos/framework/src/bin/observable.ts`             | absent                                                              |
| Arg parsing                  | `src/cli/commands/dev.ts` `parseDevArgs` (project dir positional, `--port`)                                               | `research_repos/framework/src/bin/observable.ts` `helpArgs`  | partial: reusable for build (dir) and preview (dir + port)          |
| Web config lookup            | `src/cli/commands/dev.ts` `WEB_CONFIG` (path literal, not an import, so dep-cruise allows it)                             | —                                                            | present. Must be shared with build/preview, not copied (jscpd)      |
| Page compilation under build | `src/engine/pages-plugin.ts` `resolveId`/`load`/`transform` are build-capable. `configureServer`/`hotUpdate` are dev-only | `research_repos/framework/src/build.ts` `build()`            | present but unreachable: never run under `vite build`               |
| Theme script in `index.html` | `src/engine/pages-plugin.ts` `transformIndexHtml` (`globalThis.__BIAC_THEME__`)                                           | —                                                            | present, unverified in built output                                 |
| Data copy                    | none. `src/engine/serve-data-dir.ts` serves dev only                                                                      | `research_repos/framework/src/build.ts` referenced-file loop | absent                                                              |
| Static server                | none                                                                                                                      | `research_repos/evidence/cli/cli/server.ts`                  | absent                                                              |
| Bare `pnpm build`            | `src/web/vite.config.ts` `emptyProjectFallback` → `dist/web` (empty manifest)                                             | —                                                            | complete for its purpose (CI bundle check). Untouched by this slice |
| Ignore rules                 | `.gitignore` has `dist/`, no `build/`                                                                                     | —                                                            | absent                                                              |

**Verdict:** the slice is absent end to end. The page pipeline it needs exists but has never run under `vite build`. No ledger row claims `shipped` for any part.

## Deviations

- No per-page HTML: we stay a SPA, and static hosts need an SPA rewrite (`/* → /index.html`). The `biac build` output line says so. If this outlives the slice, it becomes an ADR on the static output shape.
- No content hashing of `data/`: URLs stay identical to dev (stated in a code comment at the copy site).

## Open decisions

- Whether `preview` binds `localhost` only (vite default) or exposes `--host`. Default: vite's behaviour, no flag until asked.

## Surface

| Layer  | Files                                                                                                                                                                                                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | `src/engine/pages-plugin.ts` (`writeBundle` copies `data/`)                                                                                                                                                                                                     |
| cli    | `src/cli/main.ts`, `src/cli/commands/build.ts` (new), `src/cli/commands/preview.ts` (new), shared `WEB_CONFIG` + project/port arg parsing extracted out of `src/cli/commands/dev.ts`                                                                            |
| ui     | none changed. `src/web/src/features/pages/not-found-page.tsx` and `src/web/src/features/data/register-source.ts` are exercised as-is                                                                                                                            |
| tests  | `src/cli/commands/*.unit.test.ts`, `test/integration/static-build.integration.test.ts` (new, helpers `test/lib/temp-project.ts`), `test/e2e/static-build.e2e.test.ts` (new, `test/lib/dev-server.ts` `buildCli`), `test/e2e-browser/static-build.spec.ts` (new) |

## Tasks

- [ ] T1 — `biac build`: `src/cli/commands/build.ts` runs vite `build()` with `WEB_CONFIG` + `pagesPlugin(root)` and `build.outDir: <root>/build`, `emptyOutDir: true`. Move `WEB_CONFIG` and the project-dir parsing out of `dev.ts` into a shared module. Wire `main.ts`. Add `build/` to `.gitignore`. Tests: unit (args, vite fake as in `src/cli/commands/dev.unit.test.ts`), integration (temp project → `build/index.html` contains `__BIAC_THEME__`, and a page chunk exists in `build/assets/`), e2e (`bin/biac build <tmp>` exits 0). playwright-cli: none (no served screen yet). Record the build time and `du -sh build/`.
- [ ] T2 — copy `data/` → `build/data/` in a `writeBundle` hook on `pagesPlugin`, beside the dev `/data` mount. A missing `data/` is a no-op. Tests: integration (nested files copied byte-identical, no `data/` → no error).
- [ ] T3 — `biac preview`: `src/cli/commands/preview.ts` runs vite `preview()` with the same outDir, `--port` parsing reused, and SIGINT/SIGTERM shutdown as in `dev`. A missing `build/` throws, naming the path and "run `biac build` first". Tests: unit, plus e2e over HTTP (`/weekly-review` → 200 `text/html` with `id="root"`, `/data/flights.parquet` with `Range: bytes=0-3` → 206, `/nope` → `index.html`). playwright-cli: `/weekly-review`, a reload of `/crossfilter-scale`, `/nope`. Screenshot each, and keep `console` clean.
- [ ] T4 — browser e2e `test/e2e-browser/static-build.spec.ts`: build and preview the shipped project. `/weekly-review` charts render, a Regional split bar click re-queries the other widgets, a deep-link reload renders, `/nope` shows not-found, and the console stays clean. Measure cross-filter re-query latency in preview vs dev. Update `docs/architecture.md` if its `dist/` wording is stale.

## Out of scope

- `--out` and `base` (sub-path deploys): later, when a deploy target needs them.
- Content-hashed data files, per-page HTML/SSR/prerender: not needed for a SPA. Revisit with deploy targets.
- Deploy commands and data loaders: the **Data loaders** later phase in `docs/backlog.md`.
