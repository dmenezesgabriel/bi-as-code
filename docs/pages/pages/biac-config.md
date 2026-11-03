---
title: biac.config.ts
icon: settings
sidebar_position: 102
keywords:
  [
    config,
    configuration,
    biac.config.ts,
    title,
    theme,
    nav,
    sql,
    interpreters,
    layout,
    directories,
    brand,
    embed,
    base,
    settings,
  ]
---

# biac.config.ts

`biac.config.ts` holds the settings that belong to the whole project: its name, theme, sidebar, layout, data tables, loader languages, brand and deploy path. This page lists every key.

## The file

The file sits at the project root, beside `pages/`, and default-exports an object. Every key is optional, and a project with no file uses every default.

```ts
export default {
  title: "Sales",
  theme: "system",
  nav: { sidebar: true },
  base: "/sales/",
};
```

The file is TypeScript that biac runs when it loads the project, in the same way Vite runs `vite.config.ts`. Nothing is written to disk, so the project may sit on a read-only root. In `biac dev`, saving the file reloads the page.

A key biac does not know fails the project, so a typo such as `titel` never goes unnoticed:

```text
Invalid biac.config.ts:1:18 — titel: unknown key, expected one of title, theme, nav, sql, interpreters, layout, directories, brand, embed, base (did you mean title?)
```

A key of the wrong shape fails with the file, the line and column, the key, what it expects and what it got. `biac dev`, `biac build` and `biac preview` all report it. Each section below shows the message for its key.

| Key            | Values                                                | Default                      |
| -------------- | ----------------------------------------------------- | ---------------------------- |
| `title`        | text                                                  | `biac`                       |
| `theme`        | `light`, `dark` or `system`                           | `system`                     |
| `nav`          | `{ sidebar }`                                         | `{ sidebar: true }`          |
| `layout`       | `{ page_width, cards, table_of_contents, ... }`       | article width, no cards      |
| `directories`  | `"pages/<folder>"` mapped to `{ title }`              | none                         |
| `base`         | a path starting with `/`                              | `/`                          |
| `sql`          | table name mapped to a `data/` file                   | none                         |
| `interpreters` | `".ext"` mapped to a command list, or `null`          | the table under Interpreters |
| `embed`        | `{ origins, dataOrigins }`                            | none                         |
| `brand`        | `{ colors, palette, scale, fonts, fontSize, radius }` | biac's own colours and fonts |

## `title`

`title` is the site's name. The sidebar shows it at the top, and the browser tab shows it on a page that has neither a front-matter `title` nor a heading.

```ts
export default { title: "Sales" };
```

```text
Invalid biac.config.ts:1:18 — title: expected a string, got 42
```

## `theme`

`theme` sets the colour mode a reader sees on the first visit. `system` follows the reader's operating system, and `light` and `dark` fix the mode. The theme toggle in the header overrides it, and the browser remembers that choice for the reader, so it wins over `theme` on later visits.

```ts
export default { theme: "dark" };
```

```text
Invalid biac.config.ts:1:18 — theme: expected "light" | "dark" | "system", got "blue"
```

## `nav`

`nav.sidebar` is a boolean. `false` removes the sidebar and its toggle, and the content fills the window. A page overrides it with its own [`sidebar` and `header`](/pages/markdown-pages) front-matter keys.

```ts
export default { nav: { sidebar: false } };
```

```text
Invalid biac.config.ts:1:25 — nav.sidebar: expected a boolean, got "no"
```

## `layout`

`layout` sets the page layout for every page. A page overrides one key at a time with the front-matter key of the same name, and a page that omits a key keeps the project's value.

| Key                       | Values              | Default        | Effect                                                                  |
| ------------------------- | ------------------- | -------------- | ----------------------------------------------------------------------- |
| `page_width`              | `article` or `full` | `article`      | `full` lets the content fill the space beside the sidebar               |
| `cards`                   | `true` or `false`   | `false`        | each chart, table and big value sits on its own card over a tinted page |
| `table_of_contents`       | `true` or `false`   | `true`         | the rail that lists a page's `##` and `###` headings                    |
| `table_of_contents_label` | non-empty text      | `On this page` | the rail's name, which is also its landmark's accessible name           |

