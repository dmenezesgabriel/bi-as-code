---
title: Row
icon: layout-dashboard
sidebar_position: 407
keywords: [columns, side by side, grid, horizontal, Row]
---

# Row

`<Row>` places its children side by side and shares the width equally between them: a line of headline numbers, two charts to compare. When the page is too narrow for every child to keep about 192 px, the row wraps onto more lines; on a phone-width window (narrower than 768 px) each child takes the full width, one under the other. To stack children on purpose, use a [Stack](/layout/stack).

The widget examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`penguin_count`:

```sql penguin_count echo
select count(*) as penguins, count(distinct species) as species, count(distinct island) as islands
from penguins
```

`species_count`:

```sql species_count echo
select species, count(*) as penguins
from penguins
group by species
order by penguins desc
```

`island_count`:

```sql island_count echo
select island, count(*) as penguins
from penguins
group by island
order by penguins desc
```

## Examples

### Headline numbers in a line

Each child gets an equal share of the row.

```mdx echo
<Row>
  <BigValue data="penguin_count" column="penguins" title="Penguins" />
  <BigValue data="penguin_count" column="species" title="Species" />
  <BigValue data="penguin_count" column="islands" title="Islands" />
</Row>
```

### Two charts to compare

```mdx echo
<Row>
  <BarChart data="species_count" x="species" y="penguins" title="By species" />
  <BarChart data="island_count" x="island" y="penguins" title="By island" />
</Row>
```

### Vertical alignment

`align` sets where children shorter than the row sit: `top`, `center`, `bottom`, or `stretch` (the default) to the height of the tallest. On a phone-width window the children are stacked, so `align` has nothing to align.

```mdx echo
<Row align="center">
  <BigValue data="penguin_count" column="penguins" title="Penguins" />
  <BarChart data="species_count" x="species" y="penguins" />
</Row>
```

## Props

| Prop    | Type                                           | Default     | What it does                            |
| ------- | ---------------------------------------------- | ----------- | --------------------------------------- |
| `align` | `"top"`, `"center"`, `"bottom"` or `"stretch"` | `"stretch"` | Where children shorter than the row sit |

## Errors

An `align` outside the four names shows a message where the row would be, naming the value and the four it accepts; the rest of the page still renders.
