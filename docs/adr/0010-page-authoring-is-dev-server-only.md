# ADR-0010 — Page authoring runs only on the dev server: a same-origin page-source endpoint, a `?edit` view, and an `import.meta.hot` guard

Status: accepted
Date: 2026-10-10

## Context

`biac dev` lets an author edit a page in the browser: the page route renders a source editor beside the live page, reads the page's file from disk and writes it back on save, and the save hot-updates the page ([ADR-0009](0009-page-edits-hot-update-without-a-reload.md)). That makes the dev server a **write path into the project's files**, reachable over HTTP on a localhost port.

Three forces bound it:

- **Any web page the author has open can send requests to `localhost`.** A browser attaches no credentials the dev server checks, so the only thing separating the editor's own requests from a hostile page's is what the browser says about where the request came from. Vite's default `server.cors` allows every origin matching `/^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/` — every `localhost` port, not just the dev server's ([vite server options](https://vite.dev/config/server-options#server-cors)). Another app on a sibling port is `same-site` to the dev server, not `cross-site`, under the Fetch Metadata rules ([`Sec-Fetch-Site`](https://www.w3.org/TR/fetch-metadata/#sec-fetch-site-header)).
- **A static build must not contain the editor.** `biac build` emits a folder of static files ([ADR-0008](0008-static-build-is-a-spa-folder.md)); there is no server to write to, so an editor in the bundle is dead weight (the whole CodeMirror chunk) and a dangling write URL.
- **A page has one route.** The page route (`pageRoute` in `src/web/src/features/pages/page-router.tsx`) already owns the page's loader, its hot swap, title, breadcrumbs, sidebar state and its URL filter state (`?region=`). Editing should keep all of that, so that a filter picked in the preview survives a save.

## Decision drivers

- No write path and no editor byte in any build, whatever environment the build runs under.
- No write from any origin but the dev server's own — including other `localhost` ports.
- No file reachable but an existing page under `pages/`; no create, rename or delete.
- Editing a page keeps the page's route, loader and URL state.

## Options considered

| Concern      | Option                                                                                              | Pro                                                                                                                                                                          | Con                                                                                                                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading      | `import "…md?raw"` through vite                                                                     | No new server code                                                                                                                                                           | Becomes another HMR module; the editor would not re-read exactly the bytes it wrote; still needs a separate write path                                                                                                                                                           |
| Reading      | **`GET` on the same middleware that saves**                                                         | One middleware owns page-source I/O; the editor reads the disk bytes it will overwrite                                                                                       | New server code                                                                                                                                                                                                                                                                  |
| Origin check | Reject only `Sec-Fetch-Site: cross-site`                                                            | Simple                                                                                                                                                                       | A sibling `localhost` port is `same-site` and vite's CORS already grants it — another local app could write pages                                                                                                                                                                |
| Origin check | **Reject any `Origin` whose host is not `Host`, and any `Sec-Fetch-Site` but `same-origin`/`none`** | Only the dev server's own pages pass; requests without browser headers (curl) pass because they carry no ambient authority                                                   | A same-origin page served by the dev server could still write — accepted, it is the author's own project                                                                                                                                                                         |
| Edit route   | `/__edit/<page>`, a second route per page                                                           | Edit state is in the path                                                                                                                                                    | Registers every page twice; loader, hot swap, title, breadcrumbs and filter scope duplicated or shared across routes                                                                                                                                                             |
| Edit route   | **`/<page>?edit` on the existing page route**                                                       | Same loader, hot swap and URL filter state; one route per page                                                                                                               | `edit` becomes a reserved search parameter on every page                                                                                                                                                                                                                         |
| Build guard  | `import.meta.env.DEV`                                                                               | Familiar                                                                                                                                                                     | Follows `NODE_ENV`, not the command: `NODE_ENV=development vite build` builds with `DEV` true ([vite env and mode](https://vite.dev/guide/env-and-mode#node-env-and-modes)); a `biac build` under `NODE_ENV=development` or `test` shipped the editor chunk and the endpoint URL |
| Build guard  | **`import.meta.hot`**                                                                               | Defined only while vite's dev server serves the module; every build replaces it with `undefined` and tree-shakes the branch ([vite HMR API](https://vite.dev/guide/api-hmr)) | Reads as an HMR check, not a "dev" check — the comment at each site says why                                                                                                                                                                                                     |

## Decision

Page authoring is served by the dev server only: a same-origin `GET`/`PUT` endpoint at `/__biac/page-source/<path under pages/>`, an editor opened by `?edit` on the page's own route, and every client byte of it behind `import.meta.hot`.

**Endpoint** (`src/engine/page-source-endpoint.ts`, mounted in `configureServer` of `src/engine/pages-plugin.ts`, which `vite build` and `vite preview` never run). The `__` prefix follows vite's own dev-only middleware (`/__open-in-editor`). Rules, in the order the middleware applies them:

| Request                                                                                           | Response                                                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Any method but `GET`/`PUT`                                                                        | 405, `Allow: GET, PUT`                                                        |
| `Sec-Fetch-Site` present and not `same-origin`/`none`, or `Origin` present and its host ≠ `Host`  | 403                                                                           |
| Path that does not decode                                                                         | 400                                                                           |
| Path resolving outside `pages/` (containment shared with `/data`, `src/engine/contained-path.ts`) | 403                                                                           |
| Anything but an existing `.md`/`.mdx` file (extension matched case-sensitively, like discovery)   | 404 — there is no create                                                      |
| `GET`                                                                                             | 200, the file's bytes as `text/markdown`, `Cache-Control: no-cache`           |
| `PUT` whose `Content-Type` is not `application/json`                                              | 415                                                                           |
| `PUT` body over 1 MiB                                                                             | 413                                                                           |
| `PUT` body not `{ "source": string }`                                                             | 400                                                                           |
| `PUT` accepted                                                                                    | 204; written to a temp file in the same directory, then renamed over the page |

Requiring `application/json` makes every write a non-simple request, so a browser sends a CORS preflight first; a cross-site form post or `no-cors` fetch can never write. The temp-then-rename write means the file watcher never sees an empty or half-written page.

**Route.** `/<page>?edit` renders the page inside the editor's split pane (`EditablePage` in `src/web/src/features/pages/editable-page.tsx`); any `edit` value but `false` opens it (`isEditSearch` in `src/web/src/features/editor/edit-search.ts`), because the router parses a bare `?edit` to `""`. A query parameter selecting a view of the same resource is the precedent of MediaWiki's `index.php?title=X&action=edit` ([MediaWiki parameters](https://www.mediawiki.org/wiki/Manual:Parameters_to_index.php)), and the path plus query identify the resource ([RFC 3986 §3.4](https://www.rfc-editor.org/rfc/rfc3986#section-3.4)).

**Guard.** The editor is a dynamic import behind `import.meta.hot` (`src/web/src/features/pages/editable-page.tsx`), and so is the page-source client the router hands to page routes (`src/web/src/router.tsx`); the header's `Edit` link renders only when that client exists. `test/integration/static-build.integration.test.ts` asserts no file under `build/` contains `codemirror` or `/__biac/page-source/`; `test/e2e-browser/static-build.spec.ts` asserts a built page has no `Edit` link and no editor on `?edit`.

## Consequences

- An author edits, saves and watches the page re-render without leaving it; the URL they share is the page's URL, with or without `?edit`.
- `edit` is a reserved search parameter in `biac dev`, and nothing enforces it yet: a filter input with `id="edit"` would open the editor when used, and `?edit` reaches a page as `{{params.edit}}`. The fix — a compile error for a reserved input id and `edit` stripped from `params` — is tracked in the backlog's Known debt.
- Tempting "fixes" to resist:
  - Swapping `import.meta.hot` for `import.meta.env.DEV` "because it reads better" — it ships the editor whenever a build runs with `NODE_ENV` set to `development` or `test`.
  - Rejecting only `Sec-Fetch-Site: cross-site` — sibling `localhost` ports are `same-site`.
  - Accepting `text/plain` bodies "for curl" — it removes the preflight that keeps cross-site forms out.
  - Letting `PUT` create a missing file — page creation, rename and delete need their own decision about routing and the manifest; the endpoint refuses them by returning 404.
- A request with neither `Origin` nor `Sec-Fetch-Site` passes. That is deliberate: only a browser carries another site's ambient reach into `localhost`, and a browser always sends `Origin` on a `PUT`.
