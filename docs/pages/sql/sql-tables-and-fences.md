---
title: SQL tables and fences
icon: database
sidebar_position: 201
keywords:
  [
    sql,
    query,
    duckdb,
    table,
    fence,
    code block,
    echo,
    display,
    front-matter,
    data,
    csv,
    parquet,
  ]
sql:
  penguin_rows: data/penguins.csv
---

# SQL tables and fences

A page queries data with SQL, and DuckDB runs the query in the reader's browser. Two things make that work: the `sql:` key registers a data file as a table, and a ` ```sql ` fence with a name runs a query over the registered tables and hands its result to the widgets on the page. This page lists the rules of both.

## Registering tables

`sql:` maps a table name to a file under `data/`. It goes in a page's front-matter, or in `biac.config.ts` to give every page the table.

```yaml
sql:
  penguin_rows: data/penguins.csv
```

This page declares exactly that, so a query can read `penguin_rows` here:

```sql row_count echo
select count(*) as penguins from penguin_rows
```

```mdx echo
<BigValue data="row_count" column="penguins" title="Penguins in the file" />
```

| Rule                    | Value                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Key                     | the table name, any non-empty text                                                  |
| Value                   | a path that starts with `data/` and ends in `.csv`, `.json`, `.arrow` or `.parquet` |
| Where the file lives    | `<project>/data/`, so the dev server and `biac build` serve it from one URL         |
| A leading `./`          | dropped: `./data/a.csv` is `data/a.csv`                                             |
| Page and project tables | share one set of names                                                              |

A page and `biac.config.ts` that declare the same name are an error, not an override. The build and the dev server stop on the page and name the project's file:

```text
Invalid front-matter in pages/sales.md — sql.sales: expected a name not already declared by biac.config.ts ("data/a.csv"), got "data/b.csv"
```

A path that is not a `data/` file of a supported kind fails the same way, naming the key:

```text
Invalid front-matter in pages/sales.md — sql.sales: expected a "data/…" path ending .csv, .json, .arrow or .parquet, got "data/a.txt"
```

A value that is not a text path names the key too, and a `sql:` that is not a mapping names `sql`:

```text
Invalid front-matter in pages/sales.md — sql.sales: expected a string path, got 3
Invalid front-matter in pages/sales.md — sql: expected a mapping of table name → "data/…" file path, got "data/a.csv"
```

## Named fences

A fence whose info string starts with a name is a query. The name is how widgets find its result: `data="name"`. The query runs when the page opens, and again when a filter it reads changes.

````md
```sql species_count
select species, count(*) as penguins
from penguins
group by species
order by species
```

<Table data="species_count" />
````

A name is the first word after ` ```sql `. It may not start with `/`, because `data="/queries/…"` names a query file. Two fences on one page may not share a name:

```text
Duplicate sql block name "species_count" at pages/sales.md:30
```

## Echo and display

A named fence shows nothing on the page by default: the query runs for the widgets that use it. Two flags after the name put it on show.

| Flag      | What the reader sees                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `echo`    | the query's SQL, highlighted                                                                                                          |
| `display` | the result as a table that sorts by column and pages through its rows, headers in title case: `avg_body_mass_g` reads Avg Body Mass G |

A bare flag, or `=true`, turns it on. `=false`, or leaving the flag out, turns it off, so ` ```sql by_island echo display=false ` is the same as ` ```sql by_island echo `. The flags come after the name, in either order.

### Neither flag

````md
```sql by_island
select island, count(*) as penguins
from penguins
group by island
order by island
```
````

The fence below is written that way, and nothing appears between this paragraph and the next. A widget still reads it:

```sql by_island
select island, count(*) as penguins
from penguins
group by island
order by island
```

```mdx echo
<BarChart data="by_island" x="island" y="penguins" title="Penguins by island" />
```

### Echo

`echo` shows the SQL, as every example on these pages does.

````md
```sql by_year echo
select year, count(*) as penguins
from penguins
group by year
order by year
```
````

```sql by_year echo
select year, count(*) as penguins
from penguins
group by year
order by year
```

### Display

`display` shows the result table and no code.

````md
```sql by_sex display
select coalesce(sex, 'unknown') as sex, count(*) as penguins
from penguins
group by 1
order by 1
```
````

```sql by_sex display
select coalesce(sex, 'unknown') as sex, count(*) as penguins
from penguins
group by 1
order by 1
```

### Both flags

````md
```sql by_species echo display
select species, round(avg(body_mass_g)) as avg_body_mass_g
from penguins
group by species
order by species
```
````

```sql by_species echo display
select species, round(avg(body_mass_g)) as avg_body_mass_g
from penguins
group by species
order by species
```

While the query runs, the table's place holds a loading skeleton. A query that returns no rows shows `0 rows`.

## When a query fails

A failed query shows its error under the block, naming the block and carrying the message DuckDB gave. It shows whether or not the block has `echo` or `display`, so hiding a block never hides a failure.

## Fence attributes

A flag the fence does not know is an error that names the file and line, so a typo cannot silently hide a result:

```text
Unknown sql block attribute "shown" at pages/sales.md:12 — expected echo or display, bare or =true/=false
Unknown sql block attribute "echo=maybe" at pages/sales.md:12 — expected echo or display, bare or =true/=false
```

The name comes first. A flag in its place, or a `=` inside it, is an error too, and so is a name that starts with `/`:

```text
sql block name "echo" at pages/sales.md:12 is an attribute — write the name first, e.g. `sql orders echo`
sql block name "/sales" at pages/sales.md:12 starts with "/", which names a query file — write a bare name, e.g. `sql orders`
```

## A fence with no name

A ` ```sql ` fence with no name is code and nothing more: it runs no query and shows no result. It highlights like any other code, so it suits SQL a page wants to show and not run.

```sql
select island, count(*) from penguins group by island
```
