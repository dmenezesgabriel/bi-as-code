# ADR-0009 — Page edits hot-update through the manifest as the HMR boundary; only manifest changes reload

Status: accepted
Date: 2026-10-10

## Context

`biac dev` compiles every `pages/**/*.{md,mdx}` file into a module (`src/engine/pages-plugin.ts`), and the SPA reaches those modules only through the `virtual:biac-pages` manifest, whose entries lazily `import()` each page. The router (`src/web/src/router.tsx`) imports the manifest; nothing upstream accepts HMR updates.

Until now every page change invalidated the manifest, so vite's update propagation dead-ended and the browser fully reloaded. A full reload throws away all client state: the duckdb-wasm instance and its registered tables, every query result, and any UI living beside the page — an in-browser source editor would lose its buffer, cursor and scroll on every save. URL state (`?region=`) survives a reload, but nothing else does.

Vite's HMR API lets a module accept updates for its dependencies: `import.meta.hot.accept(deps, cb)` makes the accepting module the propagation boundary, and the callback receives the re-fetched dependency module ([vite HMR API](https://vite.dev/guide/api-hmr)). Propagation stops at any importer whose accepted dependencies include the changed module, and the importer itself is not invalidated.

## Decision drivers

- A content edit must re-render the page without discarding client state.
- Edits that change routing or navigation (a page added, removed or renamed, a nav front-matter field edited) must still rebuild the route tree.
- No second change-notification channel next to vite's own websocket.
- Nothing of the mechanism may reach a production build.

## Options considered

| Option                                                                                                               | Pro                                                                                                   | Con                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Keep the full reload on every edit                                                                                   | No code                                                                                               | Destroys all client state on every save                                                                                              |
| Poll a "project changed" endpoint and re-run the page                                                                | Independent of vite                                                                                   | A second channel; adds poll latency; still needs a way to fetch the new module                                                       |
| Custom server→client event (`hot.send`) and a client re-import                                                       | Explicit                                                                                              | The client cannot cache-bust a page import whose URL vite rewrote; duplicates what vite's update payload already does                |
| Each page module self-accepts                                                                                        | Native vite mechanism                                                                                 | The page must reach into the SPA to hand its new module to the router, coupling compiled pages to web code                           |
| **The manifest accepts every page module as a dependency; the plugin invalidates the manifest only when it changes** | Native vite mechanism; the manifest already owns `load`, so the new module lands where routes read it | The accept list is regenerated with the manifest — accepting a page added later needs the reload that adding a page already triggers |

## Decision

The `virtual:biac-pages` module accepts every page module as an HMR dependency, and the plugin invalidates that module only when its regenerated source differs from the source it last served.

On a page change, `hotUpdate` re-runs page discovery and compares the resulting manifest source with the one last loaded. Identical means the edit was content-only: the page module alone is updated, the manifest's accept callback stores the new module so every entry's `load` resolves to it, and `subscribePageUpdates` listeners run — the router calls `router.invalidate()`, the matched route's loader re-runs and the page re-renders in place. A different manifest (or front-matter discovery can no longer parse) invalidates the manifest, which nothing accepts, so the browser reloads and the route tree rebuilds — the same single rule covers add, remove, rename and nav front-matter edits. The accept block sits behind `if (import.meta.hot)`, which is `undefined` in a production build, so the build drops it.

## Consequences

- A content edit keeps the duckdb-wasm instance, the URL and anything rendered beside the page. The page's MDX component is a new component type, so the page body remounts; the query registry sits outside the page's filter scope and re-runs only fences whose interpolated SQL changed.
- Each page version gets a fresh filter scope (`src/web/src/features/pages/markdown-page.tsx`), re-seeded from the URL: URL filters (`?region=`) survive a save, session-only cross-filter state (a chart click) does not. Keeping the old scope is the tempting "fix" — but remounted inputs re-configure live filters during render, and a slider would publish its silent bounds correction into the widgets it narrows.
- Any page edit re-runs discovery (one glob and a front-matter read per page). That cost is what keeps the decision rule single and exact; replace it only with something equally exact.
- The comparison is on the whole manifest source, not on chosen fields. A tempting "optimisation" is to compare just `title`/`sidebar_position` of the edited file — that would miss renames and duplicate-route errors that discovery catches.
- An edit that fails to compile is still a successful hot update: the dev server serves a module whose only export is the compile error (`src/engine/page-compile-error.ts`), and the page route renders it where the page would be (`src/web/src/features/pages/compile-error-page.tsx`). Throwing from the transform instead would make vite answer the module request with a 500 and cover the whole app with its error overlay — over anything rendered beside the page — and a first load of a broken page would never reach the route. A build is not an edit loop: `vite build` fails on the first page that does not compile.
- An edit that breaks page discovery (front-matter that no longer parses) keeps the manifest that was last served. Invalidating it would reload the browser into a manifest module that cannot load, leaving no app; the edited page reports the error instead. A dev server started on already-broken front-matter still fails at the manifest.
