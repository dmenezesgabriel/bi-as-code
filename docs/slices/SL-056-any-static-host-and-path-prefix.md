# SL-056 — `biac build` output serves on any static host with no rewrite rule, and under a configured path prefix

Milestone: Phase 7 — Self-hosting and authentication · State: open · Depends on: R10 · Closes: GAP-060, GAP-061

## Outcome

`biac build`'s `build/` folder deploys to a static host that has no rewrite rules — every manifest route answers its own `index.html` — and, when `biac.config.ts` sets `base`, deploys under a path prefix with assets, routes, `data/` files and widget modules all reachable beneath it.

## Demo

1. Cold start: `pnpm build:cli && bin/biac build` in the repo root — the project's own `build/`.
2. Serve it with no rewrite rule: `python3 -m http.server 8901 --bind 127.0.0.1 --directory build`. Open `http://127.0.0.1:8901/` — the index page renders. Open `http://127.0.0.1:8901/weekly-review` and `http://127.0.0.1:8901/nested/allocation` — each serves `build/<route>/index.html` and renders the page (today: 404).
3. Interact under a deep link: select a filter — the cross-filter re-queries and repaints; sidebar navigation moves between pages with no reload; data requests go to `/data/…` and answer 200/206.
4. Prefix run: set `base: "/bi-as-code/"` in `biac.config.ts`, rebuild, and serve `build/` under that path — `mkdir -p hostcheck/bi-as-code && cp -r build/. hostcheck/bi-as-code/ && python3 -m http.server 8902 --bind 127.0.0.1 --directory hostcheck`. Open `http://127.0.0.1:8902/bi-as-code/` — renders; `…/bi-as-code/weekly-review` — renders; every asset request resolves under `/bi-as-code/…`; a parquet query issues ranged GETs to `/bi-as-code/data/flights.parquet` → 206.
5. A host page imports `http://127.0.0.1:8902/bi-as-code/widgets/revenue-by-region.js` — the module mounts and its data requests go to `/bi-as-code/data/…`, not `/data/…`.
6. Console: 0 errors in both runs. Reload the deep links — the same result (the copied shell is the only state).

## Baseline — measured 2026-10-24 on `13b23c9`

| What                     | Measured                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `build/` shape           | 1 HTML file (`find build -name '*.html' \| wc -l` → 1) + `assets/` + `data/` + `favicon.svg` + `widgets/`                                                          |
| `build/index.html` refs  | `src="/assets/index-…js"`, `href="/assets/index-…css"`, `href="/favicon.svg"` — root-absolute, so a prefix 404s them                                               |
| Rewrite-less probe (R10) | `python3 -m http.server 8931 --directory build`: `/` → 200, `/weekly-review` → 404, `/nested/allocation` → 404 (`docs/research/self-hosting.md` GAP-060)           |
| Prefix probe (R10)       | `build/` served at `/bi-as-code/`: shell → 200, `/assets/index-…js` → 404, blank page (`docs/research/self-hosting.md` GAP-061)                                    |
| Build's own advice       | `src/cli/commands/build.ts` prints `Static hosts need an SPA rewrite: /* -> /index.html`                                                                           |
| Router                   | `createRouter` with no `basepath` (`src/web/src/features/pages/page-router.tsx` `buildPageRouter`)                                                                 |
| Data URL                 | `new URL("/" + source, dataOrigin)` (`src/web/src/features/data/register-source.ts`) — `dataOrigin` defaults to `location.origin`, so `/data/…` escapes the prefix |
| Widget module data URL   | `new URL(import.meta.url).origin` (`src/web/src/features/widget-module/module-runtime.ts`) — the origin only, the prefix dropped                                   |
| Config                   | `biac.config.ts` is a closed schema with no `base` key (`src/engine/biac-config.ts` `CONFIG_KEYS`)                                                                 |
| Preview                  | `biac preview` mounts `/data` and `/widgets` middlewares at the root and passes no `base` to vite (`src/cli/commands/preview.ts`)                                  |

## Who else implements this

