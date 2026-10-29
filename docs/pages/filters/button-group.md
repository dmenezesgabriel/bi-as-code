---
title: ButtonGroup
icon: filter
sidebar_position: 503
keywords: [button group, segmented control, toggle buttons, filter, ButtonGroup]
---

# ButtonGroup

`<ButtonGroup>` shows every option as a button in one row, and narrows every widget that names it in `filters` to the rows holding the pressed value. Pressing the pressed button again releases it. The pick is written to the page URL as `?id=value`, so a reload or a shared link opens the page with the same pick. It suits a few short options a reader should see without opening a list; for a long list, use a [Dropdown](/filters/dropdown).

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

`species_names`:

```sql species_names echo
select distinct species, species || ' penguin' as species_name
from penguins
order by species
```

Every filter on a page shares its URL, so each example below gives its group its own `id`.

## Examples

### Narrow a widget

`id` names the filter. `data` names the query the buttons come from, and `valueColumn` the column whose distinct values they are. A widget lists the `id` in `filters` to be narrowed by the pressed button.

```mdx echo
<ButtonGroup id="island" data="islands" valueColumn="island" />

<Table data="island_species" filters="island" />
```

### Title

`title` is the label above the buttons. Without it the label is the `id` in title case, as Island above.

```mdx echo
<ButtonGroup
  id="island_titled"
  data="islands"
  valueColumn="island"
  title="Where the penguin was found"
/>
```

### Show labels apart from values

`labelColumn` names a column whose text the buttons show in place of the value. The filter still narrows on `valueColumn`.

```mdx echo
<ButtonGroup
  id="species_named"
  data="species_names"
  valueColumn="species"
  labelColumn="species_name"
  title="Species"
/>

<Table data="island_species" filters="species_named" />
```

### List fixed options

`options` lists the buttons in the markup instead of reading them from a query. An option is a string, or an object with a `value` and a `label`. Without `valueColumn`, the filter narrows on the column named like its `id`, here `species`.

```mdx echo
<ButtonGroup
  id="species"
  options={[
    { value: "Adelie", label: "Adélie" },
    { value: "Chinstrap", label: "Chinstrap" },
    { value: "Gentoo", label: "Gentoo" },
  ]}
/>

<Table data="island_species" filters="species" />
```

### Start on a value

`initialValue` is the button pressed when the page opens. A value in the URL wins over it.

```mdx echo
<ButtonGroup
  id="island_start"
  data="islands"
  valueColumn="island"
  initialValue="Dream"
  title="Island"
/>

<Table data="island_species" filters="island_start" />
```

### Start on the first option

`selectFirst` presses the first button once the options load.

```mdx echo
<ButtonGroup
  id="island_first"
  data="islands"
  valueColumn="island"
  selectFirst
  title="Island"
/>

<Table data="island_species" filters="island_first" />
```

### Press several

`multiple` lets the reader press several buttons; the widgets keep the rows holding any of them, and the URL holds the list as `?id=["a","b"]`. `initialValue` is then a list.

```mdx echo
<ButtonGroup
  id="islands_pressed"
  data="islands"
  valueColumn="island"
  multiple
  initialValue={["Biscoe", "Torgersen"]}
  title="Islands"
/>

<Table data="island_species" filters="islands_pressed" />
```

### Cascade from another filter

`filters` on a button group narrows its own buttons. The species buttons below show only the species living on the pressed island, and a pressed species is released when the newly pressed island has none.

```mdx echo
<ButtonGroup
  id="cascade_island"
  data="islands"
  valueColumn="island"
  title="Island"
/>

<ButtonGroup
  id="cascade_species"
  data="island_species"
  valueColumn="species"
  filters="cascade_island"
  title="Species"
/>

<Table data="island_species" filters={["cascade_island", "cascade_species"]} />
```

## Props

| Prop           | Type                                  | Default            | What it does                                                          |
| -------------- | ------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| `id`           | string                                | required           | The filter's name: in widgets' `filters`, the URL and `{{params.id}}` |
| `data`         | string                                | —                  | The query the buttons come from                                       |
| `valueColumn`  | string                                | `id`               | The column holding the buttons' values; required with `data`          |
| `labelColumn`  | string                                | `valueColumn`      | The column holding the text each button shows                         |
| `options`      | list of strings or `{ value, label }` | —                  | Buttons written in the markup, listed before the query's              |
| `title`        | string                                | `id` in title case | The label above the buttons                                           |
| `initialValue` | string, or a list with `multiple`     | —                  | The pressed value the page opens with when the URL holds none         |
| `selectFirst`  | boolean                               | `false`            | Press the first button once the options load                          |
| `multiple`     | boolean                               | `false`            | Let the reader press several buttons                                  |
| `filters`      | string or list of strings             | —                  | Other filters that narrow the buttons                                 |

## Errors

A `<ButtonGroup>` with `data` but no `valueColumn`, or whose `data` names no query on the page, or whose query fails, shows a message in place of the buttons; the rest of the page still renders. A group whose query returns no rows shows a disabled No options available button. A value in the URL that the loaded options do not hold is released.
