---
title: Histogram
icon: chart-bar
sidebar_position: 308
keywords: [histogram, distribution, bins, frequency, Histogram]
---

# Histogram

`<Histogram>` shows how the values of one numeric column spread out: it cuts the range of the `value` column into bins of equal width and draws one bar per bin, as tall as the number of rows that fall in it. To compare amounts across categories, use a [Bar chart](/components/bar-chart).

The query returns the rows themselves, one per observation, and the histogram counts them. Unlike the other charts, the query does not group: a `group by` would leave one row per group to count.

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`penguin_measures`:

```sql penguin_measures echo
select species, island, sex, body_mass_g, flipper_length_mm
from penguins
where body_mass_g is not null
order by species
```

`daily_highs`:

```sql daily_highs echo
select date, temp_max, precipitation
from weather
```

`species_count`:

```sql species_count echo
select species, count(*) as penguins
from penguins
group by species
order by penguins desc
```

`islands`:

```sql islands echo
select distinct island
from penguins
order by island
```

## Examples

### Bins from a query

`data` and `value` are all a histogram needs. With no bin props, the number of bins follows the number of rows: twice the cube root of the row count, rounded up. Hover a bar to read its bin's range and count.

```mdx echo
<Histogram data="penguin_measures" value="body_mass_g" />
```

### Split by a column

`series` names a column whose values split each bar, one colour per value. The series always stack, so the bar's height is still the bin's total.

```mdx echo
<Histogram data="penguin_measures" value="body_mass_g" series="species" />
```

### Bin count

`binCount` sets how many bins the range is cut into.

```mdx echo
<Histogram data="daily_highs" value="temp_max" binCount={10} />
```

### Bin width

`binWidth` sets each bin's width in the column's units, and the number of bins follows from it. It wins when both `binWidth` and `binCount` are set.

```mdx echo
<Histogram data="daily_highs" value="temp_max" binWidth={2} />
```

### Value labels

`labels` prints each bar's count on it.

```mdx echo
<Histogram
  data="penguin_measures"
  value="flipper_length_mm"
  binCount={8}
  labels
/>
```

### Label format

