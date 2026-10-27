---
title: Scatter chart
icon: target
sidebar_position: 307
keywords: [scatter, bubble, correlation, points, ScatterChart]
---

# Scatter chart

`<ScatterChart>` draws one point per row of a ` ```sql ` fence named by `data`: `x` names the column along the horizontal axis and `y` the column along the vertical one. Points show how two measures move together; to compare totals across categories, use a [Bar chart](/components/bar-chart).

The chart issues no query of its own. Every row the query returns is a point, so a scatter chart usually reads rows as they are, without a `group by`.

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`penguin_bills`:

```sql penguin_bills echo
select species, island, bill_length_mm, bill_depth_mm, flipper_length_mm, body_mass_g
from penguins
where bill_length_mm is not null
order by species
```

`colony_means`, one row per species on each island:

```sql colony_means echo
select island, species, count(*) as penguins,
  avg(bill_length_mm) as bill_length_mm, avg(bill_depth_mm) as bill_depth_mm,
  avg(flipper_length_mm) as flipper_length_mm, avg(body_mass_g) as body_mass_g
from penguins
group by island, species
order by island, species
```

`daily_temperatures`:

```sql daily_temperatures echo
select temp_min, temp_max, precipitation
from weather
```

`islands`:

```sql islands echo
select distinct island
from penguins
order by island
```

## Examples

### Points from a query

`data`, `x` and `y` are all a scatter chart needs. Hover a point to read its values.

```mdx echo
<ScatterChart data="penguin_bills" x="bill_length_mm" y="bill_depth_mm" />
```

### Several measures

`y` takes a list of columns, and each column draws its own points against the same `x`. A legend names them.

```mdx echo
<ScatterChart
  data="penguin_bills"
  x="body_mass_g"
  y={["bill_length_mm", "bill_depth_mm"]}
/>
```

### Split by a column

`series` names a column whose values split the points, one colour per value.

```mdx echo
<ScatterChart
  data="penguin_bills"
  x="bill_length_mm"
  y="bill_depth_mm"
  series="species"
/>
```

### Point size

`size` names a numeric column that sets each point's area, so the chart reads a third measure. The largest value draws the largest point, and the tooltip adds the `size` column. Here each point is one colony, sized by how many penguins it counts.

```mdx echo
<ScatterChart
  data="colony_means"
  x="bill_length_mm"
  y="bill_depth_mm"
  series="species"
  size="penguins"
/>
```

### Size format

`sizeFmt` formats the `size` value in the tooltip with a [format code](/components/value#format-codes).

```mdx echo
<ScatterChart
  data="colony_means"
  x="flipper_length_mm"
  y="bill_length_mm"
  size="body_mass_g"
  sizeFmt="num1k"
/>
```

### Value labels

`labels` prints each point's `y` value beside it. Labels that would overlap are left out, so they suit a chart with few points.

```mdx echo
<ScatterChart
  data="colony_means"
  x="flipper_length_mm"
  y="body_mass_g"
  labels
/>
```

### Label format

`labelsFmt` formats the labels. Without it, labels follow `yFmt`.

```mdx echo
<ScatterChart
  data="colony_means"
  x="flipper_length_mm"
  y="body_mass_g"
  labels
  labelsFmt="num1k"
/>
```

### Colour

`color` paints every point one CSS colour.

```mdx echo
<ScatterChart
  data="daily_temperatures"
  x="temp_min"
  y="temp_max"
  color="#0f766e"
/>
```

### Series colours

`seriesColors` maps a series name to a CSS colour. Series it does not name keep the theme's colours.

```mdx echo
<ScatterChart
  data="penguin_bills"
  x="bill_length_mm"
  y="bill_depth_mm"
  series="species"
  seriesColors={{ Adelie: "#f97316", Chinstrap: "#a855f7", Gentoo: "#0d9488" }}
/>
```

### X format

`xFmt` formats the `x` axis and the `x` row of the tooltip.

```mdx echo
<ScatterChart
  data="penguin_bills"
  x="body_mass_g"
  y="flipper_length_mm"
  xFmt="num1k"
/>
```

### Y format

`yFmt` formats the `y` axis and the `y` row of the tooltip. With no `yFmt`, the axis picks its decimals from its range.

```mdx echo
<ScatterChart
  data="penguin_bills"
  x="flipper_length_mm"
  y="body_mass_g"
  yFmt="num1k"
/>
```

### Title and subtitle

`title` heads the chart and `subtitle` sits under it, both above the plot.

```mdx echo
<ScatterChart
  data="daily_temperatures"
  x="temp_min"
  y="temp_max"
  title="Daily low against daily high"
  subtitle="Seattle, 2012–2015, °C"
