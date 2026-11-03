---
title: How cross-filtering works
icon: layers
sidebar_position: 620
keywords:
  [
    cross-filter,
    crossfilter,
    selection,
    clause,
    publisher,
    session,
    url,
    linked,
    explanation,
  ]
---

# How cross-filtering works

When you click a bar and a table beside it narrows, a small amount of state sits between the two. This page names the parts: the selection a pick lands in, the clause that describes the pick, the chart that keeps its own rows, and why a chart's pick stays out of the URL. To make a selection, see [Select on a chart](/crossfilter/select-on-a-chart).

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`species_count`:

```sql species_count echo
select species, count(*) as penguins
from penguins
group by species
order by penguins desc
```

`island_count`:

```sql island_count echo
select island, count(*) as penguins
from penguins
group by island
order by island
```

`island_species`, one row per species on each island:

```sql island_species echo
select island, species, count(*) as penguins
from penguins
group by island, species
order by island, species
```

`islands`:

```sql islands echo
select distinct island
from penguins
order by island
```

## Selections

A selection is the set of picks made on one column. It is named after the column, so every widget that selects on `species` reads and writes the one `species` selection, and a widget narrows when its `filters` names that column.

A chart with `select="crossfilter"` and an input whose `id` names the same column share a selection. A selection holds one pick per widget that made it: a widget's new pick replaces its own earlier one and leaves the others. A row has to satisfy every pick in the selection, so two widgets on one column narrow each other's result rather than taking turns.

## Clauses

A pick is stored as a clause, a statement about the column that biac turns into a `where` condition. A clause has one of four kinds, and the widget that makes the pick decides the kind.

| Kind       | Meaning                          | Made by                                                                    |
| ---------- | -------------------------------- | -------------------------------------------------------------------------- |
| `point`    | The column equals one value      | A click on a mark; a Dropdown, Button group or Toggle pick                 |
| `list`     | The column is one of several     | A shift-click, a drag across bars, a legend entry; a Multi select          |
| `interval` | The column lies between two ends | A drag across a line, area, scatter or histogram; a Slider or a Date range |
| `match`    | The column contains some text    | A [Search](/filters/search)                                                |

A pick with no value is no clause at all. Clearing a pick removes the clause, so an empty selection narrows nothing.

## The chart that publishes keeps its own rows

A chart that makes a pick does not narrow itself. Narrowing the bars to the one you clicked would leave nothing to click next. The chart keeps every mark and dims the ones outside the pick, while the widgets beside it narrow. A widget that made a pick is called its publisher.

Click the Adelie bar. The table keeps the three islands Adelie lives on, and the bar chart still draws all three species.

```mdx echo
<BarChart data="species_count" x="species" y="penguins" select="crossfilter" />

<Table data="island_species" filters="species" />
```

## A chart's pick is session state

Two kinds of pick can sit in one selection, and they are stored differently.

- An input's value is a filter. It is written to the URL under its `id`, so a reload, a bookmark or a shared link restores it. See [Filters and the URL](/filters/filters-and-urls).
- A chart's pick is session state. It lasts for the visit, is never written to the URL, and a reload clears it.

A chart's pick stays out of the URL on purpose. If it were written as the input's value, the input would become its publisher, and the chart could no longer be left out of its own selection.

Pick Biscoe and Dream in the Island input, then click the Dream bar. The table keeps only the rows that are on Dream, because it has to satisfy both picks. Only the input's pick is in the URL, so reloading the page returns to Biscoe and Dream.

```mdx echo
<MultiSelect id="island" data="islands" valueColumn="island" title="Island" />

<BarChart data="island_count" x="island" y="penguins" select="crossfilter" />

<Table data="island_species" filters="island" />
```
