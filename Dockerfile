# One image per biac project: the builder compiles the CLI and runs
# `biac build`; the runtime serves that build/ with `biac serve`.
#
#   docker build -t biac-serve .
#
# That bakes this repository's own project. To bake another directory (a
# Getting-started project next to the clone), name it as the `project` build
# context:
#
#   docker build --build-context project=../my-site -t biac-serve .
#
#   docker run --read-only --cap-drop ALL \
#     --security-opt no-new-privileges:true -p 3000:3000 \
#     -e BIAC_BASIC_USER=viewer -e BIAC_BASIC_PASSWORD=... biac-serve
#
# The runtime needs no writable path, so it boots on a read-only root.

# node:24-slim (bookworm, Node 24.22.1), pinned by index digest.
FROM node:24-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS base
WORKDIR /app
# corepack provides the pnpm that package.json's packageManager names.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
# The manifests alone, so the install layers cache across source edits.
# pnpm-workspace.yaml carries minimumReleaseAge, trustPolicy and allowBuilds.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY src/web/package.json src/web/

# The project to bake: this repository's own, unless a `project` build
# context replaces this stage (--build-context project=<dir>).
FROM scratch AS project
COPY . /

FROM base AS build
# `biac build` runs every data loader under data/; the example project's
# include a Python one. The runtime serves the built output and runs none.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 \
  && rm -rf /var/lib/apt/lists/*
# HUSKY=0: the prepare script installs git hooks, and there is no .git here.
RUN HUSKY=0 pnpm install --frozen-lockfile
COPY . .
RUN pnpm build:cli
COPY --from=project / /project
# `served/` is what the runtime needs from the project: its build/ and, when
# it has one, biac.config.ts (a Getting-started project has none). COPY keeps
# each file's mode from the build context, where a file may be readable by its
# owner only (0600); the runtime user owns none of them, and sirv inside vite
# preview crashes the server on a file it cannot open.
RUN node bin/biac build /project \
  && mkdir /served && cp -r /project/build /served/build \
  && if [ -f /project/biac.config.ts ]; then cp /project/biac.config.ts /served/; fi \
  && chmod -R a+rX /served

FROM base AS prod-deps
# `biac serve` imports vite and the root's runtime dependencies only;
# no install script of theirs is needed to serve a finished build.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --filter biac

FROM node:24-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
WORKDIR /app
# uid 10001, not the image's `node` user: uid 1000 is the first login uid
# on most Linux hosts, so a bind mount or shared volume would map to it.
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin biac
# Owned by root and read-only to uid 10001.
COPY --from=prod-deps /app/package.json ./
COPY --from=prod-deps /app/node_modules/ node_modules/
COPY --from=build /app/bin/ bin/
COPY --from=build /app/dist/ dist/
COPY --from=build /served/ ./
# Numeric, so an orchestrator can verify a non-root user without /etc/passwd.
USER 10001
EXPOSE 3000
# Shell form so a PaaS-provided $PORT is honored; `exec` replaces the shell
# so node is PID 1 and receives the SIGTERM `docker stop` sends.
# A non-loopback --host makes BIAC_BASIC_USER/BIAC_BASIC_PASSWORD (or an
# explicit BIAC_AUTH_DISABLED=true) mandatory at boot.
CMD ["sh", "-c", "exec node bin/biac serve /app --host 0.0.0.0 --port ${PORT:-3000}"]