```ts
export default {
  layout: {
    page_width: "full",
    cards: true,
    table_of_contents_label: "Jump to",
  },
};
```

```text
Invalid biac.config.ts:1:28 — layout.page_width: expected "article" | "full", got "wide"
```

## `directories`

`directories` names the sidebar groups. A folder directly under `pages/` shows in the sidebar as a group named after the folder, with its dashes turned into spaces and each word capitalised. A `directories` entry replaces that name, in the sidebar and in the breadcrumb. The URL keeps the folder name.

```ts
export default {
  directories: {
    "pages/q3-reports": { title: "Quarter 3" },
  },
};
```

A key is `pages/` followed by one folder, because the sidebar groups pages by their first folder only. A deeper folder such as `pages/a/b` is refused:

```text
Invalid biac.config.ts:1:33 — directories key: expected "pages/<folder>", a first-level folder of pages/, got "pages/a/b"
```

A key whose folder holds no page, because it was renamed, deleted or misspelled, fails the page build and names the folders that exist:

```text
Invalid biac.config.ts:1:33 — directories.pages/nestd: unknown key, expected one of pages/nested (did you mean pages/nested?)
```

## `base`

`base` is the path the built site is served from. It starts with `/`, and biac adds the closing `/` if it is missing. The default `/` suits a site served from the root of its host. A site served under a path, such as `https://example.com/sales/`, sets `base: "/sales/"`, and `biac build` writes every asset URL beneath it. `biac preview` and `biac serve` answer under the same path.

```ts
export default { base: "/sales/" };
```

```text
Invalid biac.config.ts:1:18 — base: expected a path starting with "/", got "docs"
```

## `sql`

`sql` registers tables for every page. Each name maps to a file under `data/`, and a page queries the name straight away.

```ts
export default {
  sql: {
    orders: "data/orders.csv",
    stores: "data/stores.parquet",
  },
};
```

The file must be under `data/` and end in `.csv`, `.json`, `.arrow` or `.parquet`, which are the formats DuckDB reads. A leading `./` is accepted.

```text
Invalid biac.config.ts — sql.t: expected a "data/…" path ending .csv, .json, .arrow or .parquet, got "data/a.txt"
```

A page may declare tables of its own with the `sql` front-matter key. Page and project tables share one set of names, so a page that declares a name `biac.config.ts` already holds fails to compile and names both files.

## `interpreters`

`interpreters` chooses the program that runs each kind of data loader. A loader is a program in `data/` whose output becomes a data file, and its extension picks the interpreter. An entry maps an extension, with its leading dot, to the command that runs the loader. biac appends the loader's path to the command. An empty list runs the file itself, and `null` removes the extension, so files with it are ordinary data again.

```ts
export default {
  interpreters: {
    ".pl": ["perl"],
    ".ts": ["tsx"],
    ".py": null,
  },
};
```

An entry overrides the default for its extension, and every extension you leave out keeps its default:

| Extension | Command                    |
| --------- | -------------------------- |
| `.js`     | the node running biac      |
| `.ts`     | the node running biac      |
| `.py`     | `python3`                  |
| `.r`      | `Rscript`                  |
| `.R`      | `Rscript`                  |
| `.rs`     | `rust-script`              |
| `.go`     | `go run`                   |
| `.java`   | `java`                     |
| `.jl`     | `julia`                    |
| `.php`    | `php`                      |
| `.sh`     | `sh`                       |
| `.exe`    | none, the file runs itself |

The node that runs biac also runs `.ts` loaders by stripping their types. It does not transform code, so a `.ts` loader may not use `enum`, `namespace` blocks with code or constructor parameter properties, and it imports local files with their `.ts` extension. A project that needs those maps `".ts": ["tsx"]`.

