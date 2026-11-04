---
title: Getting started
icon: flag
---

# Getting started

This tutorial installs biac, then builds a one-page site with a table and a bar chart. It takes about ten minutes. Each step ends with something you can see.

## Before you begin

You need:

- [Node.js](https://nodejs.org/) 24.12 or a later 24.x release: `node --version` prints `v24.12.0` or higher.
- [pnpm](https://pnpm.io/installation) 10: `pnpm --version` prints `10.x`.
- [Git](https://git-scm.com/).

## Install biac

biac is not published to npm yet, so you run it from a clone of its repository. Clone it and build the command-line tool:

```sh
git clone https://github.com/dmenezesgabriel/bi-as-code.git
cd bi-as-code
pnpm install
pnpm build:cli
```

The `biac` command is now `bin/biac` inside the clone. Every command below runs from the `bi-as-code` directory and names your project's directory as its last argument.

## Create a project

A project is a directory with a `pages/` folder. Make one next to the clone:

```sh
mkdir -p ../my-site/pages ../my-site/data
```

Create `../my-site/pages/index.md` with a heading and a sentence:

```md
# Sales

Monthly sales by region.
```

Start the development server:

```sh
bin/biac dev ../my-site
```

It prints a local URL, `http://localhost:5173/` unless that port is taken. Open it: your page shows its heading and sentence. Leave the server running. It reloads the page each time you save a file.

## Add data

Create `../my-site/data/sales.csv`:

```csv
month,region,revenue
2026-01,North,4200
2026-01,South,3100
2026-02,North,4600
2026-02,South,2900
2026-03,North,5100
2026-03,South,3400
```

A page names the files it queries in its front matter, the block between `---` lines at the top. Replace `../my-site/pages/index.md` with:

````md
---
title: Sales
sql:
  sales: data/sales.csv
---

# Sales

Monthly sales by region.

```sql revenue_by_region
select region, sum(revenue) as revenue
from sales
group by region
order by revenue desc
```

<Table data="revenue_by_region" />
````

`sql:` registers `data/sales.csv` as the table `sales`. The ` ```sql revenue_by_region ` fence runs a query in your browser and names its result `revenue_by_region`. `<Table>` shows that result. Save the file: the page now shows a table with one row per region.

## Add a chart

Add a bar chart below the table:

```md
<BarChart data="revenue_by_region" x="region" y="revenue" title="Revenue by region" />
```

Save the file. The chart draws one bar per region, and hovering a bar shows its value.

## Build the site

Stop the development server with Ctrl+C, then build:

```sh
bin/biac build ../my-site
```

It writes a static site to `../my-site/build` and prints that path. Every query still runs in the reader's browser, so you can copy the `build` directory to any static host.

## Preview the build

Serve the build exactly as a static host would:

```sh
bin/biac preview ../my-site
```

It prints a local URL, `http://localhost:4173/`; if another program holds that port it stops with `Port 4173 is already in use`, and `--port` picks another. Open it: the page, the table and the chart render from the built files. Stop the server with Ctrl+C when you are done.

## Next

[What is biac](/) explains how pages, data and config fit together.
