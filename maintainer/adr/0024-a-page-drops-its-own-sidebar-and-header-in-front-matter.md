# ADR-0024 — A page drops its own sidebar and header in front-matter, and stays listed

Status: accepted
Date: 2026-10-21

## Context

A page shown inside another site's `<iframe>` ([ADR-0022](0022-framing-is-denied-unless-the-project-lists-the-origin.md)) should show only its content: the site's sidebar, header and ToC rail belong to the site, not to the host that frames it. Before this decision the only switch was project-wide: `nav.sidebar: false` in `biac.config.ts` dropped the sidebar and the header together, for every page. `table_of_contents: false` already dropped the ToC rail per page.

The page module loads lazily, after the shell has rendered. Chrome read from the module would show the site's sidebar and header until the module arrived, inside someone else's page.

## Decision drivers

- An author makes one page chrome-less without changing any other page.
- No flash of chrome: an embed never shows the site's sidebar or header, not even on a throttled first load.
- The author decides how a page renders, not the reader.
- A mistyped switch fails loudly: a silently ignored `header: no thanks` leaves the site's chrome inside an embed.

## Options considered

| Question                      | Option                                      | Pro                                                                    | Con                                                                                                  |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| One switch or two             | One `embed`-style switch for all chrome     | One key to learn                                                       | A page that wants its header but no sidebar (or the reverse) cannot say so                           |
|                               | Independent `sidebar` and `header` booleans | Each piece of chrome is chosen on its own; mirrors `table_of_contents` | Two keys                                                                                             |
| Who sets it                   | Front-matter only                           | The author decides; the URL of a page always shows the same page       | A reader cannot strip the chrome to embed a page the author did not mark                             |
|                               | Also a query parameter (`?embed=true`)      | Any page embeddable without an edit                                    | Chrome becomes a reader-controlled switch; the same URL renders two ways                             |
| Where the switches are read   | The page module                             | No manifest change                                                     | Chrome shows until the module loads                                                                  |
|                               | The page manifest entry                     | Known before the page module loads                                     | The manifest carries two more fields per page                                                        |
| Which location decides chrome | The router's pending location               | Chrome changes as soon as a link is clicked                            | The page still shown loses its sidebar and header for as long as the next module loads               |
|                               | The router's resolved location              | Chrome changes in the same commit as the page it belongs to            | None found                                                                                           |
| Is a chrome-less page listed  | Hidden from the sidebar and search          | An embed-only page stays out of the site                               | Couples how a page renders to whether it is found; `index: false` already keeps a page out of search |
|                               | Listed like any other page                  | Chrome stays a rendering choice                                        | An embed-only page is reachable from the site                                                        |

## Decision

Front-matter `sidebar` and `header` are strict booleans, checked like `table_of_contents`: any other value is a located error naming the file, the key and the value (`src/engine/page-chrome-frontmatter.ts` `assertPageChrome`). There is no query parameter.

The page manifest entry carries them (`src/engine/discover-pages.ts`), so `AppShell` (`src/web/src/App.tsx`) knows a page's chrome before its module loads. Each switch a page sets wins over `nav.sidebar` key by key, and a switch it leaves out falls back to `nav.sidebar` (`src/web/src/features/chrome/page-chrome.ts` `resolvePageChrome`): `sidebar: true` brings the sidebar back on a project with `nav.sidebar: false`. A path no page serves keeps the project's chrome, so a reader can navigate away from the not-found page.

Chrome follows the router's resolved location (`usePageChrome`): on a first load nothing renders until the page module resolves, and on a client navigation the page still shown keeps its chrome until the next page replaces it.

The sidebar toggle belongs to the sidebar: `sidebar: false` removes it, and `header: false` with a sidebar keeps it as a floating button so the drawer below `lg` stays reachable.

A chrome-less page stays in the sidebar nav and in site search; `index: false` ([ADR-0021](0021-the-site-search-index-is-built-in-the-browser-from-served-page-text.md)) keeps a page out of search.

## Consequences

- A page is embeddable only after its author marks it; the same URL always renders the same chrome.
- An embed page is reachable from the site's sidebar and search, where it renders without the site's chrome; a reader leaves it with the browser's back button.
- Adding another piece of per-page chrome means adding a field to the manifest entry, not reading it from the page module.
- No footer or pager switch exists, because biac renders neither.
