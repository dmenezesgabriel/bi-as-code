---
title: TextInput
icon: filter
sidebar_position: 506
keywords: [text input, text, free text, input, textbox, filter, TextInput]
---

# TextInput

`<TextInput>` lets a reader type any text, and hands it to the page's queries as `{{params.id}}`. It narrows no widget by itself: a query decides what the text means, such as a name to look up or a word to match. The text is written to the page URL as `?id=text` once the reader stops typing, presses Enter or leaves the box, so a reload or a shared link opens the page with the same text. To narrow widgets to the rows whose column holds the text, use a [Search](/filters/search).

Every filter on a page shares its URL, so each example below gives its text input its own `id`.

## Examples

### Use the text in a query

`id` names the filter, and a query reads the text as `{{params.id}}`, which is `null` while the box is empty. The query below keeps every island whose name holds the text, in any case. Type `bis` to keep Biscoe.

```mdx echo
<TextInput id="island_text" title="Island name" />
```

`islands_named`:

```sql islands_named echo
select island, count(*) as penguins
from penguins
where {{params.island_text}} is null
  or island ilike '%' || {{params.island_text}}::varchar || '%'
group by island
order by island
```

```mdx echo
<Table data="islands_named" />
```

The URL reads `?id=42` as the number 42 and `?id=true` as true, so cast the text with `::varchar` where the query needs text.

### Title

`title` is the label above the box. Without it, the label is the `id` in title case.

```mdx echo
<TextInput id="reader_name" />
```

### Placeholder

`placeholder` is the hint the box shows while it is empty.

```mdx echo
<TextInput id="island_hint" title="Island" placeholder="e.g. Dream" />
```

### Start on some text

`initialValue` is the text the page opens with when the URL holds none.

```mdx echo
<TextInput id="island_start" title="Island name" initialValue="Dream" />
```

`islands_started`:

```sql islands_started echo
select island, count(*) as penguins
from penguins
where {{params.island_start}} is null
  or island ilike '%' || {{params.island_start}}::varchar || '%'
group by island
order by island
```

```mdx echo
<Table data="islands_started" />
```

## Props

| Prop           | Type   | Default  | What it does                                         |
| -------------- | ------ | -------- | ---------------------------------------------------- |
| `id`           | string | required | The filter's name: in the URL and `{{params.id}}`    |
| `title`        | string | `id`     | The label above the box                              |
| `placeholder`  | string | —        | The hint the box shows while it is empty             |
| `initialValue` | string | —        | The text the page opens with when the URL holds none |

## Errors

A `<TextInput>` has no error of its own. A query that reads `{{params.id}}` and fails on the text shows its message where its widget would be.
