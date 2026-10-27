---
title: Line chart
icon: chart-line
sidebar_position: 305
keywords: [line, trend, time series, LineChart]
---

# Line chart

`<LineChart>` joins one point per row of a ` ```sql ` fence named by `data`: `x` names the column along the axis and `y` the column that sets each point's height. Lines show how a measure moves over time or along any ordered axis; to compare amounts across categories, use a [Bar chart](/components/bar-chart).

The chart issues no query of its own. The query groups, sorts and computes, so the points join in the fence's `order by` order. A `DATE` or `TIMESTAMP` `x` draws a time axis, a numeric `x` a number axis, and any other `x` one position per value.

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`monthly_temps`:

```sql monthly_temps echo
select date_trunc('month', date) as month, avg(temp_max) as avg_high_c, avg(temp_min) as avg_low_c
from weather
group by all
order by month
```

`monthly_weather_days`:

```sql monthly_weather_days echo
select months.month, types.weather, count(day.date) as days
from (select distinct date_trunc('month', date) as month from weather) as months
cross join (select distinct weather from weather) as types
left join weather as day
  on date_trunc('month', day.date) = months.month
  and day.weather = types.weather
group by all
order by months.month, types.weather
```

`temps_2015`:

```sql temps_2015 echo
select date_trunc('month', date) as month, avg(temp_max) as avg_high_c
from weather
where year(date) = 2015
group by all
order by month
```

`yearly_high`:

```sql yearly_high echo
select year(date) as year, avg(temp_max) as avg_high_c
from weather
group by all
order by year
```

`weather_types`:

```sql weather_types echo
select distinct weather
from weather
order by weather
```

## Examples

### A line from a query

`data`, `x` and `y` are all a line chart needs. Hover the line to read each point.

```mdx echo
<LineChart data="monthly_temps" x="month" y="avg_high_c" />
```

### Several measures

`y` takes a list of columns, and each column draws its own line. A legend names them.

```mdx echo
<LineChart data="monthly_temps" x="month" y={["avg_high_c", "avg_low_c"]} />
```

### Split by a column

`series` names a column whose values split the points into one line each. With `series`, the query returns one row per `x` and series value.

```mdx echo
<LineChart data="monthly_weather_days" x="month" y="days" series="weather" />
```

### Stacked

`stacked` piles each line on the ones below it, so the top line reads the total. Every month here stacks up to its number of days. A stack needs a row for every `x` and series, so `monthly_weather_days` pairs every month with every weather type and counts 0 days where none fell; a missing row leaves a hole through the layers above it.

```mdx echo
<LineChart
  data="monthly_weather_days"
  x="month"
  y="days"
  series="weather"
  stacked
/>
```

### Stacked to 100%

`stacked="100%"` draws each series as its share of the total at every `x`, and the value axis reads in percent.

```mdx echo
<LineChart
  data="monthly_weather_days"
  x="month"
  y="days"
  series="weather"
  stacked="100%"
/>
```

### Value labels

`labels` prints each point's value above it. Labels that would overlap are left out.

```mdx echo
<LineChart data="temps_2015" x="month" y="avg_high_c" labels />
```

### Label format

`labelsFmt` formats the labels with a [format code](/components/value#format-codes). Without it, labels follow `yFmt`, or show percent on a 100% stack.

```mdx echo
<LineChart data="temps_2015" x="month" y="avg_high_c" labels labelsFmt="num1" />
```

### Colour

`color` draws every line in one CSS colour.

```mdx echo
<LineChart data="monthly_temps" x="month" y="avg_high_c" color="#dc2626" />
```

### Series colours

`seriesColors` maps a series name to a CSS colour. Series it does not name keep the theme's colours.

```mdx echo
<LineChart
  data="monthly_temps"
  x="month"
  y={["avg_high_c", "avg_low_c"]}
  seriesColors={{ avg_high_c: "#dc2626", avg_low_c: "#2563eb" }}
