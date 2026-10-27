# ADR-0008 — The static build is one SPA folder with an unhashed copy of `data/`, previewed by vite

Status: accepted — deep-link and sub-path consequences amended by [ADR-0029](0029-the-build-copies-its-shell-per-route-and-honors-an-absolute-base.md)
Date: 2026-10-10

## Context

There is no runtime backend: every query runs in the browser in duckdb-wasm ([ADR-0005](0005-queries-run-client-side-in-duckdb-wasm.md)), so a static folder is the only deploy unit. `biac build` has to emit that folder and `biac preview` has to serve it so a report can be checked before it is deployed.

The app is a single-page app: the router resolves page paths client-side from the compiled page manifest, and there is no server-side rendering or prerendering. Pages register tables from data files with `sql:` front-matter, and `src/web/src/features/data/register-source.ts` builds each file's URL as `"/" + source` — in dev, `src/engine/serve-data-dir.ts` mounts the project's `data/` at `/data/`. duckdb-wasm reads parquet with ranged `GET`s (footer first), so whatever serves the folder must answer `Range` requests with `206`.

## Decision drivers

- Page SQL must not change between `biac dev` and a deployed build.
- No server code to maintain beyond what vite already ships.
- The repo root is also the example project's root, and `dist/` there already holds `dist/cli` (the binary `bin/biac` runs) and `dist/web`.

## Options considered

| Axis              | Option                                                              | Pro                                                                  | Con                                                                                        |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Page output shape | One `<page>.html` per route                                         | Works on any host with no rewrite rule                               | Needs SSR or prerendering, which the app does not have                                     |
| Page output shape | One `index.html` plus the code-split page chunks `vite build` emits | No new rendering path; identical to dev                              | Deep links need a host-side fallback to `index.html`                                       |
| Data files        | Copy only referenced files, content-hashed                          | Immutable caching; smaller output                                    | Every `sql:` source URL must be rewritten at build time, so build SQL differs from dev SQL |
| Data files        | Copy all of `data/` to `build/data/` unhashed                       | `/data/<path>` is identical in dev and build                         | Unreferenced files ship too; data URLs cannot be cached as immutable                       |
| Output directory  | `<project>/dist/`                                                   | Common convention                                                    | Collides with `dist/cli` and `dist/web` at the repo root                                   |
| Output directory  | `<project>/build/`                                                  | No collision                                                         | —                                                                                          |
| Preview server    | A custom static server                                              | Full control                                                         | Re-implements MIME types, byte ranges and the SPA fallback                                 |
| Preview server    | vite's `preview()` over the build folder                            | sirv serves byte ranges; `appType: "spa"` falls back to `index.html` | Bound to vite's preview defaults (localhost only, no `--host` flag yet)                    |

## Decision

`biac build` (`src/cli/commands/build.ts`) runs vite `build()` with the web config and the pages plugin, writing to `<project>/build/` and emptying it first. The output is one `index.html`, the page chunks and the duckdb-wasm assets. It prints that static hosts need an SPA rewrite `/* -> /index.html`.

The pages plugin's `writeBundle` hook (`src/engine/pages-plugin.ts`, `copyDataDir`) copies the whole `data/` tree, unhashed, to `build/data/`. A project with no `data/` builds without error.

`biac preview` (`src/cli/commands/preview.ts`) runs vite `preview()` over the same folder. A missing `build/` exits 1, naming the path and telling the user to run `biac build` first.

## Consequences

- Deploying means uploading `build/` to any static host that supports an SPA rewrite; without it, a deep link or reload on a non-root route returns the host's 404.
- Data files are revalidated, not cached as immutable, and the whole `data/` directory ships whether a page references a file or not.
- Sub-path deploys (`base`) and a custom output directory (`--out`) are not supported yet; adding either changes the URL every `sql:` source resolves against.
- Per-page HTML and content-hashed data stay possible later; each needs its own decision (a prerender path, and a build-time rewrite of `sql:` sources).
