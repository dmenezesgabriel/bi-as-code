---
title: Big value
icon: gauge
sidebar_position: 302
keywords: [kpi, headline, metric, scorecard, BigValue]
---

# Big value

`<BigValue>` shows a headline number: a small title, the value, its change on a prior period and a sparkline of its trend. It reads one row of a ` ```sql ` fence named by `data`; the change is another column of the same row, and the sparkline is a second fence.

The query does the arithmetic, so a year-on-year or week-on-week change is a column you compute in SQL. For a number inside a sentence, use [Value](/components/value).

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`penguin_count`:

```sql penguin_count echo
select count(*) as penguins, count(distinct species) as species, count(distinct island) as islands
from penguins
```

`species_mass`:

```sql species_mass echo
select species, count(*) as penguins, avg(body_mass_g) as body_mass_g
from penguins
group by species
order by penguins desc
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
select date_trunc('month', date) as month, sum(precipitation) as precipitation_mm, avg(temp_max) as avg_high_c
from weather
group by all
order by month
```

`emperor_mass`:

```sql emperor_mass echo
select max(body_mass_g) as body_mass_g
from penguins
where species = 'Emperor'
```

## Examples

### A headline number

With only `data`, a big value shows the first column of the first row, titled by the column's name.

```mdx echo
<BigValue data="penguin_count" />
```

### Pick the column

`column` names the result column to show. The title follows it.

```mdx echo
<BigValue data="penguin_count" column="islands" />
```

### Pick the row

`row` is the row's position in the result, counting from 0. `species_mass` lists the most counted species first, so row 1 is the second.

```mdx echo
<BigValue data="species_mass" column="penguins" row={1} />
```

### Title

`title` replaces the title line.

```mdx echo
<BigValue data="penguin_count" title="Penguins measured" />
```

### Format

`fmt` formats the value with a [format code](/components/value#format-codes).

```mdx echo
<BigValue
  data="species_mass"
  column="body_mass_g"
  fmt="num1k"
  title="Adelie average body mass (g)"
/>
```

### Change on a prior period

`delta` names a column of the same row that holds the signed change. It shows under the value with an arrow and the good or bad colour. `deltaFmt` formats it; without one it takes `fmt`. `yearly_weather` lists the newest year first, so row 0 is 2015 against 2014.

```mdx echo
<BigValue
  data="yearly_weather"
  column="precipitation_mm"
  fmt="num0"
  delta="precipitation_change"
  deltaFmt="pct1"
  title="Rain and snow in 2015 (mm)"
/>
```

### Caption

`text` adds a caption after the change.

```mdx echo
<BigValue
  data="yearly_weather"
  column="precipitation_mm"
  fmt="num0"
  delta="precipitation_change"
  deltaFmt="pct1"
  text="vs. 2014"
  title="Rain and snow in 2015 (mm)"
/>
```

### Chip

`chip` draws the change on a tinted chip.

```mdx echo
<BigValue
  data="yearly_weather"
  column="precipitation_mm"
  fmt="num0"
  delta="precipitation_change"
  deltaFmt="pct1"
  chip
  title="Rain and snow in 2015 (mm)"
/>
```

### When down is good

`downIsGood` swaps the colours, so a fall reads as good news.

```mdx echo
<BigValue
  data="yearly_weather"
  column="precipitation_mm"
  fmt="num0"
  delta="precipitation_change"
  deltaFmt="pct1"
  downIsGood
  title="Rain and snow in 2015 (mm)"
/>
```

### Without the arrow

`showSymbol={false}` hides the arrow and keeps the signed number.

```mdx echo
<BigValue
  data="yearly_weather"
  column="precipitation_mm"
  fmt="num0"
  delta="precipitation_change"
  deltaFmt="pct1"
  showSymbol={false}
  title="Rain and snow in 2015 (mm)"
/>
```

### Arrow position

`symbolPosition` puts the arrow on the `left` of the change (the default for a big value) or on its `right`.

```mdx echo
<BigValue
  data="yearly_weather"
  column="precipitation_mm"
  fmt="num0"
  delta="precipitation_change"
  deltaFmt="pct1"
  symbolPosition="right"
  title="Rain and snow in 2015 (mm)"
/>
```

### Neutral range

`neutralRange` is a `[min, max]` band around zero where a change reads as neutral: no good or bad colour and a flat arrow. The default `[0, 0]` makes only an exact zero neutral, and `null` leaves an end open. The 2015 average high rose by 0.43 °C, inside a ±0.5 °C band.

```mdx echo
<BigValue
  data="yearly_weather"
  column="avg_high_c"
  fmt="num1"
  delta="high_change_c"
  deltaFmt="num2"
  neutralRange={[-0.5, 0.5]}
  text="°C"
  title="Average high in 2015 (°C)"