| Repo      | Has it  | Entry points                                                                                                                                                                                                                                                                       | Approach in one line                                                                                                                                                         |
| --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | PARTIAL | `evidence/cli/svelte.config.js`, `evidence/cli/adapter/index.js`, `evidence/cli/src/routes/[...path]/+page.server.ts`, `evidence/docs/self-host/{index,vercel,fly,render,railway}.mdx`                                                                                             | SvelteKit prerendered per-route HTML embedded in a single binary (`writeClient` + `writePrerendered`) — deep links work; no configurable base path (`kit.paths` unused)      |
| framework | FULL    | `framework/src/build.ts` (outputs map — one HTML per page), `framework/src/resolvers.ts` (`relativePath` on every URL), `framework/src/render.ts` (`/404` gets `<base href>` + a retry script), `framework/src/config.ts` (`base`, `normalizeBase`), `framework/docs/deploying.md` | Every page is a real HTML file and every link is relative to the page's own path — any static server, any prefix, no rewrite; `base` exists only to fix up the /404 fallback |
| mosaic    | PARTIAL | `mosaic/docs/.vitepress/config.js` (`base: '/mosaic/'`)                                                                                                                                                                                                                            | A set of libraries — dashboards are static spec+data files by nature with no build step; its own VitePress docs site proves the absolute-`base` pattern on GitHub Pages      |
| streamlit | PARTIAL | `streamlit/lib/streamlit/config.py` (`server.baseUrlPath`, `server.customComponentBaseUrlPath`)                                                                                                                                                                                    | A runtime prefix the Python server answers under — no static output exists to deploy                                                                                         |

**Count:** 1 of 4 implement it fully; all 4 address it. Deep links on a static host and prefix serving are table stakes for self-hosting — worth building. The disagreement — framework's page-relative links against a configured absolute base — is the decision this slice must make (see Trade-offs).

## Implementation inventory

All paths relative to `research_repos/`, verified on disk 2026-10-24.

### framework

| Concern                          | Files                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config key and normalization     | `framework/src/config.ts` (`base` on the config type, `normalizeBase`: must start `/`, trailing `/` appended)                                                                 |
| Build output                     | `framework/src/build.ts` (the `outputs` map — `type: "page"` per page path; `addToManifest` comment: "file is the serving path relative to the base")                         |
| URL resolution                   | `framework/src/resolvers.ts` (`relativePath(pagePath, target)` for files, imports, stylesheets), `framework/src/path.ts` (`relativePath`, `resolvePath`)                      |
| Page HTML and the /404 mechanism | `framework/src/render.ts` (`renderPage`; `/404` emits `<base href="${base}">` and a script that HEAD-fetches the path without a trailing slash and redirects when it answers) |
| Routing                          | `framework/src/route.ts`                                                                                                                                                      |
| Deploy contract                  | `framework/docs/deploying.md` (GitHub Pages workflow), `framework/docs/config.md` (§base — "only affects the custom 404 page"), `framework/.github/workflows/deploy.yml`      |

### evidence

| Concern                | Files                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adapter / build output | `evidence/cli/svelte.config.js`, `evidence/cli/adapter/index.js` (`discoverAssets` over `writeClient` + `writePrerendered` output, embedded in the binary) |
| Routes                 | `evidence/cli/src/routes/+page.server.ts`, `evidence/cli/src/routes/[...path]/+page.server.ts`                                                             |
| Self-host contract     | `evidence/docs/self-host/index.mdx`, `evidence/docs/self-host/authentication.mdx`, `evidence/docs/self-host/vercel.mdx`                                    |

### mosaic

| Concern        | Files                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| Prefix serving | `mosaic/docs/.vitepress/config.js` — `base: '/mosaic/'` for the GitHub Pages deploy |

### streamlit

| Concern        | Files                                                      |
| -------------- | ---------------------------------------------------------- |
| Prefix serving | `streamlit/lib/streamlit/config.py` — `server.baseUrlPath` |

## Standards and platform facts that bind the design

