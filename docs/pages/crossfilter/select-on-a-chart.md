---
title: Select on a chart
icon: list-checks
sidebar_position: 610
keywords:
  [
    cross-filter,
    crossfilter,
    select,
    brush,
    click,
    legend,
    drag,
    shift-click,
    linked,
    how to,
  ]
---

# Select on a chart

A chart can narrow the other widgets on its page. Give it `select="crossfilter"`, then click a mark, drag across the plot or click a legend entry. This page shows each gesture, and which charts take which.

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`species_count`:

```sql species_count echo
select species, count(*) as penguins
from penguins
group by species
order by penguins desc
```

`island_species`, one row per species on each island:

```sql island_species echo
select island, species, count(*) as penguins
from penguins
group by island, species
order by island, species
```

`penguin_bills`:

```sql penguin_bills echo
select species, island, bill_length_mm, bill_depth_mm, flipper_length_mm, body_mass_g
from penguins
where bill_length_mm is not null
order by species
```

Every example below selects on a different column. A selection is named after the column it selects on, so two charts that select on the same column share one selection.

## Narrow other widgets

A chart's selection narrows a widget when the widget's `filters` names the selected column, and its query returns a column of that name. A widget with no `filters`, or one that names another column, is left alone. The chart that makes the selection is never narrowed by it: it keeps every mark and dims the ones outside the selection.

## Click a mark

Click a bar to select it. The selection is the bar's `x` value, here a `species`, so the table, which lists `species` in `filters`, shows only that species' rows.

```mdx echo
<BarChart data="species_count" x="species" y="penguins" select="crossfilter" />

<Table data="island_species" filters="species" />
```

- Shift-click, or Cmd-click, another bar to add it to the selection, or to take it out again.
- Click a bar to replace the selection with that bar alone.
- Click the only selected bar to clear the selection.

## Drag across the plot

Drag across a chart to select a range. On a bar chart the range selects the bars it covers; on a line, area or scatter chart it selects a stretch of `x`; on a histogram it selects a range of `value`. Here the histogram shows the flipper lengths of the penguins whose bills fall in the dragged range.

```mdx echo
<ScatterChart
  data="penguin_bills"
  x="bill_length_mm"
  y="bill_depth_mm"
  series="species"
  select="crossfilter"
/>

<Histogram
  data="penguin_bills"
  value="flipper_length_mm"
  filters="bill_length_mm"
/>
```

Drag again to move on to a new range. Click the plot, outside the dragged range, to clear it.

## Click a legend entry

A chart with a `series` has a legend. Click an entry to switch its series off, and every widget whose `filters` names the `series` column drops that series' rows. Click it again to switch it back on; with every entry on, nothing is selected.

```mdx echo
<ScatterChart
  data="penguin_bills"
  x="flipper_length_mm"
  y="body_mass_g"
  series="island"
  select="crossfilter"
/>

<Table data="island_species" filters="island" />
```

A legend selects only when `series` names a column and `y` is a single column. With `y` a list, the legend entries name measures, not values of a column, so they only hide and show lines.

## Which gestures each widget takes

| Widget                                     | Click a mark     | Drag a range       | Legend entry              |
| ------------------------------------------ | ---------------- | ------------------ | ------------------------- |
| [Bar chart](/components/bar-chart)         | a bar            | the bars it covers | with `series` and one `y` |
| [Line chart](/components/line-chart)       | a point          | a stretch of `x`   | with `series` and one `y` |
| [Area chart](/components/area-chart)       | a point          | a stretch of `x`   | with `series` and one `y` |
| [Scatter chart](/components/scatter-chart) | a point          | a range of `x`     | with `series` and one `y` |
| [Histogram](/components/histogram)         | no click gesture | a range of `value` | with `series`             |
| [Heatmap](/components/heatmap)             | no `select`      | no `select`        | no `select`               |

A [Table](/components/table), [Big value](/components/big-value) and [Value](/components/value) take no `select`; they only narrow.

## A chart's pick is not in the URL

A selection made on a chart lasts for the visit. It is not written to the URL, and reloading the page clears it. To share a narrowed page, use a [filter input](/filters/filters-and-urls), which writes its value to the URL.
