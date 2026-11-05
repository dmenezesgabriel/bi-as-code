---
title: Markdown pages and front-matter
icon: file-text
sidebar_position: 101
keywords:
  [
    page,
    markdown,
    route,
    routing,
    front-matter,
    yaml,
    title,
    sidebar_position,
    icon,
    layout,
    index,
    keywords,
  ]
---

# Markdown pages and front-matter

A biac page is a Markdown file under `pages/`. Its path is its URL, and an optional YAML block at the top of the file sets how the page is named, ordered, laid out, styled, searched and given tables to query. This page lists every route rule, how a page shows an image, and every front-matter key.

## Routes

Every `.md` and `.mdx` file under `pages/` is one route. The route is the file's path without its extension.

| File                    | Route           |
| ----------------------- | --------------- |
| `pages/index.md`        | `/`             |
| `pages/sales.md`        | `/sales`        |
| `pages/sales/weekly.md` | `/sales/weekly` |
| `pages/sales/index.md`  | `/sales`        |

A file named `index` serves its folder's route. `.md` and `.mdx` files serve alike, and a folder named `node_modules` is never read.

Two files may not serve one route. `pages/sales.md` next to `pages/sales/index.md`, or `pages/sales.md` next to `pages/sales.mdx`, fails the dev server and the build with an error that names both files:

```text
Duplicate page route "/sales" produced by "pages/sales.md" and "pages/sales/index.md"
```

`biac build` writes each route as a folder of static files, so it also refuses a first path segment the output already uses: `assets`, `data` and `widgets`. Move a page out of `pages/data/`, for example, or rename the folder.

## Images

A page shows an image with Markdown's image syntax. Put the file under `data/` and write its path from the site root:

```mdx echo
![Three page files and the routes they serve](/data/page-routes.svg)
```

`data/` is the one project folder served as it is: `biac dev` reads it from disk and `biac build` copies it, unhashed, to `build/data/`. Files ending `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` and `.svg` are sent with their image type.

- **Write `/data/…`, not the base.** Under a [`base`](/ship/base-path) the page adds the prefix itself, so `/data/page-routes.svg` is `/sales/data/page-routes.svg` on a site built for `/sales/`.
- **Other addresses stay as written.** An `https://` address or a path without a leading `/` is not changed, and a relative path resolves against the page's URL, which always ends in a slash.
- **The image fits its column.** It scales down, keeping its proportions, and never widens the page at 375 px.
- **The alt text is the accessible name.** Leave it empty (`![](/data/page-routes.svg)`) for a picture that only decorates.
- **A missing file is not caught.** `biac build` fails on a link to a page that does not exist, but an image whose file is missing builds and shows a broken image.

## Front-matter

Front-matter is a YAML mapping between two `---` lines at the very top of the file.

```md
---
title: Weekly revenue
icon: trending-up
sidebar_position: 2
---

# Weekly revenue
```

A page with no front-matter uses every default. Front-matter that is not a mapping, such as a list, fails with `expected a YAML mapping`. A YAML syntax error fails with the file, line and column of the mistake, so the editor can jump to it. A key biac does not know is kept and otherwise ignored.

A key of the wrong shape fails the page with the file, the key, what it expects and what it got, so the fix needs no second look:

```text
Invalid front-matter in pages/sales.md — page_width: expected "article" | "full", got "wide"
```

| Key                       | Values                 |
| ------------------------- | ---------------------- |
| `title`                   | text                   |
| `sidebar_position`        | a number               |
| `icon`                    | a catalog name         |
| `sidebar`                 | `true` or `false`      |
| `header`                  | `true` or `false`      |
| `page_width`              | `article` or `full`    |
| `cards`                   | `true` or `false`      |
| `table_of_contents`       | `true` or `false`      |
| `table_of_contents_label` | non-empty text         |
| `index`                   | `true` or `false`      |
| `keywords`                | text or a list of text |
| `brand`                   | a mapping              |
| `sql`                     | a mapping              |

