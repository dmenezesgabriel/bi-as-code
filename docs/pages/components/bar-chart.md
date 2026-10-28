---
title: Bar chart
icon: chart-column
sidebar_position: 304
keywords: [bar, column, stacked, BarChart]
---

# Bar chart

`<BarChart>` draws one bar per row of a ` ```sql ` fence named by `data`: `x` names the column along the axis and `y` the column that sets each bar's height. Bars compare amounts across categories; for a trend over time, use a [Line chart](/components/line-chart).

The chart issues no query of its own. The query groups, sorts and computes, so the bars appear in the fence's `order by` order and a ratio or a total is a column you compute in SQL.

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`species_count`:

```sql species_count echo
select species, count(*) as penguins
from penguins
group by species
order by penguins desc
```

`species_by_island`:

```sql species_by_island echo
select island, species, count(*) as penguins
from penguins
group by island, species
order by island, species
```

`species_bills`:

```sql species_bills echo
select species, avg(bill_length_mm) as bill_length_mm, avg(bill_depth_mm) as bill_depth_mm
from penguins
group by species
order by species
```

`quarterly_rain_2015`:

```sql quarterly_rain_2015 echo
select date_trunc('quarter', date) as quarter, sum(precipitation) as precipitation_mm
from weather
where year(date) = 2015
group by all
order by quarter
```

`islands`:

```sql islands echo
select distinct island
from penguins
order by island
```

## Examples

### Bars from a query

`data`, `x` and `y` are all a bar chart needs. Hover a bar to read its value.

```mdx echo
<BarChart data="species_count" x="species" y="penguins" />
```

### Several measures

`y` takes a list of columns, and each column draws its own bars side by side. A legend names them.

```mdx echo
<BarChart
  data="species_bills"
  x="species"
  y={["bill_length_mm", "bill_depth_mm"]}
/>
```

### Split by a column

`series` names a column whose values split the bars, one colour per value. With `series`, the query returns one row per `x` and series value.

```mdx echo
<BarChart data="species_by_island" x="island" y="penguins" series="species" />
```

### Stacked

`stacked` piles the series into one bar per `x`, so the bar's height is the total.

```mdx echo
<BarChart
  data="species_by_island"
  x="island"
  y="penguins"
  series="species"
  stacked
/>
```

### Stacked to 100%

`stacked="100%"` draws each series as its share of the bar, so every bar is the same height and the value axis reads in percent.

```mdx echo
<BarChart
  data="species_by_island"
  x="island"
  y="penguins"
  series="species"
  stacked="100%"
/>
```

### Value labels

`labels` prints each bar's value on it. On bars that are not stacked, the labels take the place of the value axis and its gridlines.

```mdx echo
<BarChart data="species_count" x="species" y="penguins" labels />
```

### Label format

`labelsFmt` formats the labels with a [format code](/components/value#format-codes). Without it, labels follow `yFmt`, or show percent on a 100% stack.

```mdx echo
<BarChart
  data="species_bills"
  x="species"
  y={["bill_length_mm", "bill_depth_mm"]}
  labels
  labelsFmt="num1"
/>
```

### Colour

`color` paints every bar one CSS colour.

```mdx echo
<BarChart data="species_count" x="species" y="penguins" color="#0f766e" />
```

### Series colours

`seriesColors` maps a series name to a CSS colour. Series it does not name keep the theme's colours.

```mdx echo
<BarChart
  data="species_by_island"
  x="island"
  y="penguins"
  series="species"
  seriesColors={{ Adelie: "#f97316", Chinstrap: "#a855f7", Gentoo: "#0d9488" }}
/>
```

### X format

`xFmt` formats the `x` labels and the tooltip's heading. A date `x` draws a time axis with a tick on each date when there are 15 or fewer; labels that would touch thin to every other one (or every third…), keeping the first and last.

```mdx echo
<BarChart
  data="quarterly_rain_2015"
  x="quarter"
  y="precipitation_mm"
  xFmt="mdy"
/>
```

### Y format

`yFmt` formats the value axis and the tooltip. With no `yFmt`, the axis picks its decimals from its range.

```mdx echo
<BarChart data="species_bills" x="species" y="bill_length_mm" yFmt="num1" />
```

### Title and subtitle

`title` heads the chart and `subtitle` sits under it, both above the plot.

```mdx echo
<BarChart
  data="species_count"
  x="species"
  y="penguins"
  title="Penguins per species"
  subtitle="Palmer Station, 2007–2009"
