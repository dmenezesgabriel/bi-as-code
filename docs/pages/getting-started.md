---
title: Getting started
icon: flag
---

# Getting started

This tutorial installs biac, then builds a one-page site with a table and a bar chart. It takes about ten minutes. Each step ends with something you can see.

## Before you begin

You need [Node.js](https://nodejs.org/) 24.12 or a later 24.x release: `node --version` prints `v24.12.0` or higher. It includes `npm`, which installs biac.

## Install biac

Make a directory for your project and install biac in it:

```sh
mkdir my-site
cd my-site
npm i -D biac
```

`npx biac` now runs the installed command. Every command below runs from the `my-site` directory.

## Create a project

A project is a directory with a `pages/` folder. Add one, and a `data/` folder for the next step:

```sh
mkdir pages data
```

Create `pages/index.md` with a heading and a sentence:

```md
# Sales

Monthly sales by region.
```

Start the development server:

```sh
npx biac dev
```

It prints a local URL, `http://localhost:5173/` unless that port is taken. Open it: your page shows its heading and sentence. Leave the server running. It reloads the page each time you save a file.

## Add data

Create `data/sales.csv`:

```csv
month,region,revenue
2026-01,North,4200
2026-01,South,3100
2026-02,North,4600
2026-02,South,2900
2026-03,North,5100
2026-03,South,3400
```

A page names the files it queries in its front matter, the block between `---` lines at the top. Replace `pages/index.md` with:

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
npx biac build
```

It writes a static site to `build` inside `my-site` and prints its full path. Every query still runs in the reader's browser, so you can copy the `build` directory to any static host.

## Preview the build

Serve the build exactly as a static host would:

```sh
npx biac preview
```

It prints a local URL, `http://localhost:4173/`; if another program holds that port it stops with `Port 4173 is already in use`, and `--port` picks another. Open it: the page, the table and the chart render from the built files. Stop the server with Ctrl+C when you are done.

## Next

[What is biac](/) explains how pages, data and config fit together.
