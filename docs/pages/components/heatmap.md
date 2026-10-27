---
title: Heatmap
icon: sheet
sidebar_position: 309
keywords: [heatmap, grid, matrix, density, calendar, Heatmap]
---

# Heatmap

`<Heatmap>` draws a grid of cells from a ` ```sql ` fence named by `data`: `x` names the column whose values run along the top, `y` the column whose values run down the side, and `value` the numeric column that colours each cell. A heatmap shows where a measure runs high or low across two categories at once; for one category, use a [Bar chart](/components/bar-chart).

The chart issues no query of its own. The query returns one row per cell, so it groups by both `x` and `y`. The columns and rows appear in the order the query first returns their values, so the query's `order by` sets them, and a pair the query does not return leaves its cell blank.

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`monthly_highs`:

```sql monthly_highs echo
select strftime(date, '%b') as month, year(date) as year, avg(temp_max) as avg_high_c
from weather
group by month(date), strftime(date, '%b'), year(date)
order by month(date), year
```

`weather_days_2015`:

```sql weather_days_2015 echo
select date_trunc('month', date) as month, weather, count(*) as days
from weather
where year(date) = 2015
group by all
order by month, weather
```

`island_species`:

```sql island_species echo
select island, species, count(*) as penguins
from penguins
group by island, species
order by island, species
```

`islands`:

```sql islands echo
select distinct island
from penguins
order by island
```

## Examples

### Cells from a query

`data`, `x`, `y` and `value` are all a heatmap needs. The strip under the grid maps colour to value, from the lowest cell to the highest. Hover a cell to read its three columns.

```mdx echo
<Heatmap data="monthly_highs" x="month" y="year" value="avg_high_c" />
```

### Missing cells

A pair of `x` and `y` values the query does not return draws no cell. No penguins of two of the species live on Torgersen, so those cells stay empty; the labels below, which [Value labels](#value-labels) describes, tell an empty cell from a low one.

```mdx echo
<Heatmap data="island_species" x="island" y="species" value="penguins" labels />
```

### Value format

`valueFmt` formats the values in the tooltip and at the ends of the colour strip with a [format code](/components/value#format-codes).

```mdx echo
<Heatmap
  data="monthly_highs"
  x="month"
  y="year"
  value="avg_high_c"
  valueFmt="num1"
/>
```

### Value labels

`labels` prints each cell's value on it. Labels that would overlap are left out. Without `labelsFmt`, they follow `valueFmt`.

```mdx echo
<Heatmap
  data="monthly_highs"
  x="month"
  y="year"
  value="avg_high_c"
  valueFmt="num1"
  labels
/>
```

### Label format

`labelsFmt` formats the labels only, so the tooltip and the strip keep `valueFmt`.

```mdx echo
<Heatmap
  data="monthly_highs"
  x="month"
  y="year"
  value="avg_high_c"
  valueFmt="num1"
  labels
  labelsFmt="num0"
/>
```

### Colour scale

`colorScale` sets the colours the cells run through. One CSS colour runs from the page background to that colour, so it reads in light and dark mode alike.

```mdx echo
<Heatmap
  data="monthly_highs"
  x="month"
  y="year"
  value="avg_high_c"
  colorScale="#dc2626"
/>
```

A list of two or more colours runs from the first, at the lowest value, through the rest to the last, at the highest.

```mdx echo
<Heatmap
  data="monthly_highs"
  x="month"
  y="year"
  value="avg_high_c"
  colorScale={["#2563eb", "#facc15", "#dc2626"]}
/>
```

### X format

`xFmt` formats the column labels and the `x` row of the tooltip. A date column reads as `2015-01-01` until you format it.

```mdx echo
<Heatmap
  data="weather_days_2015"
  x="month"
  y="weather"
  value="days"
  xFmt="shortdate"
/>
```

### Y format

`yFmt` formats the row labels and the `y` row of the tooltip.

```mdx echo
<Heatmap
  data="weather_days_2015"
  x="weather"
  y="month"
  value="days"
  yFmt="longdate"