/>
```

### Axis titles

`xTitle` and `yTitle` name the axes.

```mdx echo
<BarChart
  data="species_count"
  x="species"
  y="penguins"
  xTitle="Species"
  yTitle="Penguins"
/>
```

### Without the legend

A chart with more than one series shows a legend. `legend={false}` hides it; the tooltip still names each series.

```mdx echo
<BarChart
  data="species_by_island"
  x="island"
  y="penguins"
  series="species"
  legend={false}
/>
```

### Height

`height` sets the chart's height in pixels. The width always fills the column.

```mdx echo
<BarChart data="species_count" x="species" y="penguins" height={180} />
```

### SVG renderer

`renderer="svg"` draws the chart as SVG instead of on a canvas, which keeps it sharp when zoomed or printed.

```mdx echo
<BarChart data="species_count" x="species" y="penguins" renderer="svg" />
```

### Narrow with a filter

`filters` names the page filters whose selections narrow the chart's query. A filter narrows on its `valueColumn`, so the query must return a column of that name. Pick an island below and the chart re-queries; clear it and every island returns.

```mdx echo
<Dropdown id="island" data="islands" valueColumn="island" title="Island" />

<BarChart
  data="species_by_island"
  x="species"
  y="penguins"
  series="island"
  filters="island"
/>
```

`filters` also takes a list, `filters={["island", "species"]}`, and every listed filter narrows the query.

### Select to cross-filter

`select="crossfilter"` lets a reader select on the chart: click a bar, shift-click to add more, drag across bars, or click a legend entry to select a series. The selection is a filter named after the selected column, so it narrows every widget whose `filters` name that column. Click a species in the first chart and the second shows only that species; click the selected bar again to clear it.

```mdx echo
<BarChart data="species_count" x="species" y="penguins" select="crossfilter" />

<BarChart
  data="species_by_island"
  x="island"
  y="penguins"
  series="species"
  filters="species"
/>
```

Give each chart both `select` and `filters` and the selections run both ways; a chart is never narrowed by its own selection.

## Props

| Prop           | Type                   | Default                           | What it does                                                          |
| -------------- | ---------------------- | --------------------------------- | --------------------------------------------------------------------- |
| `data`         | string                 | required                          | The name of a ` ```sql ` fence on the page                            |
| `x`            | string                 | required                          | The column along the axis                                             |
| `y`            | string or string\[\]   | required                          | The numeric column, or columns, that set the bars' heights            |
| `series`       | string                 | none                              | A column whose values split the bars, one colour each                 |
| `stacked`      | boolean or `"100%"`    | `false`                           | Pile the series into one bar; `"100%"` draws shares                   |
| `labels`       | boolean                | `false`                           | Print each bar's value on it                                          |
| `labelsFmt`    | string                 | `yFmt`, or `pct0` on a 100% stack | A [format code](/components/value#format-codes) for the labels        |
| `color`        | string                 | the theme's palette               | One CSS colour for every bar                                          |
| `seriesColors` | `{ [series]: colour }` | the theme's palette               | A CSS colour per series name                                          |
| `xFmt`         | string                 | the axis's own labels             | A format code for the `x` labels and the tooltip heading              |
| `yFmt`         | string                 | auto-scaled number                | A format code for the value axis and the tooltip                      |
| `title`        | string                 | none                              | The chart's heading                                                   |
| `subtitle`     | string                 | none                              | A line under the title                                                |
| `xTitle`       | string                 | none                              | The `x` axis name                                                     |
| `yTitle`       | string                 | none                              | The value axis name                                                   |
| `legend`       | boolean                | `true` with more than one series  | Show the legend                                                       |
| `height`       | number                 | `300`                             | The chart's height in pixels                                          |
| `renderer`     | `"canvas"` or `"svg"`  | `"canvas"`                        | How the chart is drawn                                                |
| `filters`      | string or string\[\]   | none                              | Page filter ids whose selections narrow the query                     |
| `select`       | `"crossfilter"`        | none                              | Let a reader's selection on the chart narrow the page's other widgets |

## Errors

A mistake in a bar chart's markup shows as a message where the chart would be, and the rest of the page still renders. The message names the query and what is wrong: a `data` that names no fence on the page, an `x`, `y` or `series` the query does not return (with the columns it does return), or a format code the column cannot take. A query that returns no rows, such as one a filter narrows to nothing, shows "0 rows" in the chart's place, at the chart's height.
