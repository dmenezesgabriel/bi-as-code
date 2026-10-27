# ADR-0034 — `biac build` fails on a link to a page route no page serves

Status: accepted
Date: 2026-10-27
Relates to: [ADR-0029](0029-the-build-copies-its-shell-per-route-and-honors-an-absolute-base.md), [ADR-0033](0033-an-mdx-echo-fence-renders-then-shows-its-markup.md)

## Context

A link to a page that was renamed or never existed lands the reader on the not-found page. Nothing told the author until a reader clicked it. The build is the last step before a deploy, so that is where a broken link should stop one.

The facts that bind the design:

- `discoverPages` (`src/engine/discover-pages.ts`) is the single source of page routes. `buildStart` in `src/engine/pages-plugin.ts` already runs `assertRoutesBuildable` there, in the build only, before any loader runs or any file is written.
- `ProseLink` (`src/web/src/features/pages/prose-elements.tsx`) sends every `/`-rooted href through the SPA router. A `/data/…` href is no exception, so it lands on the not-found page like any other unknown route.
- The router writes every page URL with a trailing slash (`PAGE_URL_TRAILING_SLASH`, `src/web/src/features/pages/route-of-pathname.ts`), and ADR-0029 serves each route from its own `index.html` copy. A hand-typed URL may lack the slash. A browser resolves a relative href against the URL's directory (https://url.spec.whatwg.org/#concept-basic-url-parser). Measured with `a.href` in dev and in preview: `x` on `/nested/page` resolves to `/nested/x`, and on `/nested/page/` to `/nested/page/x`. One relative href has two targets.
- Heading ids are assigned in the browser (`collectTocHeadings` / `slugifyHeading`, `src/web/src/features/chrome/toc-headings.ts`). The engine cannot see them.
- An ` ```mdx echo ` fence renders markup that exists only after `remarkSpliceMdxEcho` runs (ADR-0033).

## Decision drivers

- A broken link fails the deploy, not the reader.
- The error names the page file, the line and the target, and lists every broken link at once.
- A failed build leaves no half-written `build/`.
- `biac dev` keeps rendering while the author edits.

## Options considered

| Axis            | Option                                                          | Pro                                                   | Con                                                                                       |
| --------------- | --------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Fail or warn    | Fail the build                                                  | No broken link ships                                  | One typo blocks a deploy                                                                  |
| Fail or warn    | Warn with a count                                               | Never blocks                                          | Broken links ship to readers                                                              |
| When it runs    | `buildStart`, over each page's parsed tree                      | Fails before loaders and bundling; nothing is written | Each page is parsed once more                                                             |
| When it runs    | After bundling, over the emitted HTML                           | Sees the final markup                                 | Runs after the whole build; this SPA's HTML shell holds no page links                     |
| Targets         | Page routes only                                                | Matches what the engine knows                         | A `#anchor` to a missing heading is not caught                                            |
| Targets         | Page routes and `#anchor`s                                      | Catches stale anchors                                 | Needs the browser's heading-id rule in the engine                                         |
| Relative hrefs  | Reject; require `/`-rooted                                      | One href, one target                                  | An author cannot write `../x`                                                             |
| Relative hrefs  | Resolve against the page route                                  | Shorter links                                         | The check would pass a link the browser resolves elsewhere when the trailing slash is off |
| Sources scanned | Markdown `link`, reference `definition`, literal JSX `<a href>` | Every link a page renders with a value known at build | An expression-valued `href` is unchecked                                                  |

## Decision

- **Where**: `assertInternalLinksResolve` (`src/engine/internal-links.ts`) runs in `buildStart`, right after `assertRoutesBuildable` and before the data loaders. It never runs under `biac dev`, where a broken link still lands on the not-found page.
- **Targets**: the routes `discoverPages` returns. A `/`-rooted href is checked on its pathname, with `#anchor`, `?query` and a trailing slash set aside and %-escapes decoded. Hrefs with a scheme (`https:`, `mailto:`), protocol-relative `//host`, `#anchor`, `?query` and empty hrefs are not page links and are skipped. `/data/…` is not exempt.
- **Relative hrefs**: rejected, with a reason that says to write the link `/`-rooted.
- **Sources**: markdown links, reference definitions and `<a>` elements with a literal `href`, including those an ` ```mdx echo ` fence renders, at their page-file lines. The collector runs `remarkGfm` and `remarkSpliceMdxEcho` before it, in the same order as the page compiler. A plain code fence's content is never scanned. A page that does not compile contributes no links, because its own compile error fails the build.
- **Report**: one error that lists every broken link as `pages/<file>:<line> → <href> (<reason>)`. For example, `1 broken internal link — each must name a page route:` followed by `pages/nested/page.md:12 → /no-such-page (no page serves this route)`.

## Consequences

- A typo in a page link stops `biac build` with the file and line, and no `build/` is written. Measured on the 10 example pages: the check takes 0.29 s wall and 107 MB max RSS.
- Links to `#anchor`s are not checked until heading ids are assigned in the engine.
- An internal link must be written `/`-rooted. A link to a data file is broken in the app today and is reported as such.
