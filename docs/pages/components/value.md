---
title: Value, Delta and Sparkline
icon: trending-up
sidebar_position: 303
keywords: [inline, number, kpi, change, trend, format, fmt]
---

# Value, Delta and Sparkline

Three widgets put a query's result inside a sentence:

- `<Value>` shows one cell, formatted.
- `<Delta>` shows one signed change, coloured by whether it is good news, with an arrow.
- `<Sparkline>` draws a whole result as a small line, area or bar chart.

Each one reads a ` ```sql ` fence named by `data`. The query does the arithmetic: a widget only picks a cell, formats it and draws it. For a headline number with its change and trend in one block, use [Big value](/components/big-value).

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`weather_extremes`:

```sql weather_extremes echo
select max(temp_max) as hottest_c, min(temp_min) as coldest_c, sum(precipitation) as precipitation_mm, count(*) as days
from weather
```

`yearly_weather`:

```sql yearly_weather echo
with yearly as (
  select year(date) as year, avg(temp_max) as avg_high_c, sum(precipitation) as precipitation_mm
  from weather
  group by year(date)
)
select
  year,
  avg_high_c,
  precipitation_mm,
  precipitation_mm / lag(precipitation_mm) over (order by year) - 1 as precipitation_change,
  avg_high_c - lag(avg_high_c) over (order by year) as high_change_c
from yearly
order by year desc
```

`monthly_weather`:

```sql monthly_weather echo
select date_trunc('month', date) as month, sum(precipitation) as precipitation_mm, avg(temp_max) as avg_high_c, year(date) as year
from weather
group by all
order by month
```

`weather_kinds`:

```sql weather_kinds echo
select weather, count(*) as days, avg(temp_max) as avg_high_c
from weather
group by weather
order by days desc
```

## Value

### A cell in a sentence

With only `data`, a value shows the first column of the first row.

```mdx echo
The hottest day in Seattle from 2012 to 2015 reached <Value data="weather_extremes" /> °C.
```

### Pick the column

`column` names the result column to read.

```mdx echo
The record covers <Value data="weather_extremes" column="days" /> days.
```

### Pick the row

`row` is the row's position in the result, counting from 0. `yearly_weather` lists the newest year first, so row 0 is 2015 and row 1 is 2014.

```mdx echo
Seattle had <Value data="yearly_weather" column="precipitation_mm" row={1} fmt="num0" /> mm of rain and snow in 2014.
```

### Format

`fmt` formats the cell with one of the [format codes](#format-codes).

```mdx echo
Across the four years, <Value data="weather_extremes" column="precipitation_mm" fmt="num1k" /> mm fell in total.
```

### Colour

`color` takes any CSS colour, including the theme's chart colours such as `var(--chart-1)`.

```mdx echo
The coldest night fell to <Value data="weather_extremes" column="coldest_c" color="var(--chart-1)" /> °C.
```

### Negative numbers in red

`redNegatives` shows a negative number in the theme's negative colour, and takes precedence over `color`.

```mdx echo
The coldest night fell to <Value data="weather_extremes" column="coldest_c" redNegatives /> °C.
```

### Narrow with a filter

`filters` names the page filters whose selections narrow the query. A filter narrows on its `valueColumn`, so the query must return a column of that name. With nothing picked, the value reads row 0 of the whole result: the most common kind of weather.

```mdx echo
<Dropdown
  id="weather"
  data="weather_kinds"
  valueColumn="weather"
  title="Weather"
/>

Seattle recorded <Value data="weather_kinds" column="days" filters="weather" /> days of <Value data="weather_kinds" column="weather" filters="weather" />.
```

## Delta

### A change in a sentence

A delta shows a signed number: an explicit `+` on a positive one, an arrow, and the good or bad colour. Like `<Value>`, it reads `column` from `row` and formats it with `fmt`.

```mdx echo
Rain and snow changed by <Delta data="yearly_weather" column="precipitation_change" fmt="pct1" /> in 2015.
```

### Caption

`text` adds a caption after the number.

```mdx echo
<Delta
  data="yearly_weather"
  column="precipitation_change"
  row={1}
  fmt="pct1"
  text="vs. 2013"
/>
```

### Chip

`chip` draws the delta on a tinted chip.

```mdx echo
<Delta
  data="yearly_weather"
  column="precipitation_change"
  row={1}
  fmt="pct1"
  chip
