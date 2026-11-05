# A biac build in a private S3 bucket behind single sign-on

**Local demonstration — not a production store.** This directory holds the compose stack ([ADR-0031](../../maintainer/adr/0031-sso-is-a-proxy-in-front-of-a-private-bucket.md)): a private bucket, a TLS edge, a sign-in gate and an identity provider shaped like a Microsoft Entra ID tenant, with the Terraform, Caddy, oauth2-proxy and Keycloak files that configure them.

The guide — the request path, the demo users, the mapping to AWS and Entra ID, what sign-in protects and what happens when a session expires — is `docs/pages/ship/sso-behind-a-proxy.md`, served at `/ship/sso-behind-a-proxy` by `bin/biac dev docs`.

```sh
# From the repository root
pnpm build:cli && bin/biac build
docker compose -f examples/s3-sso/compose.yaml up -d --wait   # https://localhost:8443/weekly-review/
pnpm -s example:s3-sso:smoke                                    # or, unattended: up, sign in, check, down
docker compose -f examples/s3-sso/compose.yaml --profile probe down -v
```