`labelsFmt` formats the labels with a [format code](/components/value#format-codes). Without it, labels follow `yFmt`, which defaults to whole numbers.

```mdx echo
<Histogram
  data="daily_highs"
  value="temp_max"
  binCount={4}
  labels
  labelsFmt="num1k"
/>
```

### Colour

`color` paints every bar one CSS colour.

```mdx echo
<Histogram data="daily_highs" value="temp_max" color="#0f766e" />
```

### Series colours

`seriesColors` maps a series name to a CSS colour. Series it does not name keep the theme's colours.

```mdx echo
<Histogram
  data="penguin_measures"
  value="body_mass_g"
  series="species"
  seriesColors={{ Adelie: "#f97316", Chinstrap: "#a855f7", Gentoo: "#0d9488" }}
/>
```

### Value format

`valueFmt` formats the values on the axis and the bin range in the tooltip. The axis marks round values, not the bin edges, so its labels stay apart whatever the bin width.

```mdx echo
<Histogram data="penguin_measures" value="body_mass_g" valueFmt="num1k" />
```

### Y format

`yFmt` formats the count axis and the counts in the tooltip. Counts are whole, so with no `yFmt` they show as whole numbers.

```mdx echo
<Histogram data="daily_highs" value="temp_max" binCount={4} yFmt="num1k" />
```

### Title and subtitle

`title` heads the chart and `subtitle` sits under it, both above the plot.

```mdx echo
<Histogram
  data="daily_highs"
  value="temp_max"
  title="Daily high temperature"
  subtitle="Seattle, 2012–2015, °C"
/>
```

### Axis titles

`xTitle` names the bin axis and `yTitle` the count axis, which is titled Frequency until you name it.

```mdx echo
<Histogram
  data="daily_highs"
  value="temp_max"
  xTitle="High (°C)"
  yTitle="Days"
/>
```

### Without the legend

A histogram with more than one series shows a legend. `legend={false}` hides it; the tooltip still names each series.

```mdx echo
<Histogram
  data="penguin_measures"
  value="body_mass_g"
  series="species"
  legend={false}
/>
```

### Height

`height` sets the chart's height in pixels. The width always fills the column.

```mdx echo
<Histogram data="daily_highs" value="temp_max" height={180} />
```

### SVG renderer

`renderer="svg"` draws the chart as SVG instead of on a canvas, which keeps it sharp when zoomed or printed.

```mdx echo
<Histogram data="daily_highs" value="temp_max" renderer="svg" />
```

### Narrow with a filter

`filters` names the page filters whose selections narrow the chart's query. A filter narrows on its `valueColumn`, so the query must return a column of that name. Pick an island below and the bars shrink to that island's penguins; the bins stay where they were, so the narrowed shape compares with the whole.

```mdx echo
<Dropdown id="island" data="islands" valueColumn="island" title="Island" />

<Histogram
  data="penguin_measures"
  value="body_mass_g"
  series="species"
  filters="island"
/>
```

`filters` also takes a list, `filters={["island", "species"]}`, and every listed filter narrows the query.

### Select to cross-filter

`select="crossfilter"` lets a reader select on the histogram: drag across bars to select a range of the `value` column, or click a legend entry to select a series. The selection is a filter named after the selected column, so it narrows every widget whose `filters` name that column. Drag across the heaviest penguins in the first chart and the second shows only their flipper lengths; click the plot to clear it. The second chart also narrows when you click a species in the bar chart.

```mdx echo
<Histogram
  data="penguin_measures"
  value="body_mass_g"
  series="species"
  select="crossfilter"
/>

<BarChart data="species_count" x="species" y="penguins" select="crossfilter" />

<Histogram
  data="penguin_measures"
  value="flipper_length_mm"
  filters={["body_mass_g", "species"]}
/>
```

Give each chart both `select` and `filters` and the selections run both ways; a chart is never narrowed by its own selection.

## Props

| Prop           | Type                   | Default                                          | What it does                                                          |
| -------------- | ---------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `data`         | string                 | required                                         | The name of a ` ```sql ` fence on the page                            |
| `value`        | string                 | required                                         | The numeric column whose values are binned                            |
| `series`       | string                 | none                                             | A column whose values split each bar, one colour each                 |
| `binCount`     | number                 | twice the cube root of the row count, rounded up | How many bins the range is cut into                                   |
| `binWidth`     | number                 | none                                             | Each bin's width; wins over `binCount`                                |
| `valueFmt`     | string                 | auto-scaled number                               | A [format code](/components/value#format-codes) for the value axis    |
| `labels`       | boolean                | `false`                                          | Print each bar's count on it                                          |
| `labelsFmt`    | string                 | `yFmt`                                           | A format code for the labels                                          |
| `color`        | string                 | the theme's palette                              | One CSS colour for every bar                                          |
| `seriesColors` | `{ [series]: colour }` | the theme's palette                              | A CSS colour per series name                                          |
| `yFmt`         | string                 | `num0`                                           | A format code for the count axis and the tooltip                      |
| `title`        | string                 | none                                             | The chart's heading                                                   |
| `subtitle`     | string                 | none                                             | A line under the title                                                |
| `xTitle`       | string                 | none                                             | The bin axis name                                                     |
| `yTitle`       | string                 | `"Frequency"`                                    | The count axis name                                                   |
| `legend`       | boolean                | `true` with more than one series                 | Show the legend                                                       |
| `height`       | number                 | `300`                                            | The chart's height in pixels                                          |
| `renderer`     | `"canvas"` or `"svg"`  | `"canvas"`                                       | How the chart is drawn                                                |
| `filters`      | string or string\[\]   | none                                             | Page filter ids whose selections narrow the query                     |
| `select`       | `"crossfilter"`        | none                                             | Let a reader's selection on the chart narrow the page's other widgets |

## Errors

A mistake in a histogram's markup shows as a message where the chart would be, and the rest of the page still renders. The message names the query and what is wrong: a `data` that names no fence on the page, a `value` or `series` the query does not return (with the columns it does return), or a format code the column cannot take. A query that returns no rows, or none with a number in `value`, shows "0 rows" in the chart's place, at the chart's height. Rows whose `value` is empty are not counted.
