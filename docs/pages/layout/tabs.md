---
title: Tabs
icon: sheet
sidebar_position: 405
keywords: [tab, tabbed, switch, panels, Tabs, Tab]
---

# Tabs

`<Tabs>` shows one of several panels at a time, under a row of tabs that switch between them: a chart and the table behind it, or the same chart for each species. Each panel is a `<Tab>` whose children are Markdown and widgets. With the keyboard, the arrow keys move between tabs and select the one they land on.

A panel that is not showing stays loaded, so a widget inside keeps its sort order, scroll position or selection when the reader switches away and back.

The widget examples on this page read this query. A widget names a query by the name after ` ```sql `, so `data="…"` below is always this name.

`species_count`:

```sql species_count echo
select species, count(*) as penguins
from penguins
group by species
order by penguins desc
```

## Examples

### A chart and its table

Each `<Tab>` needs a `title`, its label in the tab row. The first tab starts selected.

```mdx echo
<Tabs>
  <Tab title="Chart">
    <BarChart data="species_count" x="species" y="penguins" />
  </Tab>
  <Tab title="Table">
    <Table data="species_count" />
  </Tab>
</Tabs>
```

### Pick the starting tab

`default` on a `<Tab>` selects it when the page loads. Only one tab may set it.

```mdx echo
<Tabs>
  <Tab title="Chart">
    <BarChart data="species_count" x="species" y="penguins" />
  </Tab>
  <Tab title="Table" default>
    <Table data="species_count" />
  </Tab>
</Tabs>
```

### Well

`variant="well"` draws the tabs as buttons in a shaded tray, sized to their labels.

```mdx echo
<Tabs variant="well">
  <Tab title="Adelie">

    Adelie penguins live on all three islands.

  </Tab>
  <Tab title="Gentoo">

    Gentoo penguins live only on Biscoe.

  </Tab>
  <Tab title="Chinstrap">

    Chinstrap penguins live only on Dream.

  </Tab>
</Tabs>
```

### Full width

`fullWidth` stretches the tab row across the page and shares it equally between the tabs.

```mdx echo
<Tabs fullWidth>
  <Tab title="Adelie">

    Adelie penguins live on all three islands.

  </Tab>
  <Tab title="Gentoo">

    Gentoo penguins live only on Biscoe.

  </Tab>
</Tabs>
```

## Props

### Tabs

| Prop        | Type                    | Default     | What it does                                      |
| ----------- | ----------------------- | ----------- | ------------------------------------------------- |
| `variant`   | `"default"` or `"well"` | `"default"` | An underlined row, or buttons in a shaded tray    |
| `fullWidth` | boolean                 | `false`     | Stretch the row and share it equally between tabs |

### Tab

| Prop      | Type    | Default  | What it does                        |
| --------- | ------- | -------- | ----------------------------------- |
| `title`   | string  | required | The tab's label                     |
| `default` | boolean | `false`  | Select this tab when the page loads |

## Errors

A mistake in the markup shows as a message where the tabs would be, and the rest of the page still renders: a `variant` outside the two names, a child of `<Tabs>` that is not a `<Tab>`, a `<Tab>` without a `title`, more than one `default` tab, or a `<Tab>` outside `<Tabs>`.
