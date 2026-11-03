---
title: Sidebar, table of contents and breadcrumbs
icon: folder
sidebar_position: 103
keywords:
  [
    sidebar,
    navigation,
    nav,
    table of contents,
    contents rail,
    on this page,
    breadcrumbs,
    drawer,
    toggle,
    headings,
    anchor,
  ]
---

# Sidebar, table of contents and breadcrumbs

Three pieces of chrome help a reader find their way: the sidebar lists the site's pages, the contents rail lists the headings of the page on screen, and the breadcrumbs show where that page sits. This page you are reading shows all three. It describes how each one is built and what a reader can do with it. The front-matter and config keys that switch them are on [Markdown pages and front-matter](/pages/markdown-pages) and [biac.config.ts](/pages/biac-config).

## The sidebar

The sidebar is built from the files under `pages/`, with no list to maintain. From top to bottom it holds:

1. The site name, which links to the home page. It is the `title` in `biac.config.ts`.
2. The search box.
3. The pages directly under `pages/`, as links.
4. One collapsible group for each folder directly under `pages/`.

```text
pages/
  index.md              Home, always first
  getting-started.md    a link at the top level
  sales/
    weekly.md           a link inside the Sales group
    monthly.md
```

A link shows the page's `title`, or the file name with its dashes turned into spaces and each word capitalised, and the page's `icon` before it. The page on screen is marked `aria-current="page"` and drawn in a stronger weight. A group is named after its folder, or by its `directories` entry in `biac.config.ts`. Only the first folder makes a group: `pages/sales/europe/weekly.md` is listed in Sales, not in a group of its own.

The order within the top level and within each group comes from `sidebar_position`, lowest first, then by name. Groups appear in the order of their first page.

## Groups and their state

A group opens by default when it holds the page on screen, so a reader always sees where they are. Clicking a group's name opens or closes it. That choice is kept for the browser tab: it survives a reload and every later page, and it takes priority over the default. A new tab starts from the defaults again.

The group's state is kept in the tab's `sessionStorage`, under `biac.sidebar.dirs`, keyed by the folder name. Renaming a group in `directories` therefore keeps a reader's choice, and renaming the folder resets it. A browser that blocks storage still shows a working sidebar, and the choices last until the page reloads.

## Showing and hiding the sidebar

The ☰ button, named Toggle sidebar, shows and hides the sidebar. It reports its state in `aria-expanded`.

| Window width     | The sidebar is                  | The choice                                                     |
| ---------------- | ------------------------------- | -------------------------------------------------------------- |
| 1024 px or wider | beside the content, 18 rem wide | kept for the tab in `sessionStorage` under `biac.sidebar.open` |
| under 1024 px    | a drawer over the content       | forgotten: the drawer starts closed on every page              |

A drawer closes when the reader follows a link, taps the dimmed area behind it, or presses Escape. Pressing the search shortcut shows a hidden sidebar for the moment, so the search box can take focus.

`nav.sidebar: false` in `biac.config.ts` removes the sidebar and its button from every page. A page's own `sidebar: true` or `sidebar: false` front-matter overrides the project for that page. When a page keeps the sidebar but drops the header with `header: false`, the toggle stays as a small floating button in the top left corner, so a phone reader can still open the drawer.

## The contents rail

The contents rail sits on the right of the page under the name "On this page". It lists the page's `##` and `###` headings, and a `###` is indented under the `##` above it. Each entry links to its heading with a `#` anchor.

### What it lists

The rail reads the headings of the finished page, so a heading produced by a component or an `mdx` block counts too. Three kinds of heading stay out of it: a `#`, since that is the page's title; a `####` or deeper; and the title of an accordion item, which is a widget's own label and not a section.

```md
## Revenue

### By region

### By region
```

### Anchors

Every heading needs an anchor. A heading that sets its own `id` keeps it. Any other heading gets one made from its text: lower case, punctuation dropped, and each run of spaces, dashes and underscores turned into one dash. The example above gets `revenue`, `by-region` and `by-region-1`: a repeat gets the next free number, so no two anchors collide.

### Following the reader

The rail follows the reader. The entry for the section nearest the middle of the window is drawn stronger, with a bar beside it, and `aria-current="location"` marks it. Until the first heading reaches the middle, the first entry is current. Opening a link that ends in a heading's anchor makes that heading's entry current for as long as the heading sits where the jump put it.

### When it shows

The rail shows when it has something to show and room to show it:

| Condition                                          | Result                                                  |
| -------------------------------------------------- | ------------------------------------------------------- |
| the page has fewer than two `##` or `###` headings | no rail                                                 |
| the page's width is under 59 rem                   | no rail, and the article keeps the whole width          |
| `table_of_contents: false`, on the page or project | no rail                                                 |
| `table_of_contents_label: Jump to`                 | the rail's heading and its landmark name read "Jump to" |

The rail reads its width from the page and not the window, so the sidebar's 18 rem counts. With the sidebar open the rail is hidden at a 1240 px window and shown at 1280 px; with the sidebar closed it is hidden at 900 px and shown at 1000 px.

## Breadcrumbs

The breadcrumbs sit in the header beside the sidebar button. They give the place of the page on screen in the same words as the sidebar, so the two never disagree:

| Page                           | Breadcrumbs                      |
| ------------------------------ | -------------------------------- |
| the home page                  | What is biac                     |
| a page directly under `pages/` | What is biac / Getting started   |
| a page inside a folder         | What is biac / Pages / `<title>` |

The first crumb is the home page's name, and it links to it. A folder is not a page, so its crumb is plain text. The last crumb is the page on screen, marked `aria-current="page"`, and every crumb in between is a link. A long trail never wraps, and each crumb shortens with an ellipsis instead. A path that matches no page, such as a mistyped address, shows the not-found page and no breadcrumbs.

`header: false` on a page removes its breadcrumbs together with the rest of the header, and `nav.sidebar: false` in `biac.config.ts` removes the header from every page.
