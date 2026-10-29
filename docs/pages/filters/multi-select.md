---
title: MultiSelect
icon: list-checks
sidebar_position: 502
keywords: [multi-select, multiselect, select, filter, chips, MultiSelect]
---

# MultiSelect

`<MultiSelect>` lets a reader pick any number of values from a list, and narrows every widget that names it in `filters` to the rows holding one of them. Each pick shows as a chip in the field, with a button to remove it. The picks are written to the page URL as `?id=["a","b"]`, so a reload or a shared link opens the page with the same picks. For one value, use a [Dropdown](/filters/dropdown).

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`island_species`:

```sql island_species echo
select island, species, count(*) as penguins
from penguins
group by island, species
order by island, species
```

`species_names`:

```sql species_names echo
select distinct species, species || ' penguin' as species_name
from penguins
order by species
```

`species_by_size`:

```sql species_by_size echo
select species, count(*) as penguins
from penguins
group by species
order by penguins desc
```

Every filter on a page shares its URL, so each example below gives its field its own `id`.

## Examples

### Narrow a widget

`id` names the filter. `data` names the query the options come from, and `valueColumn` the column whose distinct values they are. A widget lists the `id` in `filters` to be narrowed by the picks: the chart below keeps only the picked species. With nothing picked, it shows every row.

```mdx echo
<MultiSelect
  id="species"
  data="species_by_size"
  valueColumn="species"
  title="Species"
/>

<BarChart
  data="island_species"
  x="island"
  y="penguins"
  series="species"
  filters="species"
/>
```

Type in the field to narrow the list. The open list also has Select All, which picks every option, and Clear, which removes every pick.

### Show labels apart from values

`labelColumn` names a column whose text the list and the chips show in place of the value. The filter still narrows on `valueColumn`.

```mdx echo
<MultiSelect
  id="species_named"
  data="species_names"
  valueColumn="species"
  labelColumn="species_name"
  title="Species"
/>

<Table data="island_species" filters="species_named" />
```

### List fixed options

`options` lists the choices in the markup instead of reading them from a query. An option is a string, or an object with a `value` and a `label`. Without `valueColumn`, the filter narrows on the column named like its `id`, here `island`.

```mdx echo
<MultiSelect
  id="island"
  options={[
    { value: "Biscoe", label: "Biscoe Island" },
    { value: "Dream", label: "Dream Island" },
    { value: "Torgersen", label: "Torgersen Island" },
  ]}
  title="Island"
/>

<Table data="island_species" filters="island" />
```

### Start on some values

`initialValue` is the list of picks the page opens with. A value in the URL wins over it.

```mdx echo
<MultiSelect
  id="species_start"
  data="species_by_size"
  valueColumn="species"
  initialValue={["Adelie", "Chinstrap"]}
  title="Species"
/>

<Table data="island_species" filters="species_start" />
```

### Start on the first options

`defaultTopN` picks the first N options once the options load; order the query so the ones that matter most come first. `selectFirst` is the same as `defaultTopN={1}`.

```mdx echo
<MultiSelect
  id="species_top"
  data="species_by_size"
  valueColumn="species"
  defaultTopN={2}
  title="Two largest species"
/>

<Table data="island_species" filters="species_top" />
```

### Placeholder

`placeholder` is the text the field shows with nothing picked. Without it the field reads Select and the `valueColumn` in title case, here Select Species, or Select Option when there is no `valueColumn`.

```mdx echo
<MultiSelect
  id="species_placeholder"
  data="species_by_size"
  valueColumn="species"
  placeholder="All species"
  title="Species"
/>
```

### Without search or Clear

`search={false}` stops typing in the field from narrowing the list, which suits a short list. `clear={false}` drops Select All and Clear from the open list; a chip's remove button still removes its pick.

```mdx echo
<MultiSelect
  id="species_plain"
  data="species_by_size"
  valueColumn="species"
  search={false}
  clear={false}
  title="Species"
/>
```

### Cascade from another filter

`filters` on a multi-select narrows its own options. The species list below offers only the species living on the picked islands, and a picked species drops out when no picked island has it.

```mdx echo
<MultiSelect
  id="cascade_island"
  options={["Biscoe", "Dream", "Torgersen"]}
  valueColumn="island"
  title="Island"
/>

<MultiSelect
  id="cascade_species"
  data="island_species"
  valueColumn="species"
  filters={["cascade_island"]}
  title="Species"
/>
```

The island field lists fixed options, and its `valueColumn` names the column it narrows on, since its `id` is not a column name.

## Props

| Prop           | Type                                  | Default                | What it does                                                          |
| -------------- | ------------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| `id`           | string                                | required               | The filter's name: in widgets' `filters`, the URL and `{{params.id}}` |
| `data`         | string                                | —                      | The query the options come from                                       |
| `valueColumn`  | string                                | `id`                   | The column holding the options' values; required with `data`          |
| `labelColumn`  | string                                | `valueColumn`          | The column holding the text each option and chip shows                |
| `options`      | list of strings or `{ value, label }` | —                      | Choices written in the markup, listed before the query's              |
| `title`        | string                                | —                      | The label above the field                                             |
| `placeholder`  | string                                | Select + `valueColumn` | The field's text with nothing picked                                  |
| `initialValue` | list of strings                       | —                      | The picks the page opens with when the URL holds none                 |
| `defaultTopN`  | number                                | —                      | Pick the first N options once the options load                        |
| `selectFirst`  | boolean                               | `false`                | Pick the first option once the options load                           |
| `search`       | boolean                               | `true`                 | Narrow the list as the reader types in the field                      |
| `clear`        | boolean                               | `true`                 | Show Select All and Clear in the open list                            |
| `filters`      | string or list of strings             | —                      | Other filters that narrow the options                                 |

## Errors

A `<MultiSelect>` with `data` but no `valueColumn`, or whose `data` names no query on the page, or whose query fails, shows a message in place of the field; the rest of the page still renders. A value in the URL that the loaded options do not hold is dropped from the picks.
