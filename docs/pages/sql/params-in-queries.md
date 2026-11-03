---
title: Parameters in queries
icon: filter
sidebar_position: 202
keywords:
  [
    params,
    parameter,
    query,
    sql,
    template,
    interpolation,
    placeholder,
    url,
    filter,
    subquery,
    compose,
  ]
---

# Parameters in queries

A query on a page can change with the page. `{{params.id}}` hands a query the value a reader picked, typed or switched, and `{{name}}` splices another query's SQL into this one. Both are written inside a named ` ```sql ` fence, and both are resolved before DuckDB sees the query. This page lists the rules of the two.

## `{{params.id}}`

`{{params.id}}` is the value of the page parameter `id`. The inputs write their value to the page URL under their `id`, so an input with `id="island_text"` is read as `{{params.island_text}}`; [TextInput](/filters/text-input), [Dropdown](/filters/dropdown), [Toggle](/filters/toggle) and the other inputs each say what their value looks like.

The value reaches DuckDB as a bound argument, not as text pasted into the SQL: `{{params.id}}` becomes a `?` and the value travels beside the query. Whatever a reader types, it stays a value, so it cannot change what the query does.

### Use a value in a query

Type `bis` to keep Biscoe. The query below keeps the islands whose name holds the text, and every island while the box is empty.

```mdx echo
<TextInput id="island_text" title="Island name" />
```

```sql islands_named echo
select island, count(*) as penguins
from penguins
where {{params.island_text}} is null
  or island ilike '%' || {{params.island_text}}::varchar || '%'
group by island
order by island
```

```mdx echo
<Table data="islands_named" />
```

The query reruns each time the value changes, and only the queries that read the changed parameter rerun. A query that never reads `{{params.*}}` keeps its result.

### Before a value exists

A parameter nobody has set is `null`, and `null` is not an error. Write the query so that `null` means no filter, as `islands_named` does with `{{params.island_text}} is null or …`. The same holds for a name no input uses: `{{params.island_txt}}` is `null` as well, so a misspelled parameter silently filters nothing.

```sql typed_probe echo
select coalesce({{params.island_text}}::varchar, 'nothing typed') as typed
```

```mdx echo
<Table data="typed_probe" />
```

### Where a value comes from

The page URL's search parameters, then the inputs' own starting values. When the URL holds a parameter, it wins. Otherwise an input's `initialValue`, or the first option a `selectFirst` input picked, is what the query reads, so a page opens with the same value its input shows.

The URL carries text, and a value that parses as JSON is read as what it parses to:

| In the URL          | `{{params.id}}` is    | DuckDB type |
| ------------------- | --------------------- | ----------- |
| `?id=Dream`         | the text `Dream`      | `VARCHAR`   |
| `?id=42`            | the number `42`       | `DOUBLE`    |
| `?id=true`          | the boolean `true`    | `BOOLEAN`   |
| `?id=["a","b"]`     | the list `['a', 'b']` | `VARCHAR[]` |
| nothing, no initial | `null`                | —           |

That is why `islands_named` casts with `::varchar`: a reader who types `42` hands the query a `DOUBLE`, which reads `42.0` once cast to text.

### A list of values

A [MultiSelect](/filters/multi-select) writes its picks as a list, and `{{params.id}}` hands the query that list. Each pick is its own bound argument, so the database receives `[?, ?]` for two picks, and the picks stay values like any other. Test a column against the list with `list_contains({{params.id}}, column)`.

With nothing picked, the parameter is `null`, not an empty list. `= any(null)` is an error in DuckDB, so test for `null` first and let `list_contains` do the rest, as `islands_picked` does.

```mdx echo
<MultiSelect
  id="island_picks"
  options={["Biscoe", "Dream", "Torgersen"]}
  valueColumn="island"
  title="Islands"
/>
```

```sql islands_picked echo
select island, count(distinct species) as species_count
from penguins
where {{params.island_picks}} is null
  or list_contains({{params.island_picks}}, island)
group by island
order by island
```

```mdx echo
<Table data="islands_picked" />
```

Pick Dream and Biscoe and the table keeps those two islands. The token is written twice, so the picks are bound twice, once for each place it stands.

### A value is not a name

A bound value stands for a value only. It cannot name a column or a table, and it cannot be a piece of SQL, so a query that picks its column by parameter spells the choices out:

```sql
select case {{params.measure}}
  when 'flipper' then flipper_length_mm
  else body_mass_g
end as measure
from penguins
```

Keep the token outside quotes too. Inside `'…'` it is part of the text and not a placeholder, so the value has nowhere to go and the query fails. Build the text from the value instead: `'%' || {{params.island_text}}::varchar || '%'`, as `islands_named` does.

```text
quoted: query failed (select count(*) as n from penguins where island ilike '%?%'): Error: Invalid Input Error: Parameter argument/count mismatch, identifiers of the excess parameters: 1
```

## `{{name}}`

`{{name}}` is the SQL of another named fence on the same page, placed where the token stands inside parentheses, as a subquery. A fence reuses a result without copying its query.

```sql species_on_named_islands echo
select species, count(*) as penguins
from penguins
where island in (select island from {{islands_named}})
group by species
order by species
```

```mdx echo
<Table data="species_on_named_islands" />
```

The database receives `islands_named` written in place, its own `{{params.island_text}}` already a `?`:

```text
select species, count(*) as penguins
from penguins
where island in (select island from (select island, count(*) as penguins
from penguins
where ? is null
  or island ilike '%' || ?::varchar || '%'
group by island
order by island))
group by species
order by species
```

The two values are bound left to right, in the order the `?`s appear. Type in the Island name box above and both tables follow.

Spaces inside the braces make no difference: `{{ islands_named }}` is the same token.

## Errors

A query with an error is never run. It shows the message under the block, whether or not the block has `echo` or `display`; the rest of the page still renders.

A token that is not `params.`, a translation, a query file or the name of another fence on the page:

```text
Unknown token {{nope}} — expected {{params.<name>}}, {{$translations.<key>}}, {{/queries/<path>}} or the name of another sql block on this page
```

Two fences that reach each other, or one that reaches itself, never finish expanding:

````md
```sql first_pass
select * from {{second_pass}}
```

```sql second_pass
select * from {{first_pass}}
```
````

```text
Circular query reference: {{first_pass}}
```

Several errors in one query are shown together, separated by `;`.
