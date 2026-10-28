---
title: Details
icon: folder
sidebar_position: 404
keywords: [disclosure, collapsible, expand, collapse, toggle, Details]
---

# Details

`<Details>` hides a section behind a titled toggle: metric definitions, methodology, a table most readers do not need. A reader clicks the title, or focuses it and presses Enter or Space, to open or close it. Its children are Markdown and widgets; for several toggles in one group, use an [Accordion](/layout/accordion).

The table on this page reads this query. A widget names a query by the name after ` ```sql `, so `data="…"` below is always this name.

`species_mass`:

```sql species_mass echo
select species, count(*) as penguins, round(avg(body_mass_g)) as body_mass_g
from penguins
group by species
order by penguins desc
```

## Examples

### Closed until clicked

`title` labels the toggle. The section starts closed.

```mdx echo
<Details title="How body mass is measured">
  Each penguin was weighed in grams with a spring scale at capture. Penguins
  without a recorded mass are left out of averages.
</Details>
```

### Open from the start

`open` starts the section expanded. The reader can still close it.

```mdx echo
<Details title="Body mass by species" open>
  <Table data="species_mass" />
</Details>
```

### Open on phones only

`openMobile` sets the starting state on a phone-width window (narrower than 768 px), where it wins over `open`. The section below starts open on a phone and closed on a wider screen. Both are read once, when the page loads.

```mdx echo
<Details title="Summary for phones" openMobile>
  Gentoo penguins are the heaviest of the three species on average.
</Details>
```

## Props

| Prop         | Type    | Default  | What it does                                    |
| ------------ | ------- | -------- | ----------------------------------------------- |
| `title`      | string  | required | The toggle's label                              |
| `open`       | boolean | `false`  | Start expanded                                  |
| `openMobile` | boolean | `open`   | Start expanded on a window narrower than 768 px |

## Errors

A `<Details>` without a `title` shows a message where it would be instead of a toggle with no label; the rest of the page still renders.
