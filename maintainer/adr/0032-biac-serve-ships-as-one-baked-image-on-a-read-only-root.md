# ADR-0032 — `biac serve` ships as one baked image that runs as uid 10001 on a read-only root

Status: accepted
Date: 2026-10-26
Relates to: [ADR-0030](0030-biac-serve-is-env-basic-auth-that-fails-closed-beyond-localhost.md), [ADR-0031](0031-sso-is-a-proxy-in-front-of-a-private-bucket.md)

## Context

ADR-0030 gave biac a production server, `biac serve`, that refuses to bind beyond localhost without credentials or an explicit opt-out. A deployer on a container platform (ECS on Fargate behind an ALB, or any host that runs an image and sets `$PORT`) still needs an image to run, and that image has to fit the platform's hardening and health-check model without new biac code. The image is `Dockerfile` at the repository root. `test/deploy/serve-image.deploy.test.ts` (`pnpm test:deploy`) proves it, and `docs/pages/ship/deploy-on-aws.md` explains how to deploy it.

The facts that bind the design:

- The OWASP Docker Security Cheat Sheet asks for a non-root user ("RULE #2 - Set a user"), `--cap-drop all` ("RULE #3 - Limit capabilities"), `--security-opt=no-new-privileges` ("RULE #4 - Prevent in-container privilege escalation") and `--read-only` ("RULE #8 - Set filesystem and volumes to read-only") (https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html).
- An ECS container definition maps `readonlyRootFilesystem` to `--read-only` (default `false`) and `user` to `--user`. `stopTimeout` defaults to 30 s on Fargate, with a maximum of 120 s. `dockerSecurityOptions`, the only field that carries `no-new-privileges`, "isn't valid for containers in tasks using the Fargate launch type" (https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_ContainerDefinition.html). `linuxParameters.capabilities` is supported on Fargate for every platform version (https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_LinuxParameters.html).
- An ALB target group's `Matcher` accepts any of 200–499 as success, with `200` as the default and `/` as the default `HealthCheckPath`. A target group whose targets are all unhealthy fails open (https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html).
- `biac serve` reads `biac.config.ts` at boot. vite's default `"bundle"` config loader writes a temporary `.mjs` under `node_modules/.vite-temp` (or beside the config), which a read-only root refuses. Its `"runner"` loader transforms in memory, so `src/engine/biac-config.ts` loads with `"runner"`. `src/cli/commands/serve.ts` passes `configFile: false`, so `serve` never imports the web build's plugins, which are devDependencies.
- `biac serve` runs vite `preview()`. vite installs its own SIGTERM listener, which closes the server and exits `128 + 15`. A container stopped by `docker stop` therefore exits `143`, not `0`, in well under the 10 s kill timeout.
- `node:24-slim` ships no `curl` or `wget` and already has a `node` user at uid 1000.

## Decision drivers

- The image boots with no writable path at all, so a platform's read-only root needs no tmpfs or volume.
- Every OWASP rule a platform can enforce is checked by a test, not just recommended.
- Every path stays authenticated (ADR-0030), so no unauthenticated health route exists.
- The image honors the `$PORT` a PaaS assigns and stops cleanly on the signal the orchestrator sends.
- The runtime holds only what serving needs: no compiler, no data loader interpreter, no devDependency.

## Options considered

| Axis                                | Option                                                                       | Pro                                                                                            | Con                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| How the project gets into the image | Bake: one multi-stage build that runs `biac build` and copies `build/` in    | The image is the deployable unit; nothing is mounted or writable                               | A content change is a rebuild and a redeploy                                                                |
| How the project gets into the image | A generic image that mounts the project at runtime                           | One image for every project                                                                    | Needs a volume, which on Fargate means EFS; the served files live outside the image's provenance            |
| Which project is baked              | A `project` named build context, defaulting to the repository root           | No copy: the project stays beside the clone; plain `docker build` still bakes the root project | Needs BuildKit for `--build-context`                                                                        |
| Which project is baked              | A build argument naming a subdirectory of the context                        | Plain `docker build`                                                                           | The project has to be copied into the clone first                                                           |
| Production install                  | `pnpm install --prod --frozen-lockfile --ignore-scripts --filter bi-as-code` | Holds `i18next`, `vite` and `yaml` only; runs no install script; needs no pnpm setting         | The runtime image keeps `package.json` for module resolution                                                |
| Production install                  | `pnpm deploy --prod`                                                         | Purpose-built                                                                                  | Refuses a non-injected workspace (`ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE`) and copies the whole source tree |
| Non-root user                       | A new user at uid 10001                                                      | Does not collide with the first login uid on a Linux host                                      | One `useradd` line                                                                                          |
| Non-root user                       | The base image's `node` user (uid 1000)                                      | Already there                                                                                  | uid 1000 is the first login uid on most Linux hosts, so a shared volume maps to a real person               |
| Port and signals                    | Shell-form `CMD` with `exec … --port ${PORT:-3000}`                          | Honors a PaaS `$PORT`; `exec` keeps `node` as PID 1, so SIGTERM reaches it                     | A shell is in the image                                                                                     |
| Port and signals                    | Exec-form `CMD` with a fixed port                                            | No shell                                                                                       | `$PORT` is ignored                                                                                          |
| Health check                        | The ALB's `Matcher`: `401` on `/` under basic auth, `200` with auth disabled | No new route; every path stays authenticated; the check exercises the real auth path           | A target answering `401` for the wrong reason still counts as healthy                                       |
| Health check                        | An unauthenticated health endpoint                                           | One success code everywhere                                                                    | A path that answers before auth, which ADR-0030 rules out                                                   |
| Health check                        | A Docker `HEALTHCHECK`                                                       | Visible in `docker ps`                                                                         | The base has no `curl`; on ECS the orchestrator's check is the ALB's                                        |
| Base image                          | `node:24-slim` pinned by index digest                                        | Matches `engines.node`; reproducible; pinning is an OWASP check                                | A base update is an explicit digest bump                                                                    |

