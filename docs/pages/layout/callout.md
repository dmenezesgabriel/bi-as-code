---
title: Callout
icon: info
sidebar_position: 401
keywords: [alert, banner, notice, admonition, warning, Callout]
---

# Callout

`<Callout>` draws a tinted, bordered box around a message so it stands out from the prose around it: a reading guide, a caveat on the numbers, a warning before a decision. Its children are ordinary Markdown, so a callout can hold paragraphs, lists, links and widgets.

The widget examples on this page read this query. A widget names a query by the name after ` ```sql `, so `data="…"` below is always this name.

`penguin_count`:

```sql penguin_count echo
select count(*) as penguins, count(distinct species) as species
from penguins
```

## Examples

### A message

With no props, a callout is an `info` box.

```mdx echo
<Callout>

Every chart on this page reads the penguins dataset.

</Callout>
```

### Title

`title` adds a bold heading line above the message.

```mdx echo
<Callout title="About the data">
  The measurements were taken on three islands of the Palmer Archipelago between
  2007 and 2009.
</Callout>
```

### Type

`type` picks the tone: `info`, `success`, `warning` or `error`. Each keeps its contrast in light and dark mode.

```mdx echo
<Callout type="success" title="Complete">
  Every penguin in the dataset has a species and an island.
</Callout>

<Callout type="warning" title="Missing measurements">
  A few penguins have no body mass or sex recorded; averages skip them.
</Callout>

<Callout type="error" title="Do not compare years">
  Fewer penguins were measured in 2007, so a yearly count is not a population
  trend.
</Callout>
```

### Markdown and widgets inside

The message is Markdown, so it takes emphasis, links and inline widgets such as a [Value](/components/value).

```mdx echo
<Callout title="At a glance">
  The dataset holds *every* penguin measured:
  <Value data="penguin_count" column="penguins" /> of them, across
  <Value data="penguin_count" column="species" /> species.
</Callout>
```

## Props

| Prop    | Type                                            | Default  | What it does                 |
| ------- | ----------------------------------------------- | -------- | ---------------------------- |
| `type`  | `"info"`, `"success"`, `"warning"` or `"error"` | `"info"` | The tone of the box          |
| `title` | string                                          | none     | A bold heading line above it |

## Errors

A `type` outside the four names shows a message where the callout would be, naming the value and the four it accepts; the rest of the page still renders.