| Fact                                                                                                                                                     | Source                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `vite build --base=/my/public/path/`; `import.meta.env.BASE_URL` is "statically replaced during build"; a relative base `./` needs `import.meta` support | https://vite.dev/guide/build#public-base-path (fetched 2026-10-17 for R10)                                               |
| S3 website endpoints need an index document at every folder level; `photos` → 302 to `photos/` when `photos/index.html` exists                           | https://docs.aws.amazon.com/AmazonS3/latest/userguide/IndexDocumentSupport.html (fetched 2026-10-17)                     |
| Garage: `--index-document` (default `index.html`), `--error-document` for 404s                                                                           | https://garagehq.deuxfleurs.fr/documentation/cookbook/exposing-websites/ (fetched 2026-10-17)                            |
| `createRouter` accepts `basepath` — the router strips it when matching and prepends it when building hrefs                                               | measured in the installed `@tanstack/react-router@1.170.41`                                                              |
| GitHub Pages serves a site's `404.html` for unmatched paths                                                                                              | https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site |
| A copy of the shell is not prerendered HTML — the client still renders, so ADR-0008's rejected "per-page HTML needs SSR" does not apply                  | [ADR-0008](../adr/0008-static-build-is-a-spa-folder.md), `docs/research/self-hosting.md` D5                              |
| duckdb-wasm reads parquet with ranged GETs — whatever serves `build/` must answer `Range` with 206                                                       | [ADR-0008](../adr/0008-static-build-is-a-spa-folder.md), measured in `test/e2e/static-build.e2e.test.ts`                 |
| A worker script must be same-origin with the document — the widget module's blob-worker workaround stands                                                | `src/web/src/features/data/duckdb-live.ts` `startWorker`                                                                 |

## Trade-offs and what we adopt

| Axis                            | Options seen (repo → approach)                                                                                                                                                 | Trade-off                                                                                                                                                                                                 | Our choice, and why                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deep links with no rewrite      | framework → one real HTML per page · evidence → prerendered HTML in a binary · host fallback → `try_files`/`404.html`/`--error-document` · ours → copy the SPA shell per route | A copy is the same file, not prerendered output — no new render path; a host fallback is per-host config the deployer may not control; only `biac serve` leaves every non-`biac` host broken              | **Copy the shell to `<route>/index.html` for every manifest route at build** — `docs/research/self-hosting.md` D5(a): works on S3 website endpoints, Pages and Garage with zero host config |
| Base path                       | framework → every URL relative to the page · vite/mosaic/streamlit → a configured absolute base                                                                                | Relative breaks under the copies one level down (`./assets` from `/nested/x/` resolves to `/nested/assets`); vite emits asset URLs absolute under `base` and replaces `import.meta.env.BASE_URL` at build | **`base` in `biac.config.ts`, absolute** — D6: vite `base` for assets and `BASE_URL`, router `basepath` for routes, one config key the deploy sets once                                     |
| Unknown-route handling          | framework → `/404` page with `<base href>` + a retry script · Pages/Garage → `404.html`/`--error-document`                                                                     | framework's retry exists because its links are relative — under an absolute base a byte-identical shell copy is enough                                                                                    | **Emit `build/404.html` as a copy of the shell** (O2 confirms): Pages and Garage's error-document then reach the SPA's not-found page                                                       |
| Widget-module data under a base | SPA → `import.meta.env.BASE_URL` · module today → `new URL(import.meta.url).origin` (drops the path) · module-relative → `new URL("../data/…", import.meta.url)`               | The lib build sets `base: ""`, so `BASE_URL` bakes relative and loses the prefix; the module is always served beside `data/` at `<base>/widgets/`                                                         | **Module-relative `../data` resolution** — correct on any origin under any base (O4 measures a prefixed deploy)                                                                             |
| Where `base` is honored         | vite dev can serve under the base too · framework's `base` affects only build output                                                                                           | Dev under the prefix would rewrite every dev e2e's URLs for no authoring gain; parity lives in `biac preview`                                                                                             | **`biac build` and `biac preview` honor `base`; `biac dev` stays at `/`** (O3)                                                                                                              |

## Gap analysis — what we already have vs the references

