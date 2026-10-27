# ADR-0025 — Data files are readable cross-origin only by the origins the project lists

Status: accepted
Date: 2026-10-22

## Context

Every file a page queries is already public to its viewer ([ADR-0005](0005-queries-run-client-side-in-duckdb-wasm.md)), and `biac build` copies `data/` and loader outputs to `build/data/` unhashed, so each has a stable URL. Another site (a notebook, a second dashboard, an intranet portal) can link to those URLs, but a script on that site can read a response only when the server grants its origin through CORS.

Measured on `biac dev` and `biac preview` before this decision: nothing in `src/` sent a CORS header. vite's own CORS middleware runs ahead of every biac middleware, and its default origin pattern admits `localhost`, `127.0.0.1` and `[::1]` on any port, for the whole site. Pages, `/@fs/` and `/src/` modules were included, and no other origin was. An author could neither list one consumer nor refuse a second loopback page.

## Decision drivers

- Deny by default, as framing is ([ADR-0022](0022-framing-is-denied-unless-the-project-lists-the-origin.md)).
- Least privilege: framing a page and reading its raw data are separate grants.
- The rule covers the data files only, never pages or dev modules.
- A ranged read (DuckDB-WASM, or a script reading `Content-Range`) works from a listed origin.

## Facts

| Fact                                                                                                                                                                                           | Source                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| When `Access-Control-Allow-Origin` echoes the request's origin, the response must carry `Vary: Origin`, or a cached response is reused across origins                                          | https://fetch.spec.whatwg.org/#cors-protocol-and-http-caches           |
| Only `Cache-Control`, `Content-Language`, `Content-Length`, `Content-Type`, `Expires`, `Last-Modified` and `Pragma` are readable cross-origin without `Access-Control-Expose-Headers`          | https://fetch.spec.whatwg.org/#cors-safelisted-response-header-name    |
| A `Range` request header is CORS-safelisted only as a single range with a start (`bytes=0-3`); a suffix range (`bytes=-500`) triggers a preflight                                              | https://fetch.spec.whatwg.org/#cors-safelisted-request-header          |
| vite's `server.cors` default admits only loopback origins, site-wide; `preview.cors` falls back to it                                                                                          | https://vite.dev/config/server-options#server-cors                     |
| vite's earlier default, `server.cors: true`, let any website read a dev server's responses (CVE-2025-24010)                                                                                    | https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6 |
| DuckDB-WASM's HTTP file system reads only `Content-Length` and `Last-Modified` and sends `Range: bytes=0-`, so a cross-origin DuckDB read needs `Access-Control-Allow-Origin` and no preflight | `@duckdb/duckdb-wasm` 1.32.0 `dist/duckdb-browser-eh.worker.js`        |

## Options considered

| Option                                                        | Pro                                                          | Con                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Keep vite's loopback rule, add ours on `/data/`               | No vite setting changes                                      | Every loopback page still reads every page and module; a second local consumer cannot be refused       |
| `Access-Control-Allow-Origin: *` on `/data/`                  | No config                                                    | Any site a viewer visits reads the files from wherever the viewer's browser sits, an intranet included |
| Reuse `embed.origins`                                         | One list                                                     | Allowing a site to frame pages also hands it every raw file, and the reverse                           |
| `embed.dataOrigins`, echoed per request, with vite's rule off | Deny by default; one grant per purpose; covers `/data/` only | One more key to learn                                                                                  |

## Decision

`biac.config.ts` takes `embed.dataOrigins: string[]`, default `[]`. It is validated by the same origin rule as `embed.origins` (`src/engine/embed-config.ts`). It stays out of the browser's `virtual:biac-config`, so a build doesn't publish the full list of consumers.

Every `/data/` response from `biac dev` and `biac preview` (files, loader outputs, `200`, `206`, `HEAD` and `304`) carries `Vary: Origin`. When the request's `Origin` is listed, it also carries `Access-Control-Allow-Origin: <origin>` and `Access-Control-Expose-Headers: Content-Range, Accept-Ranges`. An `OPTIONS` on `/data/` gets `204` with `Access-Control-Allow-Methods: GET, HEAD` and `Access-Control-Allow-Headers: Range`, plus the origin header when listed. `*` and credentials are never sent. One builder produces the headers: `dataCorsHeaders` in `src/engine/data-cors.ts`.

`server.cors` and `preview.cors` are `false`, so the list is the only CORS rule. `biac dev` reads the list on every request (an edit applies without a restart). While the config fails to load, every origin is refused. `biac preview` reads it once at start and mounts the middleware ahead of vite's, as it does for framing.

## Consequences

- A project that sets nothing serves no cross-origin reads, loopback included. A local tool on another port that read a dev server's pages before this change no longer can.
- A static build copied to another host carries no CORS policy. That host must send these headers ([ADR-0008](0008-static-build-is-a-spa-folder.md)), and any later server (`biac serve`, a bucket or CDN config) reuses `dataCorsHeaders`.
- Wildcard origins are not offered: each consumer is listed by its exact origin.