A key a page leaves out takes the project's value: `nav.sidebar` in `biac.config.ts` for `sidebar` and `header`, its `layout` settings for `page_width`, `cards`, `table_of_contents` and `table_of_contents_label`, and `brand` in `biac.config.ts` for `brand`. `sql` adds its tables to the project's `sql` tables, and the two share one set of names. The other keys have no project value, so a page that leaves them out has no icon, no keywords and no position, takes its title from its first heading, and is searchable. Each key has its section below.

## Title

`title` is the page's name everywhere it is listed. Without it the sidebar shows the file name with its dashes turned into spaces and each word capitalised, so `pages/weekly-revenue.md` reads Weekly Revenue, and the home page reads Home. The browser tab shows the title, or the site title when the page has neither a `title` nor a heading. A number is written as text.

```yaml
title: Weekly revenue
```

## Sidebar

`sidebar_position` is a number. Pages with one come first, lowest first, and pages without one follow in name order. Pages with the same number sort by name. The home page is always first. A value that is not a number is ignored.

```yaml
sidebar_position: 2
```

`icon` names one glyph from this catalog. A name outside it fails the page and suggests the closest one, so `calender` answers `did you mean calendar?`. Names are matched exactly, so `Calendar` fails too.

`house`, `layout-dashboard`, `layers`, `chart-column`, `chart-bar`, `chart-line`, `chart-area`, `chart-pie`, `gauge`, `trending-up`, `trending-down`, `activity`, `table`, `sheet`, `database`, `server`, `cloud`, `calendar`, `clock`, `users`, `user`, `building`, `briefcase`, `store`, `factory`, `warehouse`, `truck`, `package`, `shopping-cart`, `receipt`, `credit-card`, `wallet`, `dollar-sign`, `coins`, `banknote`, `percent`, `target`, `flag`, `map`, `map-pin`, `globe`, `mail`, `file`, `file-text`, `folder`, `book-open`, `info`, `circle-help`, `settings`, `shield`, `lock`, `key`, `wrench`, `filter`, `search`, `list-checks`

```yaml
icon: calendar
```

`sidebar` and `header` are booleans. A page that sets one overrides project `nav.sidebar` for that switch alone, and a page that sets neither follows the project. A page with both off shows no site chrome, which suits a page opened inside an iframe.

```yaml
sidebar: false
header: false
```

## Layout

The layout keys override project `layout` settings one key at a time. A key a page omits keeps the project's value.

`page_width: full` lifts the reading column's width limits so the content fills the space beside the sidebar. The contents rail stays. The default `article` keeps the column at a readable width.

```yaml
page_width: full
```

`cards: true` puts each chart, table and big value on its own card over a tinted background.

```yaml
cards: true
```

`table_of_contents: false` hides the rail that lists the page's `##` and `###` headings, which shows on wide windows. `table_of_contents_label` renames it, and the name becomes the landmark's accessible name too.

```yaml
table_of_contents: true
table_of_contents_label: Jump to
```

## Search

Site search finds a page by its title, its text and its keywords, and a match in the title or the keywords ranks above one in the text. `index: false` removes the page from the results, and `keywords` adds words the page does not otherwise contain. How a query matches is on [Site search](/sql/site-search).

```yaml
index: false
```

```yaml
keywords: [revenue, sales, weekly]
```

A single word may be written as text: `keywords: revenue`. Anything else, such as a number or a list holding a number, fails the page.

## Brand

`brand` sets the page's own colours, palette, heatmap scale, fonts, root font size and corner radius, with the keys and rules of the project's `brand`. A key the page leaves out keeps the project's value, and the page's brand ends when the reader leaves the page.

```yaml
brand:
  colors:
    primary: { light: "#7c3aed", dark: "#c4b5fd" }
  fonts: { heading: "serif" }
```

[Themes and brand](/pages/themes-and-brand) lists what the page's brand changes and the contrast it is checked against, and [A branded page](/pages/branded-page-example) shows it live.

## SQL tables

`sql` maps table names to `data/` files, so the page's queries can read them. The tables are added to those `biac.config.ts` declares, and a name both declare is an error.

```yaml
sql:
  sales: data/sales.csv
```

[SQL tables and fences](/sql/sql-tables-and-fences) lists the file kinds a table accepts, the errors, and the ` ```sql ` fences that query them.
