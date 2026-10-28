---
title: Note
icon: file-text
sidebar_position: 402
keywords: [footnote, annotation, caption, source, small text, Note]
---

# Note

`<Note>` sets a line in small, muted text: a source credit under a chart, a footnote on how a number was computed. It takes no props; its children are Markdown.

The chart on this page reads this query. A widget names a query by the name after ` ```sql `, so `data="…"` below is always this name.

`species_count`:

```sql species_count echo
select species, count(*) as penguins
from penguins
group by species
order by penguins desc
```

## Examples

### A source line under a chart

Place a note right after the widget it describes.

```mdx echo
<BarChart data="species_count" x="species" y="penguins" />

<Note>

Source: Gorman, Williams and Fraser (2014), Palmer Station LTER.

</Note>
```

### A footnote with Markdown

Links, emphasis and inline code work inside a note.

```mdx echo
<Note>
  Counts include penguins with *missing* measurements; see
  [Callout](/layout/callout) for how to flag a caveat louder.
</Note>
```

## Props

`<Note>` takes no props.