```text
Invalid biac.config.ts:1:34 — interpreters key: expected an extension starting with ".", got "py"
```

```text
Invalid biac.config.ts:1:34 — interpreters[".py"]: expected an array of strings or null, got "python3"
```

## `embed`

`embed` controls who may use the site from another origin. Both lists are empty by default, which denies everyone. Every other site is refused framing, and no other site's scripts may read `/data/` files.

```ts
export default {
  embed: {
    origins: ["https://intranet.example.com"],
    dataOrigins: ["https://notebook.example.com"],
  },
};
```

| Key           | Grants                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `origins`     | the right to show the site's pages in an iframe: the list becomes the `frame-ancestors` response header |
| `dataOrigins` | the right to read `/data/` files and exported widget modules from a script, through CORS                |

The two grants are separate, so framing a page never lets that site read the raw data. An empty `origins` list sends `frame-ancestors 'none'`.

An origin is written as the browser writes it: `http` or `https`, a host and an optional port, with no path, no trailing slash and no wildcard. `https://intranet.example.com` is valid, and `https://intranet.example.com/` and `*.example.com` are not.

```text
Invalid biac.config.ts:1:37 — embed.origins[0]: expected an origin "scheme://host[:port]" (http or https, no path, no wildcard), got "https://x.com/path"
```

## `brand`

`brand` replaces biac's colours, fonts, font size and corner radius with the project's own. A key you leave out keeps its default.

```ts
export default {
  brand: {
    colors: { primary: { light: "#154886", dark: "#60a5fa" } },
    palette: { light: ["#154886", "#b5472f"] },
    fonts: { heading: "serif" },
    fontSize: "17px",
    radius: "0.25rem",
  },
};
```

A colour is written `#rrggbb`, six hex digits and no other form. Every colour that has a light and a dark appearance takes both: `{ light, dark }`.

| Key        | Values                                                                                      | What it sets                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `colors`   | `primary`, `background`, `positive`, `negative`, `field`, `sidebar`, each `{ light, dark }` | filled and selected controls, the page and chart surface, delta chips, input fields and the sidebar       |
| `palette`  | `{ light, dark }`, each 1 to 8 colours                                                      | chart series colours, by position; the defaults fill the rest                                             |
| `scale`    | `{ light, dark }`, each 1 or more colours                                                   | the heatmap ramp for a heatmap without its own `colorScale`; one colour ramps from the page surface to it |
| `fonts`    | `body`, `heading`, `code`, each `sans-serif`, `serif` or `mono`                             | running text and controls, headings and the site title, code                                              |
| `fontSize` | `"<n>px"`, n a whole number from 12 to 24                                                   | the root font size, which every `rem` scales with                                                         |
| `radius`   | `"0"`, or a `px` or `rem` length up to `24px` or `1.5rem`                                   | the corner radius of controls and cards, default `0.5rem`                                                 |

`fonts` names a system stack, so no font file is loaded. `fontSize` is applied as a percentage of the reader's own browser setting, so a reader who enlarged their text still gets it larger.

biac measures contrast when it loads the file and refuses a colour that would be hard to read. The checks use the WCAG 2.2 floors: 4.5:1 for text, such as a delta against every surface it sits on, and 3:1 for the shapes of controls, the focus ring and every chart series against the chart surface. A failure names the colour, the neighbour it fails against, the measured ratio and the key to change:

```text
Invalid biac.config.ts:1:51 — brand.colors.background.light: #fdf6e3 against --chart-4 #cc79a7 measures 2.83:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light
```

Shape errors name the key too:

```text
Invalid biac.config.ts:1:48 — brand.colors.primary.light: expected a "#rrggbb" colour, got "red"
```

```text
Invalid biac.config.ts:1:36 — brand.fonts.body: expected one of "sans-serif", "serif", "mono", got "Inter"
```

```text
Invalid biac.config.ts:1:27 — brand.fontSize: expected a "<n>px" size, n a whole number from 12 to 24, got "30px"
```