/>
```

### X format

`xFmt` formats the `x` labels and the tooltip's heading. A numeric `x` draws a number axis whose ticks are grouped like any number; `id` prints the years whole.

```mdx echo
<LineChart data="yearly_high" x="year" y="avg_high_c" xFmt="id" />
```

### Y format

`yFmt` formats the value axis and the tooltip. With no `yFmt`, the axis picks its decimals from its range.

```mdx echo
<LineChart data="monthly_temps" x="month" y="avg_high_c" yFmt="num1" />
```

### Title and subtitle

`title` heads the chart and `subtitle` sits under it, both above the plot.

```mdx echo
<LineChart
  data="monthly_temps"
  x="month"
  y="avg_high_c"
  title="Seattle's average high"
  subtitle="Monthly mean of daily highs, °C"
/>
```

### Axis titles

`xTitle` and `yTitle` name the axes.

```mdx echo
<LineChart
  data="monthly_temps"
  x="month"
  y="avg_high_c"
  xTitle="Month"
  yTitle="Average high (°C)"
/>
```

### Without the legend

A chart with more than one series shows a legend. `legend={false}` hides it; the tooltip still names each series.

```mdx echo
<LineChart
  data="monthly_weather_days"
  x="month"
  y="days"
  series="weather"
  legend={false}
/>
```

### Height

`height` sets the chart's height in pixels. The width always fills the column.

```mdx echo
<LineChart data="monthly_temps" x="month" y="avg_high_c" height={180} />
```

### SVG renderer

`renderer="svg"` draws the chart as SVG instead of on a canvas, which keeps it sharp when zoomed or printed.

```mdx echo
<LineChart data="monthly_temps" x="month" y="avg_high_c" renderer="svg" />
```

### Narrow with a filter

`filters` names the page filters whose selections narrow the chart's query. A filter narrows on its `valueColumn`, so the query must return a column of that name. Pick a weather type below and the chart re-queries; clear it and every type returns.

```mdx echo
<Dropdown
  id="weather"
  data="weather_types"
  valueColumn="weather"
  title="Weather"
/>

<LineChart
  data="monthly_weather_days"
  x="month"
  y="days"
  series="weather"
  filters="weather"
/>
```

`filters` also takes a list, `filters={["weather", "month"]}`, and every listed filter narrows the query.

### Select to cross-filter

`select="crossfilter"` lets a reader select on the chart: click a point, shift-click to add more, drag across the chart to select a stretch of `x`, or click a legend entry to select a series. The selection is a filter named after the selected column, so it narrows every widget whose `filters` name that column. Drag across a few months of the first chart and the second shows only those months; click the plot to clear it.

```mdx echo
<LineChart data="monthly_temps" x="month" y="avg_high_c" select="crossfilter" />

<LineChart
  data="monthly_weather_days"
  x="month"
  y="days"
  series="weather"
  filters="month"
/>
```

Give each chart both `select` and `filters` and the selections run both ways; a chart is never narrowed by its own selection.

## Props

| Prop           | Type                   | Default                           | What it does                                                          |
| -------------- | ---------------------- | --------------------------------- | --------------------------------------------------------------------- |
| `data`         | string                 | required                          | The name of a ` ```sql ` fence on the page                            |
| `x`            | string                 | required                          | The column along the axis                                             |
| `y`            | string or string\[\]   | required                          | The numeric column, or columns, that set the points' heights          |
| `series`       | string                 | none                              | A column whose values split the points into one line each             |
| `stacked`      | boolean or `"100%"`    | `false`                           | Pile each line on the ones below; `"100%"` draws shares               |
| `labels`       | boolean                | `false`                           | Print each point's value above it                                     |
| `labelsFmt`    | string                 | `yFmt`, or `pct0` on a 100% stack | A [format code](/components/value#format-codes) for the labels        |
| `color`        | string                 | the theme's palette               | One CSS colour for every line                                         |
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

A mistake in a line chart's markup shows as a message where the chart would be, and the rest of the page still renders. The message names the query and what is wrong: a `data` that names no fence on the page, an `x`, `y` or `series` the query does not return (with the columns it does return), or a format code the column cannot take. A query that returns no rows, such as one a filter narrows to nothing, shows "0 rows" in the chart's place, at the chart's height.
