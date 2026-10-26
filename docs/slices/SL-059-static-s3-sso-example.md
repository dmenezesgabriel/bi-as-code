# SL-059 — A static `build/` served from a private S3 bucket behind an SSO proxy, as an ALB would

Milestone: Phase 7 — Self-hosting and authentication · State: open · Depends on: R10, SL-056 · Closes: GAP-063

## Outcome

A deployer runs one compose file under `examples/s3-sso/` and gets an AWS-shaped static deployment of a biac project: `build/` in a moto server S3 bucket that requires authentication, reachable only on the compose network, behind Caddy as the TLS-terminating load balancer, which asks oauth2-proxy (`forward_auth`) before every request, signed in against Keycloak shaped like Microsoft Entra ID — and a smoke script proves sign-in, a deep link, a reload and a ranged data read.

## Demo

1. Cold start: `pnpm build:cli && bin/biac build` in the repo root — the project's own `build/`.
2. `docker compose -f examples/s3-sso/compose.yaml up -d --wait` — moto, the bucket upload, Keycloak (realm imported), oauth2-proxy and Caddy all report healthy; only Caddy publishes ports (`docker compose ps --format '{{.Service}} {{.Publishers}}'`).
3. `curl -k -i https://localhost:8443/weekly-review/` with no session → `302` to `/oauth2/sign_in?rd=…` (Caddy's `@error status 401` redirect); `curl -i http://localhost:8080/weekly-review/` → redirect to HTTPS.
4. Inside the network, an unsigned read of the bucket is refused: `docker compose exec <probe> curl -i http://moto:5000/<bucket>/index.html` → `403` (D11's "authentication enforced").
5. Browser (`playwright-cli`, headless, `--ignore-https-errors` or Caddy's local CA trusted for the session): goto `https://localhost:8443/weekly-review/` → Keycloak sign-in page → sign in as the realm's demo user → back on `weekly-review`, page renders, picking a filter re-queries (parquet answers `206` through Caddy), reload keeps the page, `https://localhost:8443/nested/allocation/` deep link renders, console clean.
6. `pnpm -s example:s3-sso:smoke` does steps 3–5 headless and exits `0`; `docker compose -f examples/s3-sso/compose.yaml down -v` leaves nothing running (`docker ps --filter label=com.docker.compose.project=s3-sso -q` empty).

## Baseline — measured 2026-10-25 on `083722f`

| What                            | Measured                                                                                                                                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `examples/`                     | absent (`ls examples` → no such directory) — GAP-063                                                                                                                                                                                                                                          |
| `build/` on a rewrite-less host | every manifest route answers its own `<route>/index.html`, `404.html` is the not-found document, data under `<base>data/` ([ADR-0029](../adr/0029-the-build-copies-its-shell-per-route-and-honors-an-absolute-base.md)) — the property an S3 bucket needs                                     |
| Docker                          | `docker --version` → `29.8.0`; no compose project exists for this repo                                                                                                                                                                                                                        |
| moto bucket policy              | "Basic policy enforcement is in place"; only statements with `Principal: *` are considered and **conditions are ignored** (https://docs.getmoto.org/en/latest/docs/services/s3.html) — so an `aws:SourceVpce` policy cannot be simulated                                                      |
| moto website API                | `put_bucket_website` implemented, `get_bucket_website` listed not implemented in the docs page, though `moto/s3/responses.py` routes `?website` to `get_bucket_website` (read via `gh api repos/getmoto/moto/contents/moto/s3/responses.py`); nothing documents serving index/error documents |
| moto auth                       | `INITIAL_NO_AUTH_ACTION_COUNT` unset "defaults to infinity, thus moto will never perform any authentication at all"; set, moto skips that many requests then authenticates; "the current implementation is very basic" (https://docs.getmoto.org/en/latest/docs/iam.html)                     |
| Project health                  | `gh api repos/<r>` + `/releases/latest`: moto `5.2.4` (2026-10-11), Caddy `v2.11.7` (2026-10-03), oauth2-proxy `v7.15.5` (2026-10-01), Keycloak `26.8.1` (2026-10-13), awslabs/aws-sigv4-proxy `v1.13.1` (2026-10-09, 470 stars); none archived                                               |

## Who else implements this

| Repo      | Has it  | Entry points                                                                                                    | Approach in one line                                                                                                                                                                                       |
| --------- | ------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | PARTIAL | `evidence/docs/self-host/authentication.mdx`, `evidence/docs/self-host/index.mdx`                               | documents the model — "deploy `evidence serve` behind an authenticating reverse proxy", proxy on a private network, built-in auth disabled — and lists proxies (oauth2-proxy, ALB, …); no runnable example |
| framework | ABSENT  | `framework/docs/deploying.md`                                                                                   | static hosts only; auth is the host's concern; no SSO, no bucket example                                                                                                                                   |
| mosaic    | ABSENT  | —                                                                                                               | no deployment or auth (`vite.config.docker.js` is a dev-server config; Docker is used only for screenshot tests in `mosaic/packages/vgplot/spec/README.md`)                                                |
| streamlit | PARTIAL | `streamlit/lib/streamlit/auth_util.py`, `streamlit/lib/streamlit/web/server/starlette/starlette_auth_routes.py` | in-app OIDC (`st.login`) — the model the owner did not take; no proxy example                                                                                                                              |

**Count:** 0 of 4 ship a runnable SSO deployment; 1 of 4 (evidence) documents the proxy model this slice proves. The example is an invention, justified by the owner decisions D11–D13 (2026-10-17) and the reorder of 2026-10-25: it is the executable evidence that a static `build/` deploys behind an ALB-shaped SSO edge with no biac code.

## Implementation inventory

`research_repos/` paths (verified with `test -e` 2026-10-25):

| Concern                        | Files                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User contract and warning text | `evidence/docs/self-host/authentication.mdx` (architecture, three steps, "Authentication controls who can reach the deployment; it does not scope what each user sees") |
| Static deploy contract         | `framework/docs/deploying.md`                                                                                                                                           |
| In-app OIDC (contrast only)    | `streamlit/lib/streamlit/auth_util.py`, `streamlit/lib/streamlit/web/server/starlette/starlette_auth_routes.py`                                                         |

No reference ships the configuration, so the rest of the inventory is upstream documentation, each fetched 2026-10-25:

| Concern                         | Source                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Caddy auth gate                 | https://caddyserver.com/docs/caddyfile/directives/forward_auth — 2xx grants and handling continues; any other status is copied back to the client; `copy_headers` on success                                                                                                                                                                         |
| Caddy ↔ oauth2-proxy            | `docs/versioned_docs/version-7.15.x/configuration/integrations/caddy.md` in oauth2-proxy/oauth2-proxy (read with `gh api … -H "Accept: application/vnd.github.raw"`): `handle /oauth2/*` → `reverse_proxy`, `forward_auth … { uri /oauth2/auth }`, `@error status 401` → `redir * /oauth2/sign_in?rd={scheme}://{host}{uri}`, `--reverse-proxy=true` |
| oauth2-proxy flags              | https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview — `--reverse-proxy`, `--set-xauthrequest`                                                                                                                                                                                                                                         |
| oauth2-proxy ↔ Keycloak         | https://oauth2-proxy.github.io/oauth2-proxy/configuration/providers/keycloak_oidc — `--provider=keycloak-oidc`, `--oidc-issuer-url=https://<host>/realms/<realm>`, `--code-challenge-method=S256`, `--allowed-role=<client>:<role>`, an Audience mapper so `aud` matches `--client-id`                                                               |
| Keycloak realm at boot          | https://www.keycloak.org/server/importExport — `start --import-realm` reads top-level `.json` from `/opt/keycloak/data/import`; an existing realm is skipped                                                                                                                                                                                         |
| moto                            | https://docs.getmoto.org/en/latest/docs/iam.html, https://docs.getmoto.org/en/latest/docs/services/s3.html, https://docs.getmoto.org/en/latest/docs/server_mode.html                                                                                                                                                                                 |
| SigV4 signing proxy             | https://github.com/awslabs/aws-sigv4-proxy — signs and forwards to `--host` with `--name s3 --region …`, `--upstream-url-scheme http` for a plain upstream; README builds the image locally (no published image named) — v1.10+ is a `scratch` image                                                                                                 |
| Entra claim shape and ALB facts | `docs/research/self-hosting.md` § Standards (Entra v2.0 claims; ALB `authenticate-oidc`, only `x-amzn-oidc-data` signed, `OnUnauthenticatedRequest: deny` → `401` for XHR)                                                                                                                                                                           |

## Trade-offs and what we adopt

| Axis                                    | Options seen                                                                                                                                                              | Trade-off                                                                                                                                                                                                                        | Our choice, and why                                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How Caddy reads an authenticated bucket | (a) SigV4 signing sidecar (`aws-sigv4-proxy`) between Caddy and moto; (b) bucket policy (`Principal: *` + condition) — AWS's VPC-endpoint pattern; (c) public-read bucket | (a) matches "every request needs credentials" and mirrors an ALB → signing Lambda/VPC endpoint path; one more container, image provenance to check. (b) moto ignores conditions, so it degenerates to public-read. (c) fails D11 | O1 — recommend (a), settled by T1's probe                                                                                                                         |
| Directory index                         | moto website endpoint (if it serves one); Caddy `rewrite` `/<route>/` → `/<route>/index.html` before the upstream                                                         | the website endpoint is the real-S3 behaviour but HTTP-only and public in AWS; the rewrite is one Caddy line and matches S3 REST + ALB                                                                                           | O2 — settled by T1's probe; recommend the Caddy rewrite (S3 REST behind the edge is the AWS shape for a private bucket)                                           |
| Base path                               | `/` (default `base`); a prefix (ADR-0029's absolute base)                                                                                                                 | `/` is the ALB-host shape; a prefix exercises `base` through the proxy                                                                                                                                                           | O3 — `/`; prefix covered already by SL-056's demo                                                                                                                 |
| Expired session on a data `fetch()`     | oauth2-proxy Caddy example redirects every `401` to sign-in; ALB `deny` answers XHR `401`                                                                                 | a `302` to an HTML sign-in page on a parquet range read surfaces as a DuckDB parse error                                                                                                                                         | O4 — measure what duckdb-wasm shows after the cookie is deleted; document it in the README; no biac code (biac reads no identity, D7)                             |
| IdP shape                               | Keycloak realm ≈ tenant, client ≈ app registration, client roles ≈ app roles                                                                                              | owner decision D13                                                                                                                                                                                                               | Keycloak realm JSON with mappers emitting `oid`, `tid`, `preferred_username`, `roles`; oauth2-proxy `keycloak-oidc` locally, `entra-id` documented for production |
| TLS                                     | Caddy internal CA for `localhost`; HTTP→HTTPS redirect by default                                                                                                         | browsers need the CA trusted or errors ignored                                                                                                                                                                                   | Caddy internal CA; the smoke script and `playwright-cli` ignore HTTPS errors; the README says how to trust the CA                                                 |

## Gap analysis — what we already have vs the references

| Concern                          | Ours today                                                                                              | Best reference                                    | Gap                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------- |
| Static output a bucket can serve | per-route `index.html`, `404.html`, absolute base (`src/cli/commands/build.ts`, ADR-0029)               | `framework/docs/deploying.md` (one HTML per page) | complete                            |
| Proxy model documented           | ADR-0030 consequences ("SSO is an upstream proxy's job; `BIAC_AUTH_DISABLED=true` behind such a proxy") | `evidence/docs/self-host/authentication.mdx`      | partial — no deploy doc, no example |
| Worked example                   | none                                                                                                    | none of the four                                  | absent (GAP-063)                    |
| Smoke proof                      | none                                                                                                    | none                                              | absent                              |

Our implementation is **absent**. No ledger row claims any of it shipped.

## Host constraints the executing session must respect

- `docker compose up`/`down` adds and removes `veth` interfaces; Chromium cancels in-flight requests on that (`AGENTS.md` § In this repository). Bring the stack up, wait until `journalctl -k --since -10min | grep -c veth` is stable a minute apart, then run the browser; never run `pnpm gate` or `pnpm test:e2e-browser` while the stack starts or stops.
- The smoke script is not part of `pnpm gate`: it needs Docker and network pulls. It gets its own script (`example:s3-sso:smoke`), bounded by `timeout` and `nice`, and tears its stack down on every exit path.
- Keycloak is a JVM: measure `MemAvailable` before `up`, and record `docker stats --no-stream` peak per service in the commit body.
- Images are pinned by digest, fetched in the task that adds them (`docker buildx imagetools inspect <image>:<tag>`); no `latest`.
- Nothing publishes moto, Keycloak's admin port or oauth2-proxy to the host; only Caddy binds `127.0.0.1:8080`/`127.0.0.1:8443`. Keycloak's browser-facing issuer must still be reachable by the browser — O5.

## Open decisions

| Id  | Decision                                                                                   | Settled by                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | How Caddy reads the bucket when moto requires credentials                                  | T1: moto with `INITIAL_NO_AUTH_ACTION_COUNT=0`; unsigned GET → expect `403`; signed GET via `aws-sigv4-proxy --name s3 --host moto:5000 --upstream-url-scheme http` → `200` and `206` on a range; confirm whether a published image exists (else build from the pinned `v1.13.1` tag) |
| O2  | Does moto answer `/<prefix>/` with the website index document, or only store the config    | T1: `put-bucket-website --index-document index.html`, then GET `/<bucket>/weekly-review/` on the REST and any website host form                                                                                                                                                       |
| O3  | Base path                                                                                  | proposal `/` — confirm in T3                                                                                                                                                                                                                                                          |
| O4  | What the viewer sees when the session expires mid-page                                     | T6: delete the `_oauth2_proxy` cookie, pick a filter, read console + screen                                                                                                                                                                                                           |
| O5  | Keycloak's issuer URL must be the same for the browser and for oauth2-proxy's back-channel | T4: route `/realms/*` through Caddy on the same origin (one issuer, `https://localhost:8443/realms/<realm>`) or a second Caddy site; oauth2-proxy `--oidc-issuer-url` must match the token `iss` exactly                                                                              |

Each settled decision that outlives the slice goes into the ADR (T7).

## Surface

| Layer  | Files                                                                                                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| engine | none expected — if O2/O3 force a build change, it is its own task with unit + e2e tests                                                                                                          |
| client | none — biac reads no identity header (D7)                                                                                                                                                        |
| ui     | none — the demo pages are the existing project                                                                                                                                                   |
| deploy | `examples/s3-sso/compose.yaml`, `examples/s3-sso/Caddyfile`, `examples/s3-sso/keycloak/realm.json`, `examples/s3-sso/oauth2-proxy.cfg`, `examples/s3-sso/upload.sh`, `examples/s3-sso/README.md` |
| tests  | `examples/s3-sso/smoke.ts` (playwright, headless) + `package.json` `example:s3-sso:smoke`; kept outside `pnpm gate`                                                                              |
| docs   | an ADR for the example's contract (private bucket, signing edge, SSO at the proxy); GAP-063 closed in `docs/research/self-hosting.md`                                                            |

## Tasks

One commit each. Each task that brings containers up ends with `down -v` and an empty `docker ps` for the project.

- [ ] T1 — Probes, no example yet: moto alone with auth enforced; record O1 (unsigned `403`, signed `200`/`206` through `aws-sigv4-proxy`, image provenance) and O2 (index-document behaviour) in this PRD's Baseline.
- [ ] T2 — `compose.yaml` with moto (no published port, `INITIAL_NO_AUTH_ACTION_COUNT=0`) and a one-shot uploader that creates the bucket and syncs `build/` on every start (D11: no durable state); healthchecks; label "local demonstration — not a production store".
- [ ] T3 — Caddy in front (internal TLS, HTTP→HTTPS, directory rewrite per O2, signer per O1): deep links, reload, `404.html`, parquet `206` — no auth yet, an interim step never shipped alone.
- [ ] T4 — Keycloak with an imported realm shaped like Entra (client = app registration, client role = app role, mappers for `oid`/`tid`/`preferred_username`/`roles`, audience mapper), one demo user; settle O5.
- [ ] T5 — oauth2-proxy (`keycloak-oidc`, PKCE, `--reverse-proxy`, `--allowed-role`) + Caddy `forward_auth` per the upstream example; `curl` without a session → `302` to sign-in.
- [ ] T6 — `smoke.ts`: headless sign-in, deep link, reload, a filter re-query with a `206`; settle O4; `example:s3-sso:smoke` script with `timeout` and teardown.
- [ ] T7 — `README.md` (run, trust the CA, the AWS mapping: Caddy ≈ ALB HTTPS listener + `authenticate-oidc`, moto ≈ private S3 REST endpoint, the signer ≈ the AWS path that signs; local `keycloak-oidc` vs production `entra-id` side by side; the all-or-nothing data warning, D8) + the ADR; close GAP-063.

## Out of scope

- The `biac serve` container image and its T1/T2 deployment guide — SL-058, next.
- A production object store, real AWS resources, Terraform/CDK.
- Reading the signed-in identity inside biac (D7) and per-viewer data access (D8: impossible with client-side queries).
