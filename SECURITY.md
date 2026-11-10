# Security Policy

`biac` serves and builds pages from a project directory. Its `dev` command writes page files back to disk, and its `dev` and `preview` commands decide which other sites may frame the pages or read the data files. Those boundaries are the highest-priority bug class in this project:

- The page-source endpoint of `biac dev` accepting a write from an origin that is not the dev server's own, or touching a file outside `pages/` ([ADR-0010](maintainer/adr/0010-page-authoring-is-dev-server-only.md)).
- A page being framed by a site that `embed.origins` does not list ([ADR-0022](maintainer/adr/0022-framing-is-denied-unless-the-project-lists-the-origin.md)).
- A `/data/` file being readable cross-origin by a site that `embed.dataOrigins` does not list ([ADR-0025](maintainer/adr/0025-data-files-are-readable-cross-origin-only-by-listed-origins.md)).
- A widget module being importable by a site that `embed.dataOrigins` does not list ([ADR-0027](maintainer/adr/0027-a-widget-module-is-importable-only-by-listed-data-origins.md)).
- A static build containing the page editor or a write path ([ADR-0010](maintainer/adr/0010-page-authoring-is-dev-server-only.md)).

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

- Use GitHub private vulnerability reporting: open the repository's [Security advisories](https://github.com/dmenezesgabriel/bi-as-code/security/advisories) page and choose **Report a vulnerability**.
- If that channel is unavailable, contact the maintainer through the GitHub profile that owns this repository, <https://github.com/dmenezesgabriel>.

Include what you observed, the commit you ran (`git rev-parse HEAD`), `node --version`, and a minimal reproduction. Never include real credentials, tokens or private data files in a report.

## Scope and expectations

- The latest commit on `master` and the latest release of [`@biac/cli`](https://www.npmjs.com/package/@biac/cli) on npm are in scope. Only the latest release is patched.
- `biac dev` is a local authoring tool. Exposing it to a network, or running it as a public server, is outside its threat model; use `biac build` and serve the static folder instead.
- Reports are acknowledged within a few days. Fixes land as ordinary commits; a GitHub security advisory is published once a fix is available.
