---
title: Query files
icon: file-text
sidebar_position: 203
keywords:
  [
    queries,
    query file,
    sql file,
    .sql,
    reuse,
    share,
    data,
    compose,
    subquery,
    nested,
    params,
  ]
---

# Query files

A query that more than one page needs lives in its own file. A `.sql` file under the project's `queries/` folder is a named query: a widget reads it with `data="/queries/<path>"`, and a ` ```sql ` fence builds on it with `{{/queries/<path>}}`. The file is plain SQL over the tables the page can read, so the page that uses it never copies it.

## A query in its own file

The file `queries/island_counts.sql` holds one `select`:

```sql
-- Penguins per island, the largest colony first.
select island, count(*) as penguins
from penguins
group by island
order by penguins desc
```

A widget names the file in `data`. The name is the path under `queries/`, without `.sql`, written from the project root:

```mdx echo
<Table data="/queries/island_counts" />
```

A file in a folder keeps the folder in its name: `queries/penguins/island_search.sql` is `/queries/penguins/island_search`.

```text
queries/
├── island_counts.sql              → data="/queries/island_counts"
└── penguins/
    └── island_search.sql          → data="/queries/penguins/island_search"
```

The leading `/` and the `/queries/` prefix are both required, and the extension is left out. A page in a folder uses the same name as the home page does; a path is never read relative to the page that writes it. A `data` that does not start with `/` is the name of a fence, so `data="island_counts"` looks for a fence of that name and finds none.

## Inside a fence

A named ` ```sql ` fence reads a file with `{{/queries/<path>}}`. The file's SQL is placed where the token stands, inside parentheses, as a subquery, the way `{{name}}` places another fence. Use it to keep a shared query in one file and add the page's own filter on top.

```sql big_islands echo
select island
from {{/queries/island_counts}}
where penguins > 100
order by island
```

```mdx echo
<Table data="big_islands" />
```

A fence without a name is never run, so a token inside it is only text. That is how this page shows the files above without reading them again.

## Files that build on files

A file may name other files with `{{/queries/<path>}}`, and it may read `{{params.id}}` as a page does. `queries/penguins/island_search.sql` does both: it takes `island_counts` and keeps the islands whose name holds the text in the `island_text` parameter.

```sql
-- The islands of island_counts whose name holds the text of the island_text
-- parameter, or every island while that box is empty.
select island, penguins
from {{/queries/island_counts}}
where {{params.island_text}} is null
  or island ilike '%' || {{params.island_text}}::varchar || '%'
```

A parameter inside a file is a bound argument exactly as it is in a fence, so a reader's text stays a value. Type `bis` to keep Biscoe.

```mdx echo
<TextInput id="island_text" title="Island name" />
```

```mdx echo
<Table data="/queries/penguins/island_search" />
```

The file reads the same parameter on every page that uses it, so each page needs an input with that `id`. Where a parameter comes from, and the types a value binds as, are on [Parameters in queries](/sql/params-in-queries).

## Which files a page reads

The build reads a file for each `data="/queries/…"` and each `{{/queries/…}}` it finds in a named fence, in the files it reads in turn. The page then carries only those files, and `biac build` ships no other `.sql` file of `queries/`. A file nothing reads costs nothing.

Under `biac dev`, saving a file updates every open page that reads it, without a reload.

A `data` value has to be written out as a string, `data="/queries/island_counts"` or `data={"/queries/island_counts"}`. A value computed on the page is not known until the page runs, so the build cannot read its file, and the widget shows the same message as for a fence that does not exist:

```text
/queries/island_counts: no sql fence on this page declares this name
```

A comment in a file is read like the rest of it, so a brace token written in a comment expands too. Name a parameter in a comment without its braces, as the comments above do.

## Errors

A file that does not exist fails the page where it is named. The message says which file was looked for and suggests the closest one:

```text
Query file queries/island_count.sql not found for data="/queries/island_count" (did you mean /queries/island_counts?)
```

A name that does not start with `/queries/` names no file at all:

```text
data="/island_counts" names no query file — expected data="/queries/<path>" for queries/<path>.sql
```

A name that climbs out of `queries/` with `..` is read as missing, so a page cannot pull any other file of the project into its code.

A file that fails when it runs shows its error under the widget that reads it, led by the file's path. DuckDB's own text follows:

```text
/queries/island_counts: queries/island_counts.sql: query failed (-- Penguins per island, the largest colony first. selec island, …): Error: …"syntax error at or near \"selec\"…
```

A fence that builds on a file gets DuckDB's error without the file's path, because DuckDB reports a position in the combined query and cannot say which part failed. The query it quotes holds the file's lines in place, so the text that failed is in the message.

Two files that reach each other, or one that reaches itself, never finish expanding. The query is not run and shows:

```text
Circular query reference: {{/queries/first_pass}}
```
