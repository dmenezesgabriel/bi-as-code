# ADR-0038 — `biac build` fails on an image no file serves

Status: accepted
Date: 2026-11-11
Relates to: [ADR-0034](0034-biac-build-fails-on-a-broken-internal-page-link.md), [ADR-0033](0033-an-mdx-echo-fence-renders-then-shows-its-markup.md)

## Context

A page that shows `![alt](/data/gone.png)` builds and ships a broken image when no file answers that path. Nothing told the author until a reader saw the gap. A link to a missing page already stops the build (ADR-0034); an image is the same mistake and the build is the same last step before a deploy.

The facts that bind the design:

- `data/` is the one project folder served at a path. `biac dev` reads it from disk, `biac build` copies it, unhashed, to `build/data/` (`copyDataDir`, `src/engine/build-data-dir.ts`) and leaves out each loader source. No `publicDir` is set anywhere in `src/`, so a root-relative path outside `/data/` is served by nothing.
- A data loader's output (`island-summary.csv` from `island-summary.csv.js`) is generated after `buildStart`, so the check lists those outputs from the loader sources (`listDataLoaderTargets`, `src/engine/data-loader.ts`) instead of looking for the files.
- `ProseImage` (`src/web/src/features/pages/prose-elements.tsx`) adds the `base` to a `/`-rooted `src` and leaves every other address as written. A relative `src` resolves against the page URL, whose trailing slash a hand-typed URL may lack (ADR-0034).
- `biac preview` answers a path that names no file with the SPA's `text/html` fallback, so an image at that path does not load.
- A reference definition (`[img]: /data/x.png`) is a link or an image only by how the page uses it. The link collector of ADR-0034 read every definition as a link.
- An ` ```mdx echo ` fence renders markup that exists only after `remarkSpliceMdxEcho` runs (ADR-0033).

## Decision drivers

- A missing image fails the deploy, not the reader, with the same error shape as a broken link.
- The error names the page file, the line and the source, and lists every broken image at once.
- A failed build leaves no half-written `build/`.
- `biac dev` keeps rendering while the author edits.
- The cost of the check does not grow with each kind of reference.

## Options considered

| Axis                | Option                                                           | Pro                                                        | Con                                                                                              |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Fail or warn        | Fail the build                                                   | No broken image ships; one rule for links and images       | One typo blocks a deploy                                                                         |
| Fail or warn        | Warn with a count                                                | Never blocks                                               | A broken image ships to readers                                                                  |
| When it runs        | `buildStart`, over each page's parsed tree                       | Fails before loaders and bundling; nothing is written      | Each page is parsed once more                                                                    |
| When it runs        | After bundling, over the emitted HTML                            | Sees the final markup                                      | This SPA's HTML shell holds no page markup, so it sees no image                                  |
| What exists         | The `data/` tree without loader sources, plus the loader targets | The set the built site ships                               | A file that a loader writes into `data/` by side effect is not listed                            |
| What exists         | Check the disk for the path                                      | Simple                                                     | A loader output does not exist yet at `buildStart`, and a loader source exists but is not copied |
| Relative `src`      | Reject; require `/`-rooted                                       | One `src`, one target; the rule an author learns for links | An author cannot write `x.png`                                                                   |
| Relative `src`      | Resolve against the page route                                   | Shorter paths                                              | One `src` has two targets depending on the trailing slash                                        |
| Other root-relative | Report as not served                                             | A path that names no served file is broken the same way    | None found                                                                                       |
| One compile or two  | One collector pass returns links and images                      | The cost does not double; no duplicated walk               | The collector has two outputs                                                                    |
| One compile or two  | A second collector for images                                    | Separate files                                             | A second `compile` per page and a duplicated tree walk                                           |

## Decision

- **Where**: `assertImagesResolve` (`src/engine/image-sources.ts`) runs in `buildStart` right after `assertInternalLinksResolve` and before the data loaders. It never runs under `biac dev`, where a broken image still renders broken.
- **Sources**: markdown images, reference-style images through their definition, and `<img>` elements with a literal `src`, including those an ` ```mdx echo ` fence renders, at their page-file lines. `pageReferences` (`src/engine/page-references.ts`) returns links and images from one compile pass, so the page is compiled once per pass. An expression-valued `src` is unchecked.
- **Definitions**: a definition used only by `![alt][ref]` is an image and is no longer reported as a broken page link. One used by a link reference, or by nothing, stays a link; one used by both is both. Reading the old collector predicted the defect, and the first unit test over `![a][r]` with `[r]: /data/x.png` confirmed it.
- **Skipped**: a scheme (`https:`, `data:`), protocol-relative `//host`, a `#fragment` or `?query` alone, and an empty `src` name no file this project ships.
- **Relative `src`**: rejected, with the reason ADR-0034 gives for a relative link: write it `/`-rooted.
- **Other root-relative paths**: a path outside `/data/` is reported as `only data/ is served`.
- **What exists**: `servedDataPaths` lists the files of the real `data/` tree that are not loader sources, plus `listDataLoaderTargets`. A `/data/` path that climbs out of the folder is absent from that set and is reported without a separate containment test. `?query` and `#fragment` are ignored and the rest is %-decoded.
- **Case**: the match is exact. `biac preview` answers `/data/Page-Routes.svg` with the `text/html` fallback when the file is `page-routes.svg`, so the image would not load there, and it would not on a case-sensitive host either.
- **Out of scope**: `srcset`, `<picture>` and `<source>`. None is used by `docs/`, `pages/` or the example projects, so they stay unchecked until one is.
- **Report**: one error that lists every broken image as `pages/<file>:<line> → <src> (<reason>)`. For example, `1 broken image — each must name a file biac serves:` followed by `pages/index.md:3 → /data/gone.png (no file at data/gone.png)`.

## Consequences

- A typo in an image path stops `biac build` with the file and line, and no `build/` is written. Measured on the 48 pages of `docs/`: the image pass takes 0.56 s next to the link pass's 0.58 s, in a build of about 6 s.
- An image must be written `/data/<file>`, with the file's case. An image elsewhere in the project folder is reported, not served.
- A loader source named as an image (`/data/island-summary.csv.js`) fails, because the source is never copied. Its output (`/data/island-summary.csv`) passes.
- `srcset`, `<picture>`, `<source>` and an expression-valued `src` are not checked.
- A broken image still renders under `biac dev`.
