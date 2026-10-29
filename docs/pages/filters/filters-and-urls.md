---
title: Filters and the URL
icon: filter
sidebar_position: 510
keywords:
  [filters, narrow, url, link, share, query string, persistence, params, id]
---

# Filters and the URL

A filter is a value with a name. The filter inputs on the [Filters](/filters/dropdown) pages each hold one, under their `id`, and a widget lists the names in `filters` to be narrowed by them. Every filter's value is also written to the page URL under its name, so the URL is the page's state: a reload, a bookmark or a link sent to someone opens the page with every filter where it was left.

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`islands`:

```sql islands echo
select distinct island
from penguins
order by island
```

`species`:

```sql species echo
select distinct species
from penguins
order by species
```

`island_species`:

```sql island_species echo
select island, species, count(*) as penguins
from penguins
group by island, species
order by island, species
```

Every filter on a page shares its URL, so each example below gives its filter its own `id`.

## Narrowing widgets

### Narrow a widget

`filters="island"` narrows the table to the rows whose `island` column holds the pick. biac runs the widget's query as written, then keeps the rows that match: `select * from (<the query>) where island = ?`, with the pick passed as a value, never pasted into the SQL text.

```mdx echo
<Dropdown id="island" data="islands" valueColumn="island" title="Island" />

<Table data="island_species" filters="island" />
```

### Narrow by several filters

`filters` takes a list. A row stays only when it matches every listed filter, so picking Dream and Adelie keeps the one row that is both.

```mdx echo
<Dropdown id="both_island" data="islands" valueColumn="island" title="Island" />

<MultiSelect
  id="both_species"
  data="species"
  valueColumn="species"
  title="Species"
/>

<Table data="island_species" filters={["both_island", "both_species"]} />
```

### Narrow several widgets with one filter

Any number of widgets can name the same filter, and one pick narrows them all.

```mdx echo
<Dropdown
  id="shared_island"
  data="islands"
  valueColumn="island"
  title="Island"
/>

<BarChart
  data="island_species"
  x="species"
  y="penguins"
  filters="shared_island"
/>

<Table data="island_species" filters="shared_island" />
```

### Narrow on a column named apart from the filter

A filter narrows the column its input names in `valueColumn`, whatever its `id`. Without `valueColumn`, it narrows the column named like the `id`. Either way, the widget's query must return that column, or the widget shows the database's error.

```mdx echo
<Dropdown id="home" data="islands" valueColumn="island" title="Home island" />

<Table data="island_species" filters="home" />
```

### A cleared filter narrows nothing

Before a pick, after Clear, or with every pick removed, a filter keeps every row. A widget never shows nothing because a reader has not chosen yet.

## How each filter narrows

| Filter                                                       | The rows a widget keeps                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [Dropdown](/filters/dropdown)                                | `valueColumn` equals the pick                                                    |
| [MultiSelect](/filters/multi-select)                         | `valueColumn` is one of the picks                                                |
| [ButtonGroup](/filters/button-group)                         | `valueColumn` equals the pressed button, or is one of them with `multiple`       |
| [Slider](/filters/slider)                                    | `valueColumn` is at or above the pick, or between both thumbs with `range`       |
| [DateRange](/filters/date-range)                             | `valueColumn` falls in the span; without `valueColumn` it narrows nothing        |
| [Search](/filters/search)                                    | `valueColumn` contains the typed text, or starts with it, by `method`            |
| [TextInput](/filters/text-input)                             | nothing — a query reads it as `{{params.id}}`                                    |
| [Toggle](/filters/toggle)                                    | nothing — a query reads it as `{{params.id}}`                                    |
| A chart's `select` (see [LineChart](/components/line-chart)) | the selected values or stretch; the chart that holds the selection keeps its own |

Any filter can also be read inside a query as `{{params.id}}`, for a match `filters` cannot express, such as in an aggregate or a join; the [Dropdown](/filters/dropdown) page shows one.

## The URL

### What the URL holds

Each filter that holds a value writes it to the URL under its `id`. A cleared filter removes its name from the URL rather than leaving it empty.

| Filter                  | In the URL                                       |
| ----------------------- | ------------------------------------------------ |
| Dropdown, ButtonGroup   | `?id=Dream`                                      |
| MultiSelect, `multiple` | `?id=["Adelie","Gentoo"]`                        |
| Slider                  | `?id=4000`, or `?id=3500 - 4500` with `range`    |
| DateRange               | the words of the span, such as `?id=last 7 days` |
| Search, TextInput       | the typed text                                   |
| Toggle                  | `?id=true` or `?id=false`                        |

Several filters join with `&`, as `?island=Dream&species=["Adelie"]`; the browser shows the brackets and spaces percent-encoded.

### Share a filtered page

A link that carries filter values opens the page already narrowed, before the reader touches anything. [This link](/filters/filters-and-urls?island=Dream) opens this page with Dream picked in the first example above.

When the page opens, a filter takes its value from the URL first, then from its `initialValue`, and otherwise starts empty. An old link never narrows to a value that no longer exists: a Dropdown, MultiSelect or ButtonGroup clears a URL value its loaded options do not hold, a Slider moves one outside its ends to the nearest end, and words a DateRange does not know narrow nothing.

### Back and forward

A pick replaces the page's URL instead of adding a step to the browser history: Back leaves the page, and does not undo the last pick.

### Names a filter cannot take

`edit` and `lang` are names biac uses in the URL itself, to open the page editor and to choose the page language, so a filter named either fails the page with a message naming the clash. Two inputs with the same `id` on one page are one filter: they share one value, and a pick in either moves both.
