---
title: What is biac
icon: house
---

# What is biac

biac turns a folder of Markdown pages and data files into a BI site. You write the pages, SQL queries and charts as text, review them in a pull request, and serve the result from any static host.

A biac project is three things:

- **Pages**: `.md` files under `pages/`. Each file is a route, so `pages/sales/weekly.md` is served at `/sales/weekly`.
- **Data**: CSV, Parquet and JSON files under `data/`, or programs that generate them. Every query runs in the reader's browser on DuckDB, so there is no database server to run.
- **Config**: an optional `biac.config.ts` that sets the site title, the theme and the tables every page can query.

`biac dev` serves the project while you edit it, `biac build` writes a static site, and `biac preview` serves that build.

## A page in one example

This site is a biac project too. Its config registers the `penguins` table from `data/penguins.csv`, and the query below reads it. Pages can show the source of their queries:

```sql species_mass echo
select species, round(avg(body_mass_g)) as body_mass_g, count(*) as penguins
from penguins
group by species
order by species
```

A widget names a query's result by its name. The chart below runs live and sits above the markup that draws it:

```mdx echo
<BarChart
  data="species_mass"
  x="species"
  y="body_mass_g"
  title="Average body mass by species"
  subtitle="Grams, Palmer Archipelago penguins"
/>
```

Filters, cross-filtering between charts, query files, data loaders and site search build on the same pieces: pages, queries and widgets.

## Next

Follow [Getting started](/getting-started) to install biac and build your first page.

## Data in these docs

The examples query two public-domain datasets, committed under `data/`:

| File                       | Source                                                                                                                                                                                         | Licence                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `data/penguins.csv`        | Palmer Archipelago penguins, collected by Dr. Kristen Gorman, from [palmerpenguins](https://github.com/allisonhorst/palmerpenguins). Missing values are written as empty cells instead of `NA` | [CC0 1.0](https://github.com/allisonhorst/palmerpenguins/blob/main/LICENSE.md) |
| `data/seattle-weather.csv` | Seattle daily weather 2012–2015, NOAA National Climatic Data Center, from [vega-datasets](https://github.com/vega/vega-datasets)                                                               | [U.S. Government work](https://www.usa.gov/government-works)                   |
