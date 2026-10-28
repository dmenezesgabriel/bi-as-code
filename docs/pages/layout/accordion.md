---
title: Accordion
icon: book-open
sidebar_position: 406
keywords:
  [collapsible, expand, collapse, faq, sections, Accordion, AccordionItem]
---

# Accordion

`<Accordion>` stacks titled sections that each open and close on a click: a list of definitions, an FAQ, a set of supporting tables. Each section is an `<AccordionItem>` whose children are Markdown and widgets. For a single toggle, use [Details](/layout/details).

A closed section stays in the page, so the browser's find-in-page still finds its text and opens it.

The widget examples on this page read this query. A widget names a query by the name after ` ```sql `, so `data="…"` below is always this name.

`island_count`:

```sql island_count echo
select island, count(*) as penguins
from penguins
group by island
order by penguins desc
```

## Examples

### Sections that open on a click

Each `<AccordionItem>` needs a `title`. Every section starts closed, and several can be open at once.

```mdx echo
<Accordion>
  <AccordionItem title="What is a bill?">
    A penguin's beak. Its length and depth are measured in millimetres.
  </AccordionItem>
  <AccordionItem title="What is a flipper?">
    A penguin's wing, adapted for swimming. Its length is measured in
    millimetres.
  </AccordionItem>
</Accordion>
```

### Open from the start

`open` on an `<AccordionItem>` starts that section expanded.

```mdx echo
<Accordion>
  <AccordionItem title="Penguins per island" open>
    <Table data="island_count" />
  </AccordionItem>
  <AccordionItem title="About the islands">
    Biscoe, Dream and Torgersen lie in the Palmer Archipelago, off the Antarctic
    Peninsula.
  </AccordionItem>
</Accordion>
```

### One at a time

`single` keeps at most one section open: opening another closes the one before. If several items set `open`, only the first starts expanded.

```mdx echo
<Accordion single>
  <AccordionItem title="Adelie" open>
    Found on all three islands.
  </AccordionItem>
  <AccordionItem title="Gentoo">

    Found only on Biscoe.

  </AccordionItem>
  <AccordionItem title="Chinstrap">

    Found only on Dream.

  </AccordionItem>
</Accordion>
```

### Well and card

`variant="well"` sets the sections on a shaded panel; `variant="card"` on a raised card.

```mdx echo
<Accordion variant="well">
  <AccordionItem title="On a well">
    The shaded panel sets the sections apart from the prose.
  </AccordionItem>
</Accordion>

<Accordion variant="card">
  <AccordionItem title="On a card">
    The card lifts the sections off the page.
  </AccordionItem>
</Accordion>
```

## Props

### Accordion

| Prop      | Type                              | Default     | What it does                             |
| --------- | --------------------------------- | ----------- | ---------------------------------------- |
| `variant` | `"default"`, `"well"` or `"card"` | `"default"` | No box, a shaded panel, or a raised card |
| `single`  | boolean                           | `false`     | Keep at most one section open            |

### AccordionItem

| Prop    | Type    | Default  | What it does                |
| ------- | ------- | -------- | --------------------------- |
| `title` | string  | required | The section's label         |
| `open`  | boolean | `false`  | Start this section expanded |

## Errors

A mistake in the markup shows as a message where the accordion would be, and the rest of the page still renders: a `variant` outside the three names, a child of `<Accordion>` that is not an `<AccordionItem>`, an `<AccordionItem>` without a `title`, or an `<AccordionItem>` outside `<Accordion>`.
