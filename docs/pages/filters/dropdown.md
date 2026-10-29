---
title: Dropdown
icon: filter
sidebar_position: 501
keywords: [dropdown, select, filter, combobox, cascading, linked, Dropdown]
---

# Dropdown

`<Dropdown>` lets a reader pick one value from a list, and narrows every widget that names it in `filters` to the rows holding that value. The pick is written to the page URL as `?id=value`, so a reload or a shared link opens the page with the same pick. To pick several values, use a [MultiSelect](/filters/multi-select); to show every option at once as buttons, use a [ButtonGroup](/filters/button-group).

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`islands`:

```sql islands echo
select distinct island
from penguins
order by island
```

`island_species`:

```sql island_species echo
select island, species, count(*) as penguins
from penguins
group by island, species
order by island, species
```

`island_names`:

```sql island_names echo
select distinct island, island || ' Island' as island_name
from penguins
order by island
```

`sex_counts`:

```sql sex_counts echo
select sex, species, count(*) as penguins
from penguins
where sex is not null
group by sex, species
order by sex, species
```

Every filter on a page shares its URL, so each example below gives its dropdown its own `id`.

## Examples

### Narrow a widget

`id` names the filter. `data` names the query the options come from, and `valueColumn` the column whose distinct values they are. A widget lists the `id` in `filters` to be narrowed by the pick: the table below keeps only the rows whose `island` is the one picked. Pick Clear in the list to show every row again.

```mdx echo
<Dropdown id="island" data="islands" valueColumn="island" title="Island" />

<Table data="island_species" filters="island" />
```

### Show labels apart from values

`labelColumn` names a column whose text the list shows in place of the value. The filter still narrows on `valueColumn`, so the table matches `Biscoe` when the reader picks Biscoe Island.

```mdx echo
<Dropdown
  id="island_named"
  data="island_names"
  valueColumn="island"
  labelColumn="island_name"
  title="Island"
/>

<Table data="island_species" filters="island_named" />
```

### List fixed options

`options` lists the choices in the markup instead of reading them from a query. Without `valueColumn`, the filter narrows on the column named like its `id`, here `sex`.

```mdx echo
<Dropdown id="sex" options={["female", "male"]} title="Sex" />

<Table data="sex_counts" filters="sex" />
```

An option can also be an object with a `value` and a `label`. A string option is its own label.

```mdx echo
<Dropdown
  id="sex_labelled"
  options={[
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
  ]}
  title="Sex"
/>
```

With both `data` and `options`, the list shows the `options` first, then the query's values; a value in both keeps the label from `options`.

### Start on a value

`initialValue` is the pick the page opens with. A value in the URL wins over it.

```mdx echo
<Dropdown
  id="island_start"
  data="islands"
  valueColumn="island"
  initialValue="Dream"
  title="Island"
/>

<Table data="island_species" filters="island_start" />
```

### Start on the first option

`selectFirst` picks the first option once the options load, so the widgets never show every row at once.

```mdx echo
<Dropdown
  id="island_first"
  data="islands"
  valueColumn="island"
  selectFirst
  title="Island"
/>

<Table data="island_species" filters="island_first" />
```

### Placeholder

`placeholder` is the text the field shows before a pick. Without it the field reads Select and the `valueColumn` in title case, here Select Island, or Select Option when there is no `valueColumn`.

```mdx echo
<Dropdown
  id="island_placeholder"
  data="islands"
  valueColumn="island"
  placeholder="All islands"
  title="Island"
/>
```

### Without search or Clear

The open list has a search box that narrows it as the reader types, and a Clear entry that removes the pick. `search={false}` drops the box, which suits a short list; `clear={false}` drops Clear, so once a reader picks a value there is always one picked.

```mdx echo
<Dropdown
  id="island_plain"
  data="islands"
  valueColumn="island"
  search={false}
  clear={false}
  title="Island"
/>
```

### Cascade from another filter

`filters` on a dropdown narrows its own options. The species list below offers only the species living on the picked island; pick Torgersen and Adelie is the only choice. The table names both filters, so it narrows by both picks.

```mdx echo
<Dropdown
  id="cascade_island"
  data="islands"
  valueColumn="island"
  title="Island"
/>

<Dropdown
  id="cascade_species"
  data="island_species"
  valueColumn="species"
  filters="cascade_island"
  title="Species"
/>

<Table data="island_species" filters={["cascade_island", "cascade_species"]} />
```

If the picked species is not on a newly picked island, the species pick clears.

### Use the pick in a query

A query can read the pick itself as `{{params.id}}`, which is `null` before a pick. Use it where a `filters` match is not enough, such as in an aggregate or a join.

```mdx echo
<Dropdown
  id="param_island"
  data="islands"
  valueColumn="island"
  title="Island"
/>
```

`island_mass`:

```sql island_mass echo
select species, round(avg(body_mass_g)) as body_mass_g
from penguins
where {{params.param_island}} is null or island = {{params.param_island}}
group by species
order by species
```

```mdx echo
<Table data="island_mass" />
```

## Props

| Prop           | Type                                  | Default                | What it does                                                          |
| -------------- | ------------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| `id`           | string                                | required               | The filter's name: in widgets' `filters`, the URL and `{{params.id}}` |
| `data`         | string                                | —                      | The query the options come from                                       |
| `valueColumn`  | string                                | `id`                   | The column holding the options' values; required with `data`          |
| `labelColumn`  | string                                | `valueColumn`          | The column holding the text each option shows                         |
| `options`      | list of strings or `{ value, label }` | —                      | Choices written in the markup, listed before the query's              |
| `title`        | string                                | —                      | The label above the field                                             |
| `placeholder`  | string                                | Select + `valueColumn` | The field's text before a pick                                        |
| `initialValue` | string                                | —                      | The pick the page opens with when the URL holds none                  |
| `selectFirst`  | boolean                               | `false`                | Pick the first option once the options load                           |
| `search`       | boolean                               | `true`                 | Show a search box in the open list                                    |
| `clear`        | boolean                               | `true`                 | Show a Clear entry in the open list                                   |
| `filters`      | string or list of strings             | —                      | Other filters that narrow the options                                 |

## Errors

A `<Dropdown>` with `data` but no `valueColumn`, or whose `data` names no query on the page, or whose query fails, shows a message in place of the field; the rest of the page still renders. A value in the URL that the loaded options do not hold is cleared.