## Decision

A biac project ships as one image built by the `Dockerfile` at its root:

- **Stages**: `base` enables corepack's pnpm at `packageManager`'s version and copies only the manifests, so install layers cache across source edits. `build` installs the workspace (with `python3` for data loaders), runs `pnpm build:cli`, copies the `project` stage to `/project`, runs `biac build /project`, and stages the project's `build/` and, when it has one, `biac.config.ts` under `/served/`, world-readable. This matters because `COPY` keeps build-context modes, and a `0600` file would crash the server with `EACCES`. `prod-deps` runs the production install above. The runtime stage copies `package.json`, `node_modules/`, `bin/`, `dist/` and `/served/` (`build/` and `biac.config.ts`), all owned by root.
- **Project**: the `project` stage is a `scratch` copy of the build context, so the image bakes the repository's own project by default. `docker build --build-context project=<dir>` replaces that stage with `<dir>`, which bakes a project that lives beside the clone, such as the one Getting started creates. That project needs no `biac.config.ts`, because `biac serve` falls back to the defaults without one.
- **User**: `useradd --uid 10001`, then numeric `USER 10001`, so an orchestrator can verify that the user is non-root without `/etc/passwd`.
- **Filesystem**: no path in the runtime needs to be writable. The image is run with `--read-only`, `--cap-drop ALL` and `--security-opt no-new-privileges:true`. On ECS those map to `readonlyRootFilesystem: true`, `user: "10001"` and `linuxParameters.capabilities.drop: ["ALL"]`. `no-new-privileges` is available on ECS on EC2 only.
- **Command**: `CMD ["sh", "-c", "exec node bin/biac serve /app --host 0.0.0.0 --port ${PORT:-3000}"]`, with `EXPOSE 3000`. The non-loopback host makes ADR-0030's boot guard mandatory: with no credentials and no `BIAC_AUTH_DISABLED=true`, the container exits `1` and names all three variables.
- **Health**: no endpoint and no `HEALTHCHECK`. The ALB target group checks `/` with `Matcher` `401` when `biac serve` runs basic auth, and `200` when the ALB authenticates and `BIAC_AUTH_DISABLED=true`.
- **Proof**: `test/deploy/serve-image.deploy.test.ts` builds the image and runs it with the three hardening flags. It checks the boot refusal, `401`/`200`, `$PORT`, uid `10001`, a refused write under `/app`, both parquet files readable, and a `143` stop in under 5 s. A second image, built with `--build-context project=<dir>` from a directory with no `biac.config.ts`, must serve that project's page and data file and none of the repository's own pages. It needs Docker, so it runs under `pnpm test:deploy`, outside `pnpm gate`.

## Consequences

- An owner deploys with `docker build` plus two environment variables, and the same image passes Fargate's and plain Docker's hardening flags unchanged.
- Every content change is a rebuild. The image is 669 MB on disk with Python absent from the runtime, and the data loaders run only at build time.
- An orchestrator should treat exit `143` as a clean stop. ECS's default 30 s `stopTimeout` is far above the measured stop time.
- On Fargate the runtime carries no `no-new-privileges` flag. A non-root user with every capability dropped is the protection that remains.
- Upgrading Node means bumping the base digest in both `FROM` lines.
- vite remains a production dependency, because `biac serve` is vite `preview()`.
