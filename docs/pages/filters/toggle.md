---
title: Toggle
icon: filter
sidebar_position: 507
keywords: [toggle, switch, checkbox, boolean, on off, filter, Toggle]
---

# Toggle

`<Toggle>` is a switch a reader turns on or off, and hands its state to the page's queries as `{{params.id}}`: `true` or `false`, and `false` before the first flip unless `initialValue` says otherwise. It narrows no widget by itself: a query decides what on means. The state is written to the page URL as `?id=true` or `?id=false`, so a reload or a shared link opens the page with the switch where it was left.

Every filter on a page shares its URL, so each example below gives its toggle its own `id`.

## Examples

### Use the state in a query

`id` names the filter, and a query reads the state as `{{params.id}}`. The query below counts only the male penguins while the switch is on, and every penguin while it is off.

```mdx echo
<Toggle id="males_only" label="Males only" />
```

`species_males`:

```sql species_males echo
select species, count(*) as penguins
from penguins
where {{params.males_only}} is distinct from true or sex = 'male'
group by species
order by species
```

```mdx echo
<Table data="species_males" />
```

### Label

`label` is the text beside the switch; a click on it flips the switch too. Without it, the label is the `id` in title case.

```mdx echo
<Toggle id="show_outliers" />
```

### Start on

`initialValue` is the state the page opens with when the URL holds none.

```mdx echo
<Toggle id="females_only" label="Females only" initialValue />
```

`species_females`:

```sql species_females echo
select species, count(*) as penguins
from penguins
where {{params.females_only}} is distinct from true or sex = 'female'
group by species
order by species
```

```mdx echo
<Table data="species_females" />
```

### Invert

`invert` flips what the switch shows against the value it holds: the switch is on while the value is `false`. Use it when the query's natural flag reads as the opposite of the label, such as a `hide_unknown` flag behind a switch labelled Include unknown sex.

```mdx echo
<Toggle id="hide_unknown" label="Include unknown sex" invert />
```

`species_known`:

```sql species_known echo
select species, count(*) as penguins
from penguins
where {{params.hide_unknown}} is distinct from true or sex is not null
group by species
order by species
```

```mdx echo
<Table data="species_known" />
```

## Props

| Prop           | Type    | Default  | What it does                                                        |
| -------------- | ------- | -------- | ------------------------------------------------------------------- |
| `id`           | string  | required | The filter's name: in the URL and `{{params.id}}`                   |
| `label`        | string  | `id`     | The text beside the switch                                          |
| `initialValue` | boolean | `false`  | The state the page opens with when the URL holds none               |
| `invert`       | boolean | `false`  | Show the switch on while the value is `false`, and off while `true` |

## Errors

A `<Toggle>` has no error of its own. A query that reads `{{params.id}}` and fails shows its message where its widget would be.
