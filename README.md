# biac

Business intelligence as code: turn a folder of Markdown pages and data files into a BI site.

You write pages, SQL queries and charts as text, review them in a pull request, and serve the result from any static host. Every query runs in the reader's browser on DuckDB, so there is no database server to run.

## What you get

- **Pages**: each `.md` file under `pages/` is a route. A SQL fence runs a query and names its result, and a widget such as `<BarChart data="name" />` draws it.
- **Charts and tables**: bar, line, area, scatter, histogram and heatmap charts, tables, and big-value cards.
- **Filters**: dropdown, multi-select, button group, date range, slider, search, text input and toggle, with their state kept in the URL.
- **Cross-filtering**: select on one chart and the other widgets on the page query again.
- **Layout and brand**: tabs, accordions, rows, stacks and callouts, with a theme and brand set in `biac.config.ts`.
- **Data**: CSV, Parquet and JSON files, or programs that generate them, plus site search and translations.
- **Shipping**: `biac build` writes a static site, `biac serve` serves it behind basic auth, and the repository's `Dockerfile` bakes a project into an image.
- **Authoring**: `biac dev` reloads on save and has a page editor in the browser.

## Install

You need [Node.js](https://nodejs.org/) 24.12 or a later 24.x release.

```sh
mkdir my-site
cd my-site
npm i -D @biac/cli
```

The package is `@biac/cli`; it installs the `biac` command.

## Quick start

```sh
mkdir pages data
echo '# Sales' > pages/index.md
npx biac dev
```

`biac dev` prints a local URL and reloads the page each time you save a file. When you are done, build the site and preview the build:

```sh
npx biac build
npx biac preview
```

[Getting started](docs/pages/getting-started.md) continues from here: it adds data, a table and a chart.

## Documentation

The user documentation is itself a biac project in [`docs/`](docs/pages). Start with [What is biac](docs/pages/index.md) and [Getting started](docs/pages/getting-started.md). In a clone of this repository, `bin/biac dev docs` serves it.

## Status

biac is at version 0.x. Under [semantic versioning](https://semver.org/), anything can change in a minor release until 1.0.

## Contributing and security

[`CONTRIBUTING.md`](CONTRIBUTING.md) is the working agreement: Node.js 24.12 or later, pnpm 10, `pnpm install` and `pnpm gate`. Take part under the [Code of Conduct](CODE_OF_CONDUCT.md). Report a vulnerability privately, as [`SECURITY.md`](SECURITY.md) describes.

## License

Apache-2.0: [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

Portions of the page-filter model and input widgets, the cross-filter selection engine and the page chrome were ported from [Evidence](https://github.com/evidence-dev/evidence) (MIT), [Mosaic](https://github.com/uwdata/mosaic) (BSD 3-Clause) and [Observable Framework](https://github.com/observablehq/framework) (ISC) as re-implementations. Their copyright notices and licenses are in `NOTICE`.