/>
```

### Title and subtitle

`title` heads the chart and `subtitle` sits under it, both above the grid.

```mdx echo
<Heatmap
  data="monthly_highs"
  x="month"
  y="year"
  value="avg_high_c"
  title="Average daily high"
  subtitle="Seattle, °C"
/>
```

### Axis titles

`xTitle` and `yTitle` name the axes.

```mdx echo
<Heatmap
  data="island_species"
  x="island"
  y="species"
  value="penguins"
  xTitle="Island"
  yTitle="Species"
/>
```

### Without the colour strip

`legend={false}` hides the colour strip under the grid; the tooltip still reads each cell's value.

```mdx echo
<Heatmap
  data="monthly_highs"
  x="month"
  y="year"
  value="avg_high_c"
  legend={false}
/>
```

### Height

`height` sets the chart's height in pixels. The width always fills the column.

```mdx echo
<Heatmap
  data="island_species"
  x="island"
  y="species"
  value="penguins"
  height={180}
/>
```

### SVG renderer

`renderer="svg"` draws the chart as SVG instead of on a canvas, which keeps it sharp when zoomed or printed.

```mdx echo
<Heatmap
  data="island_species"
  x="island"
  y="species"
  value="penguins"
  renderer="svg"
/>
```

### Narrow with a filter

`filters` names the page filters whose selections narrow the chart's query. A filter narrows on its `valueColumn`, so the query must return a column of that name. Pick an island below and the grid keeps only that island's column; clear it and every island returns.

```mdx echo
<Dropdown id="island" data="islands" valueColumn="island" title="Island" />

<Heatmap
  data="island_species"
  x="island"
  y="species"
  value="penguins"
  filters="island"
/>
```

`filters` also takes a list, `filters={["island", "species"]}`, and every listed filter narrows the query.

## Props

| Prop         | Type                  | Default                  | What it does                                                                 |
| ------------ | --------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `data`       | string                | required                 | The name of a ` ```sql ` fence on the page                                   |
| `x`          | string                | required                 | The column whose values run along the top                                    |
| `y`          | string                | required                 | The column whose values run down the side                                    |
| `value`      | string                | required                 | The numeric column that colours each cell                                    |
| `valueFmt`   | string                | auto-scaled number       | A [format code](/components/value#format-codes) for the values and the strip |
| `colorScale` | string or string\[\]  | the theme's scale colour | One colour to run to from the background, or the colours to run through      |
| `labels`     | boolean               | `false`                  | Print each cell's value on it                                                |
| `labelsFmt`  | string                | `valueFmt`               | A format code for the labels                                                 |
| `xFmt`       | string                | the value as returned    | A format code for the column labels and the tooltip                          |
| `yFmt`       | string                | the value as returned    | A format code for the row labels and the tooltip                             |
| `title`      | string                | none                     | The chart's heading                                                          |
| `subtitle`   | string                | none                     | A line under the title                                                       |
| `xTitle`     | string                | none                     | The `x` axis name                                                            |
| `yTitle`     | string                | none                     | The `y` axis name                                                            |
| `legend`     | boolean               | `true`                   | Show the colour strip                                                        |
| `height`     | number                | `300`                    | The chart's height in pixels                                                 |
| `renderer`   | `"canvas"` or `"svg"` | `"canvas"`               | How the chart is drawn                                                       |
| `filters`    | string or string\[\]  | none                     | Page filter ids whose selections narrow the query                            |

## Errors

A mistake in a heatmap's markup shows as a message where the chart would be, and the rest of the page still renders. The message names the query and what is wrong: a `data` that names no fence on the page, an `x`, `y` or `value` the query does not return (with the columns it does return), or a format code the column cannot take. A query that returns no rows, or none with a number in `value`, shows "0 rows" in the chart's place, at the chart's height. When the query returns the same `x` and `y` pair twice, the cell shows the last row, so group by both.
