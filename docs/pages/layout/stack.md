---
title: Stack
icon: layers
sidebar_position: 408
keywords: [vertical, column, group, Stack]
---

# Stack

`<Stack>` places its children one under the other with an even gap between them. On its own a page already flows top to bottom; a stack earns its place inside a [Row](/layout/row), where it turns one share of the row into a column, such as a number over its caption.

The widget examples on this page read this query. A widget names a query by the name after ` ```sql `, so `data="…"` below is always this name.

`penguin_count`:

```sql penguin_count echo
select count(*) as penguins, count(distinct species) as species, count(distinct island) as islands
from penguins
```

## Examples

### A column inside a row

```mdx echo
<Row>
  <Stack>
    <BigValue data="penguin_count" column="penguins" title="Penguins" />
    <BigValue data="penguin_count" column="species" title="Species" />
  </Stack>
  <Callout title="Reading the numbers">
    The dataset counts every penguin measured between 2007 and 2009, across
    three islands.
  </Callout>
</Row>
```

### Horizontal alignment

`align` sets where each child sits across the stack's width: `left`, `center`, `right`, or `stretch` (the default) to the full width. Any value but `stretch` sizes each child to its content.

```mdx echo
<Stack align="center">
  <BigValue data="penguin_count" column="islands" title="Islands" />
  <Note>Biscoe, Dream and Torgersen</Note>
</Stack>
```

## Props

| Prop    | Type                                           | Default     | What it does                                   |
| ------- | ---------------------------------------------- | ----------- | ---------------------------------------------- |
| `align` | `"left"`, `"center"`, `"right"` or `"stretch"` | `"stretch"` | Where each child sits across the stack's width |

## Errors

An `align` outside the four names shows a message where the stack would be, naming the value and the four it accepts; the rest of the page still renders.
