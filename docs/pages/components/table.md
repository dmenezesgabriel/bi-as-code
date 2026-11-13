---
title: Table
icon: table
sidebar_position: 301
keywords: [grid, data table, column, pager]
---

# Table

`<Table>` shows a query's rows as a sortable, paged table. Name a ` ```sql ` fence with `data`, and the table lists every column the query returns. Add `<Column>` children to choose the columns, their order, their headers and their number formats.

Sorting and paging run on the rows already loaded in the browser, so neither sends a new query.

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`species_by_island`:

```sql species_by_island echo
select species, island, sex, count(*) as penguins, avg(body_mass_g) as avg_body_mass_g
from penguins
where sex is not null
group by all
order by all
```

`island_share`:

```sql island_share echo
select island, count(*) as penguins, count(*) / sum(count(*)) over () as share
from penguins
group by island
order by penguins desc
```

`wettest_days`:

```sql wettest_days echo
select date, weather, precipitation as precipitation_mm
from weather
order by precipitation desc, date
limit 5
```

## Examples

### Every column

With no children, the table shows every column in query order. Headers are the column names in title case (`avg_body_mass_g` reads "Avg Body Mass G"), numbers are grouped with no decimals and sit right-aligned, and text sits left. Select a header to sort by it; select it again to reverse the order.

```mdx echo
<Table data="species_by_island" />
```

### Rows per page

`pageSize` sets how many rows show before the pager splits the result. The default is 10.

```mdx echo
<Table data="species_by_island" pageSize={5} />
```

### Choose and order columns

Each `<Column id>` picks one result column. Only the listed columns show, in the order listed.

```mdx echo
<Table data="species_by_island">
  <Column id="island" />
  <Column id="species" />
  <Column id="penguins" />
</Table>
```

### Column headers

`title` replaces a column's header text.

```mdx echo
<Table data="species_by_island">
  <Column id="species" />
  <Column id="sex" title="Sex" />
  <Column id="avg_body_mass_g" title="Average body mass (g)" />
</Table>
```

### Number formats

`fmt` formats a column with a format code. The bare codes `num`, `usd` and `pct` pick their decimals and unit from the whole column, so every cell reads in one unit. A code with a digit fixes the decimals: `pct1` shows one.

```mdx echo
<Table data="island_share">
  <Column id="island" />
  <Column id="penguins" fmt="num0" />
  <Column id="share" fmt="pct1" title="Share of penguins" />
</Table>
```

### Date formats

A `DATE` or `TIMESTAMP` column takes a date code: `longdate` spells the month out. With no `fmt`, a date shows as `2015-03-15`. Dates show as the query returns them, on the UTC clock, so every reader sees the same day.

```mdx echo
<Table data="wettest_days">
  <Column id="date" fmt="longdate" title="Day" />
  <Column id="weather" />
  <Column id="precipitation_mm" fmt="num1" title="Rain (mm)" />
</Table>
```

### Narrow with a filter

`filters` names the page filters whose selections narrow the table's query. A filter narrows on its `valueColumn`, so the query must return a column of that name. Pick an island below and the table re-queries; clear it and every row returns.

```mdx echo
<Dropdown id="island" data="island_share" valueColumn="island" title="Island" />

<Table data="species_by_island" filters="island" />
```

`filters` also takes a list, `filters={["island", "sex"]}`, and every listed filter narrows the query.

### Download

The `Download CSV` button under a table saves all its rows, not only the page on screen, as a CSV file named after the query (`species_by_island.csv`). The rows come in the order the reader sorted them, under the headers the table shows. Cells hold the full raw values, not the grouped and rounded text on screen, and dates are ISO text. The file opens in Excel with accents intact.

A table narrowed by a filter downloads only the rows it shows, and a table with no rows shows its empty state and no button. A ` ```sql name display ` fence has the same button.

```mdx echo
<Table data="species_by_island" />
```

## Props

### Table

| Prop       | Type                 | Default      | What it does                                                          |
| ---------- | -------------------- | ------------ | --------------------------------------------------------------------- |
| `data`     | string               | required     | The name of a ` ```sql ` fence on the page                            |
| `pageSize` | number               | `10`         | Rows shown per page                                                   |
| `filters`  | string or string\[\] | none         | Page filter ids whose selections narrow the query                     |
| children   | `<Column>` elements  | every column | The columns to show, in order; with none, every column in query order |

### Column

| Prop    | Type   | Default                          | What it does                                                      |
| ------- | ------ | -------------------------------- | ----------------------------------------------------------------- |
| `id`    | string | required                         | The result column to show                                         |
| `title` | string | the column name in title case    | The header text                                                   |
| `fmt`   | string | numbers grouped with no decimals | A format code from [Format codes](/components/value#format-codes) |

## Errors

A mistake in a table's markup shows as a message where the table would be, and the rest of the page still renders. The message names the query and what is wrong: a `data` that names no fence on the page, a `<Column id>` the query does not return (with the columns it does return), or a `fmt` the column's values cannot take.