/>
```

### Sparkline

`sparkline` names a second fence whose rows draw a small trend to the right of the value. By default it draws that result's second column against its first.

```mdx echo
<BigValue
  data="yearly_weather"
  column="precipitation_mm"
  fmt="num0"
  title="Rain and snow in 2015 (mm)"
  sparkline="monthly_weather"
/>
```

### Sparkline type

`sparklineType` is `line` (the default), `area` or `bar`.

```mdx echo
<BigValue
  data="yearly_weather"
  column="precipitation_mm"
  fmt="num0"
  title="Rain and snow in 2015 (mm)"
  sparkline="monthly_weather"
  sparklineType="bar"
/>
```

### Sparkline columns

`sparklineX` and `sparklineY` name the columns the sparkline draws.

```mdx echo
<BigValue
  data="yearly_weather"
  column="avg_high_c"
  fmt="num1"
  title="Average high in 2015 (°C)"
  sparkline="monthly_weather"
  sparklineX="month"
  sparklineY="avg_high_c"
  sparklineType="area"
/>
```

### Sparkline colour

`sparklineColor` takes any CSS colour, including the theme's chart colours such as `var(--chart-1)`. The default is the theme's sparkline colour.

```mdx echo
<BigValue
  data="yearly_weather"
  column="precipitation_mm"
  fmt="num0"
  title="Rain and snow in 2015 (mm)"
  sparkline="monthly_weather"
  sparklineColor="var(--chart-1)"
/>
```

### Narrow with a filter

`filters` names the page filters whose selections narrow the query. A filter narrows on its `valueColumn`, so the query must return a column of that name. With nothing picked, the value reads row 0 of the whole result. When the big value has a sparkline, the same filters narrow the sparkline's query too, so its fence needs the same columns.

```mdx echo
<Dropdown
  id="species"
  data="species_mass"
  valueColumn="species"
  title="Species"
/>

<BigValue
  data="species_mass"
  column="body_mass_g"
  fmt="num0"
  filters="species"
  title="Average body mass (g)"
/>
```

### A missing value

A cell that is empty, or a query that returns no rows, shows `–` and hides the change and the sparkline. There are no Emperor penguins in the data, so this query returns an empty cell.

```mdx echo
<BigValue
  data="emperor_mass"
  title="Emperor body mass (g)"
  fmt="num0"
  sparkline="monthly_weather"
/>
```

## Props

| Prop             | Type                          | Default                                   | What it does                                                  |
| ---------------- | ----------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `data`           | string                        | required                                  | The name of a ` ```sql ` fence on the page                    |
| `column`         | string                        | the first column                          | The result column to show                                     |
| `row`            | number                        | `0`                                       | The row to read, counting from 0                              |
| `fmt`            | string                        | auto-scaled number                        | A [format code](/components/value#format-codes) for the value |
| `title`          | string                        | `column`, or the first column             | The title line                                                |
| `delta`          | string                        | none                                      | A column of the same row holding the signed change            |
| `deltaFmt`       | string                        | `fmt`                                     | A format code for the change                                  |
| `text`           | string                        | none                                      | A caption after the change                                    |
| `chip`           | boolean                       | `false`                                   | Draw the change on a tinted chip                              |
| `downIsGood`     | boolean                       | `false`                                   | Colour a fall as good and a rise as bad                       |
| `showSymbol`     | boolean                       | `true`                                    | Show the arrow                                                |
| `symbolPosition` | `"left"` or `"right"`         | `"left"`                                  | Which side of the change the arrow sits                       |
| `neutralRange`   | `[min, max]`                  | `[0, 0]`                                  | The band around zero that reads as neutral; `null` is open    |
| `sparkline`      | string                        | none                                      | The name of a second fence whose rows draw the trend          |
| `sparklineType`  | `"line"`, `"area"` or `"bar"` | `"line"`                                  | The sparkline's mark                                          |
| `sparklineX`     | string                        | the first column that is not `sparklineY` | The sparkline's x column                                      |
| `sparklineY`     | string                        | the second column                         | The sparkline's numeric column                                |
| `sparklineColor` | string                        | the theme's sparkline colour              | Any CSS colour                                                |
| `filters`        | string or string\[\]          | none                                      | Page filter ids whose selections narrow both queries          |

## Errors

A mistake in a big value's markup shows as a message where it would be, and the rest of the page still renders. The message names the query and what is wrong: a `data` or `sparkline` that names no fence on the page, a `column` or `delta` the query does not return (with the columns it does return), or a `fmt` the cell cannot take.
