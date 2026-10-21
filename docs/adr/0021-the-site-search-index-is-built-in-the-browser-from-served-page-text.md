# ADR-0021 — The site search index is built in the browser from page text the engine serves

Status: accepted
Date: 2026-10-21

## Context

A reader searches every page from a box at the top of the sidebar (`src/web/src/features/search/site-search.tsx`, mounted by `src/web/src/features/chrome/sidebar-nav.tsx`). Something has to turn each page's title, text and front-matter `keywords` into a ranked full-text index, and get it to the browser.

`biac build` emits a folder of static files with no server ([ADR-0008](0008-static-build-is-a-spa-folder.md)), so there is no search endpoint to query: whatever answers a query runs in the browser. A page edit in `biac dev` updates the open page without a reload ([ADR-0009](0009-page-edits-hot-update-without-a-reload.md)), and a stale index would contradict that. Page text can be written in several languages, chosen in the browser ([ADR-0020](0020-the-page-language-is-chosen-in-the-browser-and-translations-bind-in-sql.md)). The results list follows the WAI-ARIA combobox pattern (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).

## Decision drivers

- A project that never searches pays nothing for search but the box.
- `biac dev` and a static build rank the same query the same way.
- Saving a page, adding one, or changing its `index`/`keywords` updates search with no reload.
- A reader finds a page in the language they are reading it in, and not in one they are not.
- One copy of the ranking options and term processing, used for indexing and querying alike.

## Options considered

| Option                                                                        | Pro                                                   | Con                                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hand-written index and scoring                                                | No dependency                                         | Re-implements BM25, prefix and fuzzy matching, and gets them subtly wrong                                                                                                                 |
| MiniSearch, index serialized at build time (`toJSON`/`loadJSON`)              | No indexing work in the browser                       | The engine imports a web dependency, the index options live on both sides, and a serialized index is larger than the text it indexes                                                      |
| MiniSearch, index built in the browser on first focus from plain documents    | One copy of the options, beside the one import site   | Indexing runs on the reader's machine: measured 2.4 ms for the example's 8 pages and 67.3 ms median (71.6 ms max, 7 runs) for 200 pages of 400 words (677,181 bytes), Node 24, 2026-10-21 |
| One document set holding every language                                       | One set to build                                      | A French word finds a page the reader is viewing in English                                                                                                                               |
| One document set per declared language, chosen by the page's current language | Results match what the reader sees; `?lang=` switches | Every language ships in the one chunk: 18.17 kB, 3.97 kB gzip for the example's two languages                                                                                             |

## Decision

MiniSearch (`minisearch` 7.2.0, MIT, no dependencies, https://github.com/lucaong/minisearch) builds the index in the browser. It is imported only by `src/web/src/features/search/page-index.ts`, enforced by the `.dependency-cruiser.cjs` rule `page-search-only-behind-its-wrapper`. `buildPageIndex` there holds the one copy of the options: fields `title`, `text` and `keywords`, with `title` and `keywords` boosted ×4, `fuzzy: 0.15` and `prefix: true`. Its `searchTerm` NFD-folds accents, lower-cases, cuts terms to 15 characters, and drops terms with more than 6 digits.

The engine serves plain documents as `virtual:biac-search` (`src/engine/search-module.ts`). The router imports that module on first focus of the box, so `biac build` emits it, and the MiniSearch chunk, apart from the entry. Each document is a page's route, its sidebar label (`pageNavName`, `src/engine/nav-tree.ts`), its text and its `keywords`. The text is the page's mdast `text` and `inlineCode` (headings, paragraphs, lists, table cells and the children of layout elements). It skips code fences and every JSX element with a `data` attribute, since those show query output rather than prose (`src/engine/page-search-text.ts`).

There is one document set per declared language: each page is parsed once (`pageProse`) and `{$translations.key}` is resolved per language (`proseText`). The module exports `searchDocumentsFor(language)`, and the box reads the page's current language, so `?lang=` and the language menu switch it. A project without `translations.yaml` has one set. In dev the module is a self-accepting store (`src/engine/hot-store-source.ts`), rebuilt when a page changes.

Front-matter `index: false` keeps a page out of search but leaves its sidebar link. `keywords` (a string or a list of strings) adds terms with the title's boost. Any other shape is a located error (`assertPageSearchFields`, `src/engine/page-search-frontmatter.ts`). The box shows whenever the sidebar does; there is no `search` setting.

## Consequences

- A reader who never focuses the box downloads none of search's code or documents.
- Indexing cost grows with the project's text and is paid on first focus. If a project's indexing crosses about 100 ms, the next step is a Web Worker or a build-time serialized index. The options stay in `page-index.ts` either way.
- Text a page shows only through a query result (a table cell or a `<Value>`) is not searchable; `keywords` is how an author adds such terms.
- A result is named by its sidebar label, which is not translated, so a French search lists the page under its English label.
- Every declared language rides in one chunk. A project with many languages and much text should split the chunk per language.