| Concern                | Ours today (file)                                                                                                                                      | Best reference (file)                                                       | Gap                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------- |
| Per-route HTML         | `src/cli/commands/build.ts` emits one `index.html`; `src/engine/pages-plugin.ts` `writeBundle` copies `data/` only                                     | `framework/src/build.ts` outputs map — one file per page                    | absent — GAP-060              |
| Base config            | `biac.config.ts` closed schema, no `base` (`src/engine/biac-config.ts` `CONFIG_KEYS`); `viteBuild` called with no `base` (`src/cli/commands/build.ts`) | `framework/src/config.ts` `base` + `normalizeBase`                          | absent — GAP-061              |
| Routing under a base   | `createRouter` with no `basepath` (`src/web/src/features/pages/page-router.tsx`)                                                                       | `createRouter({ basepath })` — the router's own option (installed 1.170.41) | absent — GAP-061              |
| Data URL under a base  | `new URL("/" + source, dataOrigin)` (`src/web/src/features/data/register-source.ts`), `dataOrigin = location.origin` (`duckdb-live.ts`)                | framework `relativePath`-resolved links                                     | absent — GAP-061              |
| Widget-module data URL | `new URL(import.meta.url).origin` (`src/web/src/features/widget-module/module-runtime.ts`) — prefix dropped                                            | —                                                                           | absent — GAP-061              |
| Preview under a base   | `vitePreview` with no `base`; `/data`, `/widgets` middlewares at the root (`src/cli/commands/preview.ts`)                                              | —                                                                           | absent — GAP-061              |
| The copy hook          | `src/engine/pages-plugin.ts` `writeBundle` already walks `data/` into `build/`                                                                         | —                                                                           | present and partial — GAP-060 |

Overall: absent — the `writeBundle` hook is the only piece to extend. Nothing in the ledger claims part of this shipped.

## Deviations

| What                                            | Why                                                                                                                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copies of the shell, not per-route real HTML    | framework and evidence emit real HTML per page through a render path we do not have; the copy is the same file and the client renders as today — ADR-0008's rejected prerender option stays rejected |
| Absolute `base`, not framework's relative links | vite emits hashed `assets/` URLs absolute under `base`; relative breaks under the copies one level down                                                                                              |
| No `<base href>` element                        | it exists in framework only because its links are relative; an absolute base makes it unnecessary                                                                                                    |

## Open decisions

| Id  | Decision                                                              | Evidence to gather                                                                                                                                          | Candidates                                                                                                                                    |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | A page route colliding with a build dir (`data`, `assets`, `widgets`) | Which fixture/shipped pages sit under a reserved first segment — dev already shadows `/data` and preview mounts `/widgets`, so dev/build diverge either way | fail the build naming the page and the segment (recommended — `src/engine/reserved-filter-id.ts` precedent) · let the copy land               |
| O2  | Emit `build/404.html`?                                                | Which demo hosts honor it (Pages `404.html`, Garage `--error-document` — a plain `http.server` ignores it either way)                                       | byte-identical copy of the shell (recommended — one file, hosts that ignore it lose nothing) · none                                           |
| O3  | Does `biac dev` honor `base`?                                         | The dev server's `/data` and `/__biac/` middleware mounts under a prefixed vite base vs every existing dev e2e navigating at `/`                            | build+preview only (recommended — base is deploy config) · dev too                                                                            |
| O4  | The widget module's data base under a prefix                          | A real prefixed deploy (`Demo` step 5): module at `<base>/widgets/`, data at `<base>/data/`                                                                 | `new URL("../", import.meta.url)` as the data base (recommended — origin- and base-agnostic) · the configured `base` baked into the lib build |

Each settled decision gets an ADR, or a code comment when it does not surprise. The D5/D6 choices outlive the slice: T6 writes the ADR that supersedes ADR-0008's "needs a host-side fallback" consequence.

## Surface

| Layer  | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | `src/engine/biac-config.ts` (`base` in `CONFIG_KEYS`, normalize, `BiacConfig.base` in `src/engine/types.ts`); `src/engine/pages-plugin.ts` (`writeBundle` — the copies and the O1 guard); `src/cli/commands/build.ts` (`base` into `viteBuild`, drop the rewrite line); `src/cli/commands/preview.ts` (`base` into `vitePreview`, middleware mounts)                                                                                                          |
| client | `src/web/src/features/pages/page-router.tsx` (`basepath`); `src/web/src/features/data/register-source.ts` and `duckdb-live.ts` (the data-base join); `src/web/src/features/widget-module/module-runtime.ts`                                                                                                                                                                                                                                                   |
| ui     | none — no component changes, no story changes                                                                                                                                                                                                                                                                                                                                                                                                                 |
| tests  | `src/engine/biac-config.unit.test.ts`; `src/web/src/features/data/register-source.unit.test.ts`; `src/web/src/features/pages/page-router.unit.test.tsx`; `test/integration/static-build.integration.test.ts`; `test/e2e/static-build.e2e.test.ts`; a new e2e-browser spec serving `build/` from a rewrite-less static server at `/` and `/bi-as-code/` (`test/lib/dev-server.ts` spawn + `test/e2e-browser/host-page.ts` `serveHostPage` for the widget case) |

