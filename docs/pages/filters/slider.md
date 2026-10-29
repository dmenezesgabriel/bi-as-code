---
title: Slider
icon: filter
sidebar_position: 504
keywords: [slider, range, number, numeric, between, minimum, filter, Slider]
---

# Slider

`<Slider>` lets a reader pick a number by dragging a thumb, and narrows every widget that names it in `filters` to the rows at or above that number. With `range` it draws two thumbs and narrows to the rows between them. The pick is written to the page URL as `?id=4000`, or `?id=3500 - 4500` for a range, so a reload or a shared link opens the page with the same pick. To pick from a list of values instead, use a [Dropdown](/filters/dropdown).

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`penguin_masses`:

```sql penguin_masses echo
select species, island, sex, body_mass_g
from penguins
where body_mass_g is not null
order by body_mass_g desc
```

`species`:

```sql species echo
select distinct species
from penguins
order by species
```

Every filter on a page shares its URL, so each example below gives its slider its own `id`.

## Examples

### Narrow a widget

`id` names the filter. `data` names the query the slider's ends come from, and `valueColumn` the column whose smallest and largest values they are. A widget lists the `id` in `filters` to be narrowed by the pick: the table below keeps only the penguins at least as heavy as the thumb. The slider starts at its lower end, which narrows nothing until the reader drags it.

```mdx echo
<Slider
  id="mass"
  data="penguin_masses"
  valueColumn="body_mass_g"
  title="Body mass (g)"
/>

<Table data="penguin_masses" filters="mass" pageSize={5} />
```

### Pick a range

`range` draws two thumbs, and the widget keeps the rows between them, both ends included.

```mdx echo
<Slider
  id="mass_range"
  data="penguin_masses"
  valueColumn="body_mass_g"
  range
  title="Body mass (g)"
/>

<Table data="penguin_masses" filters="mass_range" pageSize={5} />
```

### Set the ends and the step

`min` and `max` set the slider's ends, and `step` how far one move goes. They work without `data`, and they override the ends a query gives. `valueColumn` still names the column the widget is narrowed on.

```mdx echo
<Slider
  id="mass_stepped"
  valueColumn="body_mass_g"
  min={2500}
  max={6500}
  step={500}
  title="Body mass (g)"
/>

<Table data="penguin_masses" filters="mass_stepped" pageSize={5} />
```

Without any of them, a slider runs from 0 to 100 in steps of 1.

### Start on a value

`initialValue` is the pick the page opens with when the URL holds none. A range slider takes a pair.

```mdx echo
<Slider
  id="mass_initial"
  data="penguin_masses"
  valueColumn="body_mass_g"
  initialValue={5000}
  title="Body mass (g)"
/>

<Table data="penguin_masses" filters="mass_initial" pageSize={5} />
```

```mdx echo
<Slider
  id="mass_range_initial"
  data="penguin_masses"
  valueColumn="body_mass_g"
  range
  initialValue={[3500, 4500]}
  title="Body mass range (g)"
/>

<Table data="penguin_masses" filters="mass_range_initial" pageSize={5} />
```

A pick outside the slider's ends moves to the nearest end.

### Title

`title` is the label above the slider. Without it, the label is the `id` in title case.

```mdx echo
<Slider id="flipper_length" min={170} max={235} />
```

### Narrow the ends with another filter

`filters` lists other filters that narrow the query the ends come from. Pick a species below and the slider's ends move to that species' lightest and heaviest penguin.

```mdx echo
<Dropdown
  id="mass_species"
  data="species"
  valueColumn="species"
  title="Species"
/>

<Slider
  id="mass_by_species"
  data="penguin_masses"
  valueColumn="body_mass_g"
  filters="mass_species"
  range
  title="Body mass (g)"
/>

<Table
  data="penguin_masses"
  filters={["mass_species", "mass_by_species"]}
  pageSize={5}
/>
```

When the other filters leave a single value, the slider shows that value as text in place of the track.

### Use the pick in a query

A query can read the pick itself as `{{params.id}}`, which holds the slider's lower end before the reader drags, or both ends for a range. A slider without `valueColumn` narrows no widget, and is read only this way.

```mdx echo
<Slider
  id="heavier_than"
  min={2500}
  max={6500}
  step={100}
  title="Heavier than (g)"
/>
```

`heavy_share`:

```sql heavy_share echo
select
  species,
  count(*) filter (where body_mass_g > coalesce({{params.heavier_than}}, 0)) as heavier,
  count(*) as penguins
from penguins
group by species
order by species
```

```mdx echo
<Table data="heavy_share" />
```

## Props

| Prop           | Type                      | Default          | What it does                                                          |
| -------------- | ------------------------- | ---------------- | --------------------------------------------------------------------- |
| `id`           | string                    | required         | The filter's name: in widgets' `filters`, the URL and `{{params.id}}` |
| `data`         | string                    | —                | The query the slider's ends come from                                 |
| `valueColumn`  | string                    | —                | The column the ends come from and widgets are narrowed on             |
| `min`          | number                    | the query's, 0   | The lower end                                                         |
| `max`          | number                    | the query's, 100 | The upper end                                                         |
| `step`         | number                    | `1`              | How far one move goes                                                 |
| `range`        | boolean                   | `false`          | Draw two thumbs and keep the rows between them                        |
| `title`        | string                    | `id`             | The label above the slider                                            |
| `initialValue` | number, or a pair         | —                | The pick the page opens with when the URL holds none                  |
| `filters`      | string or list of strings | —                | Other filters that narrow the query the ends come from                |

## Errors

A `<Slider>` with `data` but no `valueColumn`, or whose `data` names no query on the page, or whose query fails, shows a message in place of the slider; so does one whose `min` is larger than its `max`. The rest of the page still renders. A value in the URL outside the slider's ends moves to the nearest end.