/>
```

### Axis titles

`xTitle` and `yTitle` name the axes.

```mdx echo
<ScatterChart
  data="daily_temperatures"
  x="temp_min"
  y="temp_max"
  xTitle="Low (°C)"
  yTitle="High (°C)"
/>
```

### Without the legend

A chart with more than one series shows a legend. `legend={false}` hides it; the tooltip still names each point's series.

```mdx echo
<ScatterChart
  data="penguin_bills"
  x="bill_length_mm"
  y="bill_depth_mm"
  series="species"
  legend={false}
/>
```

### Height

`height` sets the chart's height in pixels. The width always fills the column.

```mdx echo
<ScatterChart
  data="daily_temperatures"
  x="temp_min"
  y="temp_max"
  height={180}
/>
```

### SVG renderer

`renderer="svg"` draws the chart as SVG instead of on a canvas, which keeps it sharp when zoomed or printed.

```mdx echo
<ScatterChart
  data="daily_temperatures"
  x="temp_min"
  y="temp_max"
  renderer="svg"
/>
```

### Narrow with a filter

`filters` names the page filters whose selections narrow the chart's query. A filter narrows on its `valueColumn`, so the query must return a column of that name. Pick an island below and the chart re-queries; clear it and every island returns.

```mdx echo
<Dropdown id="island" data="islands" valueColumn="island" title="Island" />

<ScatterChart
  data="penguin_bills"
  x="bill_length_mm"
  y="bill_depth_mm"
  series="species"
  filters="island"
/>
```

`filters` also takes a list, `filters={["island", "species"]}`, and every listed filter narrows the query.

### Select to cross-filter

`select="crossfilter"` lets a reader select on the chart: click a point, shift-click to add more, drag across the plot to select a range of `x`, or click a legend entry to select a series. The selection is a filter named after the selected column, so it narrows every widget whose `filters` name that column. Drag across the first chart and the second shows only the penguins whose bills fall in that range; click the plot to clear it.

```mdx echo
<ScatterChart
  data="penguin_bills"
  x="bill_length_mm"
  y="bill_depth_mm"
  series="species"
  select="crossfilter"
/>

<ScatterChart
  data="penguin_bills"
  x="flipper_length_mm"
  y="body_mass_g"
  series="species"
  filters={["bill_length_mm", "species"]}
/>
```

Give each chart both `select` and `filters` and the selections run both ways; a chart is never narrowed by its own selection.

## Props

| Prop           | Type                   | Default                          | What it does                                                              |
| -------------- | ---------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| `data`         | string                 | required                         | The name of a ` ```sql ` fence on the page                                |
| `x`            | string                 | required                         | The column along the horizontal axis                                      |
| `y`            | string or string\[\]   | required                         | The numeric column, or columns, along the vertical axis                   |
| `series`       | string                 | none                             | A column whose values split the points, one colour each                   |
| `size`         | string                 | none                             | A numeric column that sets each point's area                              |
| `sizeFmt`      | string                 | auto-scaled number               | A [format code](/components/value#format-codes) for `size` in the tooltip |
| `labels`       | boolean                | `false`                          | Print each point's value beside it                                        |
| `labelsFmt`    | string                 | `yFmt`                           | A format code for the labels                                              |
| `color`        | string                 | the theme's palette              | One CSS colour for every point                                            |
| `seriesColors` | `{ [series]: colour }` | the theme's palette              | A CSS colour per series name                                              |
| `xFmt`         | string                 | the axis's own labels            | A format code for the `x` axis and tooltip row                            |
| `yFmt`         | string                 | auto-scaled number               | A format code for the `y` axis and tooltip row                            |
| `title`        | string                 | none                             | The chart's heading                                                       |
| `subtitle`     | string                 | none                             | A line under the title                                                    |
| `xTitle`       | string                 | none                             | The `x` axis name                                                         |
| `yTitle`       | string                 | none                             | The `y` axis name                                                         |
| `legend`       | boolean                | `true` with more than one series | Show the legend                                                           |
| `height`       | number                 | `300`                            | The chart's height in pixels                                              |
| `renderer`     | `"canvas"` or `"svg"`  | `"canvas"`                       | How the chart is drawn                                                    |
| `filters`      | string or string\[\]   | none                             | Page filter ids whose selections narrow the query                         |
| `select`       | `"crossfilter"`        | none                             | Let a reader's selection on the chart narrow the page's other widgets     |

## Errors

A mistake in a scatter chart's markup shows as a message where the chart would be, and the rest of the page still renders. The message names the query and what is wrong: a `data` that names no fence on the page, an `x`, `y`, `series` or `size` the query does not return (with the columns it does return), or a format code the column cannot take. A query that returns no rows, such as one a filter narrows to nothing, shows "0 rows" in the chart's place, at the chart's height. A row whose `y` is empty draws no point.
