# ADR-0029 — The build copies its shell per route and honors an absolute base

Status: accepted
Date: 2026-10-24
Amends: [ADR-0008](0008-static-build-is-a-spa-folder.md)

## Context

ADR-0008 made `build/` one `index.html`, the page chunks and an unhashed copy of `data/`, and recorded the cost: a deep link or a reload on a non-root route works only when the host rewrites `/* -> /index.html`, and the output could not live under a path prefix because every asset and data URL was root-absolute. Both are host configuration a deployer may not control — S3 website endpoints, GitHub Pages and a plain file server have no rewrite rule — and a project site on GitHub Pages is served under `/<repo>/`.

The platform facts that bind the fix:

- vite emits asset URLs absolute under `base` and bakes `base` as `import.meta.env.BASE_URL` at build time (https://vite.dev/guide/build#public-base-path).
- TanStack Router takes a `basepath` — stripped when matching a route, prepended to every href it builds.
- S3 website endpoints serve an index document at every folder level — `photos` 302s to `photos/` when `photos/index.html` exists (https://docs.aws.amazon.com/AmazonS3/latest/userguide/IndexDocumentSupport.html) — and GitHub Pages serves a site's `404.html` for unmatched paths.
- Whatever serves `build/` must still answer `Range` with `206`: duckdb-wasm reads parquet with ranged GETs ([ADR-0008](0008-static-build-is-a-spa-folder.md)).

## Decision drivers

- A built report deploys to any static host with zero host-side configuration.
- One config key, set once per deploy, carries the prefix.
- No second render path: a shell copy is the same file the client already renders, not prerendered HTML, so ADR-0008's rejected per-page HTML stays rejected.

## Options considered

| Axis                 | Option                                                             | Pro                                                                              | Con                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Deep links           | Copy the emitted shell to `<route>/index.html` for every route     | Any index-document host answers every deep link; zero host config                | One more file per route; a route may not collide with a build-owned name                                                              |
| Deep links           | Keep requiring a host-side rewrite (`try_files`, SPA fallback)     | Nothing new to build                                                             | Broken on hosts with no rewrite config — exactly the hosts self-hosting targets                                                       |
| Deep links           | Real per-page HTML (prerender or SSR)                              | First paint carries content                                                      | A render path the app does not have — rejected in ADR-0008, still rejected                                                            |
| Path prefix          | Absolute `base` in `biac.config.ts`, passed to vite and the router | One key; vite emits correct asset URLs; `BASE_URL` reaches the client            | The prefix is baked at build — a build cannot move prefixes                                                                           |
| Path prefix          | Page-relative links (`./assets`, `./data`)                         | No config at all                                                                 | Breaks under a copy one level down: `/nested/x/` resolves `./assets` to `/nested/assets`                                              |
| Path prefix          | A `<base href>` element                                            | One declaration                                                                  | Exists to repair relative links; under an absolute base nothing is relative                                                           |
| Unknown routes       | Emit `build/404.html` as a shell copy                              | Pages' `404.html` and Garage's `--error-document` reach the SPA's not-found page | Ignored by hosts that consult no error document — one inert file                                                                      |
| Widget module data   | `new URL("../", import.meta.url)` as the module's data base        | Correct on any origin under any base — the module always emits beside `data/`    | Relies on the emit layout staying `<base>/widgets/` next to `<base>/data/`                                                            |
| Widget module data   | Bake the configured `base` into the library build                  | The SPA's own mechanism                                                          | The lib build sets `base: ""` so its asset URLs resolve against the publishing origin — `BASE_URL` bakes empty and the prefix is lost |
| Where `base` applies | `biac build` and `biac preview` only                               | Dev URLs stay unchanged; the prefix is deploy config                             | Dev diverges from a prefixed deploy — `biac preview` under the base is the parity check                                               |
| Where `base` applies | `biac dev` too                                                     | One code path                                                                    | Rewrites every dev URL — and every dev e2e — for no authoring gain                                                                    |

## Decision

The build copies the emitted shell, byte-identical, to `build/<route>/index.html` for every manifest route and to `build/404.html` (`copyShellToRoutes` in `src/engine/build-route-pages.ts`, called from the pages plugin's `writeBundle`). `assertRoutesBuildable` runs in `buildStart`, before anything is written, and fails the build naming a page whose first segment is a name the output owns — `assets`, `data`, `widgets`, `favicon.svg`, `index.html`, `404.html`.

`biac.config.ts` takes an optional `base` (must start with `/`; a trailing `/` is appended — `src/engine/biac-config.ts`). `biac build` passes it to vite as `base`, which emits asset URLs absolute beneath it and bakes it as `import.meta.env.BASE_URL`; the router receives it as `basepath` (`src/web/src/features/pages/page-router.tsx`), and data source URLs join against `location.origin + BASE_URL` (`src/web/src/features/data/register-source.ts`, `duckdb-live.ts`). An exported widget module resolves its data base as `new URL("../", import.meta.url)` (`src/web/src/features/widget-module/module-runtime.ts`) — it always emits at `<base>/widgets/` beside `<base>/data/`. `biac preview` serves `build/` under the same `base` and mounts its `/data` and `/widgets` middlewares beneath it (`src/cli/commands/preview.ts`). `biac dev` stays at `/`: the prefix exists only on a static host.

## Consequences

- `build/` deploys on hosts with no rewrite support — S3 website endpoints, GitHub Pages, Garage, a plain file server — because every route is an index document. This supersedes ADR-0008's consequence that a deep link needs a host-side fallback.
- `build/404.html` is the shell; a host that serves an error document reaches the SPA's not-found page, and one that does not ignores the file.
- Under a `base`, every URL the build emits or joins — assets, routes, data files, the widget module's — resolves beneath the prefix, so a build emitted for `/bi-as-code/` serves only there. This supersedes ADR-0008's "sub-path deploys are not supported yet". A relative `./` base stays rejected: it breaks under the copies one level down.
- `biac dev` does not honor `base` — dev URLs stay at `/`, and `biac preview` under the configured base is the parity check before deploy.
- Six first segments are reserved for the build output; a page may not route under them. The guard lives in the build only — dev already shadows `/data` and preview mounts `/widgets`, so dev stays unguarded.
- What ADR-0008 decided and this does not touch: `build/` is the output folder, `data/` ships unhashed, vite `preview()` serves the folder, and there is still no prerender path — each copy is the same file the client renders.
