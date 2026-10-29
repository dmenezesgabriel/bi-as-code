---
title: Search
icon: filter
sidebar_position: 508
keywords: [search, text search, contains, prefix, suffix, match, filter, Search]
---

# Search

`<Search>` is a search box over one column: it narrows every widget that names it in `filters` to the rows whose column holds the typed text, in any case. Beside the box it can count the matching rows. The text is written to the page URL as `?id=text` once the reader stops typing, presses Enter or leaves the box, so a reload or a shared link opens the page with the same search. To hand the text to a query instead, use a [TextInput](/filters/text-input).

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`island_species`:

```sql island_species echo
select island, species, count(*) as penguins
from penguins
group by island, species
order by island, species
```

`penguin_rows`:

```sql penguin_rows echo
select species, island, sex, body_mass_g
from penguins
```

Every filter on a page shares its URL, so each example below gives its search its own `id`.

## Examples

### Narrow a widget

`id` names the filter, and `column` the column the text is matched in. A widget lists the `id` in `filters` to be narrowed by the search, and must return that column: the table below keeps only the rows whose `species` holds the text. Type `gen` to keep Gentoo.

```mdx echo
<Search id="species_search" column="species" title="Species" />

<Table data="island_species" filters="species_search" />
```

### Match the start or the end

`method` sets where the text must sit in the column: `contains` (the default) anywhere, `prefix` at the start, `suffix` at the end. Type `d` in the first box to keep Dream, and `n` in the second to keep Torgersen.

```mdx echo
<Search
  id="island_prefix"
  column="island"
  method="prefix"
  title="Island starts with"
/>

<Table data="island_species" filters="island_prefix" />

<Search
  id="island_suffix"
  column="island"
  method="suffix"
  title="Island ends with"
/>

<Table data="island_species" filters="island_suffix" />
```

### Count the matches

`data` names a query whose matching rows are counted beside the box, and updated as the reader types. The count goes to screen readers too.

```mdx echo
<Search
  id="species_counted"
  column="species"
  data="penguin_rows"
  title="Species"
/>
```

### Count under other filters

`filters` lists other filters that narrow the counted rows, so the count reads as matches among the rows the page already shows.

```mdx echo
<Dropdown
  id="counted_island"
  valueColumn="island"
  options={["Biscoe", "Dream", "Torgersen"]}
  title="Island"
/>

<Search
  id="species_on_island"
  column="species"
  data="penguin_rows"
  filters="counted_island"
  title="Species"
/>

<Table
  data="island_species"
  filters={["counted_island", "species_on_island"]}
/>
```

### Title

`title` is the label above the box. Without it, the label is the `id` in title case.

```mdx echo
<Search id="find_species" column="species" />
```

### Placeholder

`placeholder` is the hint the box shows while it is empty. Without it, the hint is Search.

```mdx echo
<Search
  id="species_hint"
  column="species"
  title="Species"
  placeholder="e.g. Adelie"
/>
```

### Start on some text

`initialValue` is the search the page opens with when the URL holds none.

```mdx echo
<Search
  id="species_start"
  column="species"
  initialValue="chin"
  title="Species"
/>

<Table data="island_species" filters="species_start" />
```

## Props

| Prop           | Type                             | Default    | What it does                                                          |
| -------------- | -------------------------------- | ---------- | --------------------------------------------------------------------- |
| `id`           | string                           | required   | The filter's name: in widgets' `filters`, the URL and `{{params.id}}` |
| `column`       | string                           | required   | The column the text is matched in                                     |
| `method`       | `contains`, `prefix` or `suffix` | `contains` | Where in the column the text must sit                                 |
| `data`         | string                           | —          | The query whose matching rows are counted beside the box              |
| `filters`      | string or list of strings        | —          | Other filters that narrow the counted rows                            |
| `title`        | string                           | `id`       | The label above the box                                               |
| `placeholder`  | string                           | Search     | The hint the box shows while it is empty                              |
| `initialValue` | string                           | —          | The search the page opens with when the URL holds none                |

## Errors

A `<Search>` whose `method` is not one of the three stops the page from compiling, with a message naming the method: `biac build` fails and `biac dev` shows the message in place of the page. One whose `data` names no query on the page, or whose query fails, shows a message in place of the box; the rest of the page still renders.
