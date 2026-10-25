# ADR-0030 — `biac serve` is env basic auth that fails closed beyond localhost

Status: accepted
Date: 2026-10-25
Amends: [ADR-0029](0029-the-build-copies-its-shell-per-route-and-honors-an-absolute-base.md)

## Context

ADR-0029 made `build/` deployable on any static host. Self-hosting also needs a server biac ships itself: a container or a VM has no bucket or reverse proxy in front of it, and a report over private data must not be one forgotten `--host` away from the open internet. `biac preview` cannot be that server: it binds `127.0.0.1` only, answers every unmatched path with the SPA shell and a `200`, and sends none of the headers a production response carries.

The facts that bind the design:

- HTTP basic auth is `Authorization: Basic base64(user:password)`; the user-id may not contain `:`, so the split is on the first `:`; a `401` carries `WWW-Authenticate: Basic realm=…`, and `charset="UTF-8"` declares the credential encoding ([RFC 7617](https://www.rfc-editor.org/rfc/rfc7617) §2).
- A browser refuses `fetch()` on a URL that embeds credentials, so a page behind basic auth reaches duckdb-wasm's reads only through the browser's own credential prompt or context ([Fetch standard](https://fetch.spec.whatwg.org/)).
- vite `preview()` runs `configurePreviewServer` middlewares before its static handler, and rejects any non-loopback `Host` unless `preview.allowedHosts` is `true` (https://vite.dev/config/preview-options).
- Data files and widget modules are read cross-origin by design ([ADR-0025](0025-data-files-are-readable-cross-origin-only-by-listed-origins.md), [ADR-0027](0027-a-widget-module-is-importable-only-by-listed-data-origins.md)).

## Decision drivers

- Authentication is explicit: an operator either supplies credentials or says out loud that there are none.
- The unsafe state cannot start by accident: no credentials plus a reachable bind refuses to boot.
- Every response is covered — static files, ranged reads, redirects and misses alike.
- The status codes are truthful, so a host check, a crawler and a monitor read the same thing a person does.

## Options considered

| Axis               | Option                                                                                                                                                                   | Pro                                                                           | Con                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Credentials        | `BIAC_BASIC_USER` / `BIAC_BASIC_PASSWORD` environment variables                                                                                                          | Container-native; nothing in `biac.config.ts` or the repo; no secret in argv  | One shared credential pair, no per-user identity                                                                                                 |
| Credentials        | A flag or a key in `biac.config.ts`                                                                                                                                      | Discoverable                                                                  | Secrets in shell history, `ps` and a committed file                                                                                              |
| No-auth            | `BIAC_AUTH_DISABLED=1\|true` is the only opt-out                                                                                                                         | A typo (`yes`, `True ` ) fails closed instead of opening the server           | An operator who wrote `yes` gets a refusal and must read it                                                                                      |
| No-auth            | Any truthy value disables auth                                                                                                                                           | Forgiving                                                                     | A misspelling silently serves private data                                                                                                       |
| Bind policy        | Refuse a bind outside `127.0.0.1`/`localhost`/`::1` with neither credentials nor the opt-out                                                                             | Fail-closed; localhost stays frictionless for authoring                       | A container must set one of the three variables                                                                                                  |
| Bind policy        | Warn and start                                                                                                                                                           | Never blocks                                                                  | The warning is read after the exposure                                                                                                           |
| Half-set pair      | Warn on every bind                                                                                                                                                       | A half-set pair is a mistake worth naming                                     | One more line of output                                                                                                                          |
| Credential compare | SHA-256 both sides, then `timingSafeEqual`                                                                                                                               | No length short-circuit, so timing does not reveal the credential's length    | Two hashes per request                                                                                                                           |
| Hardened headers   | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, beside the framing policy ([ADR-0022](0022-framing-is-denied-unless-the-project-lists-the-origin.md)) | Our URLs carry filter state (`?region=West`) and the app reads no `Referer`   | `no-referrer` withholds the origin from any outbound link as well                                                                                |
| Hardened headers   | Add HSTS, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy: same-site`                                                                                        | The OWASP secure-headers set                                                  | HSTS is inert over HTTP and belongs to the TLS terminator; CORP `same-site` would break the shipped cross-origin `/data/` and `/widgets/` embeds |
| Hashed assets      | `Cache-Control: public, max-age=31536000, immutable` on `<base>assets/*`                                                                                                 | Filenames carry a content hash, so a cached copy is never stale               | A non-hashed file under `assets/` would be cached for a year; the build emits none                                                               |
| Unmatched routes   | `appType: "mpa"` and a post-hook: `301` to `path/` for a route directory, `404` with `build/404.html` for a miss                                                         | Real status codes; the build's own `404.html` is served as the not-found page | `serve` answers differently from `preview`, which keeps the SPA shell for authoring parity                                                       |
| Unmatched routes   | `appType: "spa"`, as `preview`                                                                                                                                           | One behaviour in both commands                                                | Every miss answers `200`, and a missing data file answers with HTML                                                                              |
| `Host` check       | `preview.allowedHosts: true`                                                                                                                                             | A server behind a load balancer receives the public `Host`                    | The deployer owns the perimeter; the check no longer guards against DNS rebinding                                                                |

## Decision

`biac serve [projectRoot] [--port N] [--host H]` runs vite `preview()` over `build/` with `base` from `biac.config.ts`, default host `127.0.0.1`, default port `3000` (the container convention), `strictPort: true`, `preview.cors: false` and `preview.allowedHosts: true` (`src/cli/commands/serve.ts`). A missing `build/` exits `1` naming the folder.

Auth reads `BIAC_BASIC_USER` and `BIAC_BASIC_PASSWORD` (`src/cli/basic-auth.ts`). With both set, every request needs a matching `Authorization: Basic …` header or answers `401` with `WWW-Authenticate: Basic realm="biac", charset="UTF-8"`. `BIAC_AUTH_DISABLED` disables auth only for exactly `1` or `true`. With neither credentials nor the opt-out, `serve` starts only on `127.0.0.1`, `localhost` or `::1`; any other host exits `1` and the message names `BIAC_BASIC_USER`, `BIAC_BASIC_PASSWORD` and `BIAC_AUTH_DISABLED`. The opt-out on a reachable host starts with a loud warning, and a half-set pair warns on every bind.

The middleware order is headers, then auth, then the static plugins `biac preview` shares (CORS grants, media types, framing policy, `/widgets`), so a `401` carries `nosniff` and `no-referrer` too (the framing policy mounts after auth) (`src/cli/serve-headers.ts`). A post-hook (`src/cli/serve-routes.ts`) completes the routing: a GET or HEAD naming a route directory without its trailing slash answers `301` to `path/` with the query kept, and any other unmatched GET or HEAD answers `404` with `build/404.html`.

## Consequences

- A private report deploys as one process with two environment variables and cannot start exposed by accident; the localhost default keeps `biac serve` frictionless on a laptop.
- Credentials are one shared pair. Per-user identity and single sign-on are an upstream proxy's job; `BIAC_AUTH_DISABLED=true` behind such a proxy is the supported shape.
- Basic auth over plain HTTP exposes the pair to the network; TLS and HSTS belong to the terminator in front of `serve`.
- `serve` and `preview` differ on purpose: `preview` is the authoring parity check and keeps the SPA fallback, `serve` is the production contract and answers misses with `404`. ADR-0029's per-route copies make the difference invisible to a deep link.
- A missing data or widget file answers `404` instead of the shell's `200`, so a broken reference surfaces in the browser's network panel and in duckdb-wasm's error.
