---
title: Area chart
icon: chart-area
sidebar_position: 306
keywords: [area, stacked, share, time series, AreaChart]
---

# Area chart

`<AreaChart>` fills the space under a line through one point per row of a ` ```sql ` fence named by `data`: `x` names the column along the axis and `y` the column that sets each point's height. An area reads as a volume over time, and stacked areas show how a total splits into parts; for one measure's trend alone, a [Line chart](/components/line-chart) is lighter.

The chart issues no query of its own. The query groups, sorts and computes, so the points join in the fence's `order by` order. A `DATE` or `TIMESTAMP` `x` draws a time axis, a numeric `x` a number axis, and any other `x` one position per value.

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`monthly_rain`:

```sql monthly_rain echo
select date_trunc('month', date) as month, sum(precipitation) as precipitation_mm
from weather
group by all
order by month
```

`monthly_temps`:

```sql monthly_temps echo
select date_trunc('month', date) as month, avg(temp_max) as avg_high_c, avg(temp_min) as avg_low_c
from weather
group by all
order by month
```

`monthly_weather_days`:

```sql monthly_weather_days echo
select date_trunc('month', date) as month, weather, count(*) as days
from weather
group by all
order by month, weather
```

`rain_2015`:

```sql rain_2015 echo
select date_trunc('month', date) as month, sum(precipitation) as precipitation_mm
from weather
where year(date) = 2015
group by all
order by month
```

`yearly_rain`:

```sql yearly_rain echo
select year(date) as year, sum(precipitation) as precipitation_mm
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

### An area from a query

`data`, `x` and `y` are all an area chart needs. Hover the area to read each point.

```mdx echo
<AreaChart data="monthly_rain" x="month" y="precipitation_mm" />
```

### Several measures

`y` takes a list of columns, and each column draws its own area over the others. A legend names them.

```mdx echo
<AreaChart data="monthly_temps" x="month" y={["avg_high_c", "avg_low_c"]} />
```

### Split by a column

`series` names a column whose values split the points into one area each. With `series`, the query returns one row per `x` and series value.

```mdx echo
<AreaChart data="monthly_weather_days" x="month" y="days" series="weather" />
```

### Stacked

`stacked` piles each area on the ones below it, so the top edge reads the total. Every month here stacks up to its number of days. A weather type with no row in a month stacks as 0 there, so the layers above it keep their base.

```mdx echo
<AreaChart
  data="monthly_weather_days"
  x="month"
  y="days"
  series="weather"
  stacked
/>
```

### Stacked to 100%

`stacked="100%"` draws each series as its share of the total at every `x`, so the areas fill the plot and the value axis reads in percent.

```mdx echo
<AreaChart
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
<AreaChart data="rain_2015" x="month" y="precipitation_mm" labels />
```

### Label format

`labelsFmt` formats the labels with a [format code](/components/value#format-codes). Without it, labels follow `yFmt`, or show percent on a 100% stack.

```mdx echo
<AreaChart
  data="rain_2015"
  x="month"
  y="precipitation_mm"
  labels
  labelsFmt="num0"
/>
```

### Colour

`color` fills every area in one CSS colour.

```mdx echo
<AreaChart data="monthly_rain" x="month" y="precipitation_mm" color="#0284c7" />
```

### Series colours

`seriesColors` maps a series name to a CSS colour. Series it does not name keep the theme's colours.

```mdx echo
<AreaChart
  data="monthly_weather_days"
  x="month"
  y="days"
  series="weather"
  stacked
  seriesColors={{
    drizzle: "#7dd3fc",
    rain: "#2563eb",
    snow: "#a78bfa",
    sun: "#facc15",
    fog: "#94a3b8",
  }}
/>
```

### X format

`xFmt` formats the `x` labels and the tooltip's heading. A numeric `x` draws a number axis whose ticks are grouped like any number; `id` prints the years whole.

```mdx echo
<AreaChart data="yearly_rain" x="year" y="precipitation_mm" xFmt="id" />
```

### Y format

`yFmt` formats the value axis and the tooltip. With no `yFmt`, the axis picks its decimals from its range.

```mdx echo
<AreaChart data="monthly_rain" x="month" y="precipitation_mm" yFmt="num0" />
```

### Title and subtitle

`title` heads the chart and `subtitle` sits under it, both above the plot.

```mdx echo
<AreaChart
  data="monthly_rain"
  x="month"
  y="precipitation_mm"
  title="Seattle's monthly rain"
  subtitle="Total precipitation, mm"
/>
```

### Axis titles

`xTitle` and `yTitle` name the axes.

```mdx echo
<AreaChart
  data="monthly_rain"
  x="month"
  y="precipitation_mm"
  xTitle="Month"
  yTitle="Rain (mm)"
/>
```

### Without the legend

A chart with more than one series shows a legend. `legend={false}` hides it; the tooltip still names each series.

```mdx echo
<AreaChart
  data="monthly_weather_days"
  x="month"
  y="days"
  series="weather"
  stacked
  legend={false}
/>
```

### Height

`height` sets the chart's height in pixels. The width always fills the column.

```mdx echo
<AreaChart data="monthly_rain" x="month" y="precipitation_mm" height={180} />
```

### SVG renderer

`renderer="svg"` draws the chart as SVG instead of on a canvas, which keeps it sharp when zoomed or printed.

```mdx echo
<AreaChart data="monthly_rain" x="month" y="precipitation_mm" renderer="svg" />
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

<AreaChart
  data="monthly_weather_days"
  x="month"
  y="days"
  series="weather"
  stacked
  filters="weather"
/>
```

`filters` also takes a list, `filters={["weather", "month"]}`, and every listed filter narrows the query.

### Select to cross-filter

`select="crossfilter"` lets a reader select on the chart: click a point, shift-click to add more, drag across the chart to select a stretch of `x`, or click a legend entry to select a series. The selection is a filter named after the selected column, so it narrows every widget whose `filters` name that column. Drag across a few months of the first chart and the second shows only those months; click the plot to clear it.

```mdx echo
<AreaChart
  data="monthly_rain"
  x="month"
  y="precipitation_mm"
  select="crossfilter"
/>

<AreaChart
  data="monthly_weather_days"
  x="month"
  y="days"
  series="weather"
  stacked
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
| `series`       | string                 | none                              | A column whose values split the points into one area each             |
| `stacked`      | boolean or `"100%"`    | `false`                           | Pile each area on the ones below; `"100%"` draws shares               |
| `labels`       | boolean                | `false`                           | Print each point's value above it                                     |
| `labelsFmt`    | string                 | `yFmt`, or `pct0` on a 100% stack | A [format code](/components/value#format-codes) for the labels        |
| `color`        | string                 | the theme's palette               | One CSS colour for every area                                         |
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

A mistake in an area chart's markup shows as a message where the chart would be, and the rest of the page still renders. The message names the query and what is wrong: a `data` that names no fence on the page, an `x`, `y` or `series` the query does not return (with the columns it does return), or a format code the column cannot take. A query that returns no rows, such as one a filter narrows to nothing, shows "0 rows" in the chart's place, at the chart's height.