/>
```

### When down is good

`downIsGood` swaps the colours, so a fall reads as good news. Less rain is good news here.

```mdx echo
<Delta
  data="yearly_weather"
  column="precipitation_change"
  fmt="pct1"
  downIsGood
/>
```

### Only the arrow, or only the number

`showValue={false}` hides the number and keeps the arrow; `showSymbol={false}` hides the arrow and keeps the number.

```mdx echo
<Delta
  data="yearly_weather"
  column="precipitation_change"
  row={1}
  fmt="pct1"
  showValue={false}
/>
and
<Delta
  data="yearly_weather"
  column="precipitation_change"
  row={1}
  fmt="pct1"
  showSymbol={false}
/>
```

### Arrow position

`symbolPosition` puts the arrow on the `right` of the number (the default) or on its `left`.

```mdx echo
<Delta
  data="yearly_weather"
  column="precipitation_change"
  row={1}
  fmt="pct1"
  symbolPosition="left"
/>
```

### Neutral range

`neutralRange` is a `[min, max]` band around zero where a change reads as neutral: no good or bad colour and a flat arrow. The default `[0, 0]` makes only an exact zero neutral. Use `null` for an open end: `[null, 0]` makes every change at or below zero neutral. The 2015 average high rose by 0.43 °C, inside a ±0.5 °C band.

```mdx echo
<Delta
  data="yearly_weather"
  column="high_change_c"
  fmt="num2"
  neutralRange={[-0.5, 0.5]}
  text="°C"
/>
```

### Narrow with a filter

`filters` narrows the delta's query, as it does for `<Value>`. With nothing picked, it reads row 0, 2015.

```mdx echo
<Dropdown id="year" data="yearly_weather" valueColumn="year" title="Year" />

Rain and snow changed by <Delta data="yearly_weather" column="precipitation_change" fmt="pct1" filters="year" /> on the year before.
```

## Sparkline

### A trend in a sentence

With only `data`, a sparkline draws the result's second column against its first. Its accessible name is the query's name.

```mdx echo
Monthly rain and snow <Sparkline data="monthly_weather" /> peaks every winter.
```

### Pick the columns

`x` and `y` name the columns to draw. When both are set, the accessible name reads "`y` by `x`".

```mdx echo
The average high <Sparkline data="monthly_weather" x="month" y="avg_high_c" /> peaks every summer.
```

### Chart type

`type` is `line` (the default), `area` or `bar`.

```mdx echo
<Sparkline data="monthly_weather" y="avg_high_c" type="area" />
<Sparkline data="monthly_weather" type="bar" />
```

### Colour

`color` takes any CSS colour. The default is the theme's sparkline colour.

```mdx echo
<Sparkline data="monthly_weather" color="var(--chart-1)" />
```

### Accessible name

`label` replaces the accessible name a screen reader announces.

```mdx echo
<Sparkline data="monthly_weather" label="Monthly precipitation, 2012 to 2015" />
```

### Narrow with a filter

`filters` narrows the sparkline's query. Pick a year to draw only its twelve months.

```mdx echo
<Dropdown
  id="trend_year"
  data="yearly_weather"
  valueColumn="year"
  title="Year"
/>