## Tasks

- [ ] T1 — `base` in `biac.config.ts` and into `vite build`; part of GAP-061. A `base` key validated like framework's `normalizeBase` (must start `/`, trailing `/` appended, else `invalid` naming the field), exposed as `BiacConfig.base`, and passed to `viteBuild` as vite's `base` on the build command only (`biac dev` keeps `/` pending O3). Unit tests in `src/engine/biac-config.unit.test.ts` for the accepted and refused shapes; integration test in `test/integration/static-build.integration.test.ts`: a `base: "/bi-as-code/"` build emits `index.html` referencing `/bi-as-code/assets/…` and `/bi-as-code/favicon.svg`, and `build/data/` is copied unchanged.
- [ ] T2 — Per-route `index.html` copies, settling O1 and O2; GAP-060. `src/engine/pages-plugin.ts` `writeBundle` copies the emitted shell to `build/<route>/index.html` for every `discoverPages` route (and `404.html` if O2 holds), applies the O1 collision policy, and `build.ts` drops the "SPA rewrite" line. Integration tests: `build/weekly-review/index.html` and `build/nested/allocation/index.html` byte-identical to `build/index.html`, a reserved-segment page fails naming it, and a route one level deep serves assets (the copy's refs stay absolute). `playwright-cli`: Demo step 2 on `python3 -m http.server`.
- [ ] T3 — Client base plumbing, settling O4; part of GAP-061. `buildPageRouter` passes `basepath: import.meta.env.BASE_URL`; `registerSource`/`duckdb-live` resolve `new URL(source, dataBase)` where the SPA's base is `location.origin + BASE_URL` and `module-runtime` passes `new URL("../", import.meta.url)` (O4). Unit tests beside `register-source.unit.test.ts` and `page-router.unit.test.tsx` for the joined URLs; measured on a prefixed build in T5's spec. `playwright-cli`: Demo step 4 — the page under `/bi-as-code/` renders and its parquet query 206s.
- [ ] T4 — `biac preview` under the configured base; part of GAP-061. `preview.ts` reads `base` from `loadBiacConfig` and passes it to `vitePreview`; the `/data` and `/widgets` CORS and media-type middlewares mount beneath it. e2e tests in `test/e2e/static-build.e2e.test.ts`: a prefixed build serves the shell, a deep link, a ranged `/bi-as-code/data/` read and the dataOrigins policy on it.
- [ ] T5 — The rewrite-less host proof; closes GAP-060 and GAP-061. A new `test/e2e-browser/` spec that spawns a plain node static server (no SPA fallback, `test/lib/dev-server.ts` spawn pattern) over `build/` at `/` and at `/bi-as-code/`: a deep link renders, a crossfilter gesture re-queries, `serveHostPage` mounts `widgets/revenue-by-region.js` under the prefix with its data requests under `/bi-as-code/data/`, console clean. Re-measure both GAP rows and mark them closed in `docs/research/self-hosting.md`.
- [ ] T6 — The ADR and the ledger. An ADR recording per-route shell copies and the absolute `base` (superseding ADR-0008's "deep links need a host-side fallback" consequence and stating `biac dev` stays at `/`); update `docs/architecture.md`'s build description if it names the output shape; the backlog row keeps `open` until the Demo runs.

## Out of scope

| What                                                                            | Owner                                              |
| ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `biac serve` — the production server with basic auth and security headers       | SL-057                                             |
| The container image and the deployment guide (topologies T1/T2)                 | SL-058                                             |
| The worked SSO example (moto + Caddy + oauth2-proxy + Keycloak)                 | SL-059                                             |
| The docs project and the GitHub Pages publish workflow that this slice unblocks | SL-061, SL-062                                     |
| SSR or prerendered per-page HTML                                                | none — ADR-0008's rejected option stays rejected   |
| A relative `./` base                                                            | none — breaks under the copies one level down (D6) |
