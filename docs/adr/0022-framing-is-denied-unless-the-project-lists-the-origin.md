# ADR-0022 — Framing is denied unless the project lists the framing origin

Status: accepted
Date: 2026-10-21

## Context

A biac page can be shown inside another site's `<iframe>`: front-matter `sidebar: false` and `header: false` drop the chrome (`src/engine/page-chrome-frontmatter.ts`). Without a framing policy any origin can frame any page, so a hostile site can overlay one and trick a reader into clicking (clickjacking). Measured on `biac dev` and `biac preview` before this decision: no `Content-Security-Policy` and no `X-Frame-Options` on any response.

A static build is one SPA folder with no server ([ADR-0008](0008-static-build-is-a-spa-folder.md)), so the policy is a response header sent by whatever serves the files. `frame-ancestors` is honoured only as a header, never from a `<meta>` element (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

## Decision drivers

- Safe by default: a project that sets nothing cannot be framed by anyone.
- One explicit list in `biac.config.ts` names every site allowed to frame the pages; nothing else is implied.
- The header the author reads in the config is the header the browser enforces: no silent widening, no source the browser would drop.
- Standards over invention: the controls are the ones the HTML Standard, CSP3 and OWASP prescribe.

## Facts

| Fact                                                                                                                                                              | Source                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| "if both a CSP frame-ancestors directive and an `X-Frame-Options` header are used in the same response, then `X-Frame-Options` is ignored"                        | https://html.spec.whatwg.org/#the-x-frame-options-header                     |
| `X-Frame-Options` `ALLOW-FROM` "is not to be implemented": the header cannot express an allowlist                                                                 | same                                                                         |
| `ancestor-source-list = ( ancestor-source *( required-ascii-whitespace ancestor-source) ) / "'none'"`: `'none'` stands alone                                      | https://www.w3.org/TR/CSP3/#directive-frame-ancestors                        |
| `host-part = "*" / [ "*." ] 1*host-char *( "." 1*host-char ) [ "." ]`, `host-char = ALPHA / DIGIT / "-"`: no IPv6 literal                                         | https://www.w3.org/TR/CSP3/#grammardef-host-part                             |
| OWASP: "Use Content Security Policy (CSP) frame-ancestors directive if possible"; for `X-Frame-Options`, "Do not allow displaying of the page in a frame": `DENY` | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html |

## Options considered

| Option                                                  | Pro                                                      | Con                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| No policy, left to the host                             | Nothing to configure                                     | Every page frameable by every site; the measured baseline                                             |
| `X-Frame-Options: DENY` only                            | One header, universally understood                       | No allowlist is possible, so embedding is forbidden outright                                          |
| `frame-ancestors 'self'` plus the listed origins        | The site can frame its own pages without listing itself  | Allows a framer the author never named                                                                |
| `frame-ancestors 'none'`, or exactly the listed origins | Deny by default; the header is the list and nothing else | A site that frames its own pages lists its own origin                                                 |
| Also send `X-Frame-Options: DENY`                       | Browsers without CSP 2 fail closed                       | One more header; ignored wherever `frame-ancestors` is understood, so it never blocks a listed origin |

## Decision

`biac.config.ts` takes `embed: { origins: string[] }`. Each origin is written as the browser serializes it, `new URL(origin).origin === origin`, over `http` or `https`, with a host made of CSP `host-char`s. A path, a trailing `/`, a query, credentials, upper case, a default port spelled out, `*`, a `*.` host, an IPv6 literal or another scheme is a located config error (`src/engine/embed-config.ts`).

Every response from `biac dev` and `biac preview` carries (`src/engine/frame-ancestors.ts` `frameAncestorsHeaders`):

- `Content-Security-Policy: frame-ancestors 'none'` when no origin is listed, otherwise `frame-ancestors <origin> <origin>…` with exactly the listed origins and no `'self'`;
- `X-Frame-Options: DENY`.

`biac dev` reads the list on every request through the memoized config (`frameAncestorsMiddleware`, mounted first in `src/engine/pages-plugin.ts`), so an edit applies on the reload the config edit already triggers; while the config fails to load the policy denies every framer. `biac preview` reads it once at start (`src/cli/commands/preview.ts`), and an invalid list stops it with the located error.

## Consequences

- A project that sets nothing is not frameable, its own site included.
- `frameAncestorsHeaders` is the one place the policy is built; any later server or host config (`biac serve`, a bucket or CDN) reuses it rather than restating the rule.
- A static build copied to another host carries no policy: that host must send these headers. `biac build` cannot ([ADR-0008](0008-static-build-is-a-spa-folder.md)).
- Wildcard subdomains are not offered; each framing site is listed by its exact origin.
- Only the framing policy is sent: no other CSP directive is set, so pages, widgets and DuckDB-WASM run as before.