Monthly rain and snow <Sparkline data="monthly_weather" filters="trend_year" /> in the picked year.
```

## Props

### Value

| Prop           | Type                 | Default            | What it does                                                |
| -------------- | -------------------- | ------------------ | ----------------------------------------------------------- |
| `data`         | string               | required           | The name of a ` ```sql ` fence on the page                  |
| `column`       | string               | the first column   | The result column to read                                   |
| `row`          | number               | `0`                | The row to read, counting from 0                            |
| `fmt`          | string               | auto-scaled number | A [format code](#format-codes)                              |
| `color`        | string               | the text colour    | Any CSS colour                                              |
| `redNegatives` | boolean              | `false`            | Show a negative number in the negative colour, over `color` |
| `filters`      | string or string\[\] | none               | Page filter ids whose selections narrow the query           |

### Delta

| Prop             | Type                  | Default            | What it does                                               |
| ---------------- | --------------------- | ------------------ | ---------------------------------------------------------- |
| `data`           | string                | required           | The name of a ` ```sql ` fence on the page                 |
| `column`         | string                | the first column   | The result column holding the signed change                |
| `row`            | number                | `0`                | The row to read, counting from 0                           |
| `fmt`            | string                | auto-scaled number | A [format code](#format-codes)                             |
| `text`           | string                | none               | A caption after the number                                 |
| `chip`           | boolean               | `false`            | Draw the delta on a tinted chip                            |
| `downIsGood`     | boolean               | `false`            | Colour a fall as good and a rise as bad                    |
| `showValue`      | boolean               | `true`             | Show the number                                            |
| `showSymbol`     | boolean               | `true`             | Show the arrow                                             |
| `symbolPosition` | `"left"` or `"right"` | `"right"`          | Which side of the number the arrow sits                    |
| `neutralRange`   | `[min, max]`          | `[0, 0]`           | The band around zero that reads as neutral; `null` is open |
| `filters`        | string or string\[\]  | none               | Page filter ids whose selections narrow the query          |

### Sparkline

| Prop      | Type                          | Default                                     | What it does                                      |
| --------- | ----------------------------- | ------------------------------------------- | ------------------------------------------------- |
| `data`    | string                        | required                                    | The name of a ` ```sql ` fence on the page        |
| `x`       | string                        | the first column that is not `y`            | The column along the line                         |
| `y`       | string                        | the second column, or the only one          | The numeric column drawn                          |
| `type`    | `"line"`, `"area"` or `"bar"` | `"line"`                                    | The mark                                          |
| `color`   | string                        | the theme's sparkline colour                | Any CSS colour                                    |
| `label`   | string                        | "`y` by `x`" when both are set, else `data` | The accessible name                               |
| `filters` | string or string\[\]          | none                                        | Page filter ids whose selections narrow the query |

## Format codes

Every `fmt` prop in biac takes one of these codes. Formats use US conventions (`$` prefix, `,` thousands, `.` decimals) for every reader. An empty cell shows `–`.

| Code                                                        | Example                                  | Notes                                                                    |
| ----------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `num`                                                       | `1234567.891` → `1.2M`                   | Picks decimals and unit from the value, or from the whole column or axis |
| `num0`, `num1`, `num2`                                      | `1234567.891` → `1,234,567.9` (`num1`)   | Fixed decimals, grouped                                                  |
| `num0k`, `num1k`, `num2k`                                   | `1234567.891` → `1,234.6k` (`num1k`)     | Thousands                                                                |
| `num0m`, `num1m`, `num2m`                                   | `1234567.891` → `1.2M` (`num1m`)         | Millions                                                                 |
| `num0b`, `num1b`, `num1t`                                   | `1234567.891` → `0.0B` (`num1b`)         | Billions and trillions                                                   |
| `usd`                                                       | `1234567.891` → `$1.2M`                  | Like `num`, in dollars                                                   |
| `usd0`, `usd1`, `usd2`                                      | `1234567.891` → `$1,234,567.89` (`usd2`) | Fixed decimals, in dollars                                               |
| `usd0k`–`usd2k`, `usd0m`–`usd2m`, `usd0b`, `usd1b`, `usd1t` | `1234567.891` → `$1,235k` (`usd0k`)      | Dollars in thousands, millions, billions and trillions                   |
| `pct`                                                       | `0.056` → `5.60%`                        | Like `num`, as a percentage of 1                                         |
| `pct0`, `pct1`, `pct2`, `pct3`                              | `0.056` → `5.6%` (`pct1`)                | Fixed decimals, as a percentage of 1                                     |
| `id`                                                        | `1234567.891` → `1234568`                | No thousands separator, for identifiers                                  |
| `mult0`, `mult1`, `mult2`                                   | `1234567.891` → `1,234,567.9x` (`mult1`) | A multiple                                                               |
| `sci`                                                       | `1234567.891` → `1.23E6`                 | Scientific notation                                                      |
| `bytes`                                                     | `1234567.891` → `1.2 MB`                 | A byte count in its unit                                                 |

A code that does not exist, or a value the code cannot take, shows as a message naming the code and the value instead of the widget.

## Errors

A mistake in a widget's markup shows as a message where the widget would be, and the sentence around it still renders. The message names the query and what is wrong: a `data` that names no fence on the page, a `column` the query does not return (with the columns it does return), or a `fmt` the cell cannot take.
