---
title: DateRange
icon: filter
sidebar_position: 505
keywords: [date range, date, calendar, period, last 30 days, filter, DateRange]
---

# DateRange

`<DateRange>` lets a reader pick a span of days, from a preset such as Last 30 Days or from a start and an end date, and narrows every widget that names it in `filters` to the rows whose date falls in it. The pick is written to the page URL as the words that describe it, such as `?id=last 30 days`, so a reload a week later still shows the last 30 days, not the 30 days that were last when the link was made.

The examples on this page read this query. A widget names a query by the name after ` ```sql `, so `data="…"` below is always this name.

`daily_weather`:

```sql daily_weather echo
select date, weather, precipitation, temp_max
from weather
order by date
```

The weather data runs from 2012-01-01 to 2015-12-31, so the presets that count back from today select no rows here; the examples start on fixed dates.

Every filter on a page shares its URL, so each example below gives its date range its own `id`.

## Examples

### Narrow a widget

`id` names the filter, and `valueColumn` the date column the widgets are narrowed on. A widget lists the `id` in `filters` to be narrowed by the pick: the table below keeps only the days in June 2015. Open the field to pick a preset, or to type a start and an end date.

```mdx echo
<DateRange
  id="june"
  valueColumn="date"
  initialValue="2015-06-01 to 2015-06-30"
  title="Days"
/>

<Table data="daily_weather" filters="june" pageSize={5} />
```

### Start on a span

`initialValue` is the span the page opens with when the URL holds none. It takes the same words the URL holds:

| Words                      | Days it selects                                  |
| -------------------------- | ------------------------------------------------ |
| `2015-06-01 to 2015-06-30` | From the first date to the second, both included |
| `from 2015-06-01`          | That date and every day after it                 |
| `until 2012-01-31`         | That date and every day before it                |
| `last 30 days`             | Today and the 29 days before it                  |
| `last day`                 | Today                                            |
| `month to date`            | The first of this month to today                 |
| `all time`                 | Every day — the widget is not narrowed           |

`today` and `yesterday` stand in for a date in the first three, as in `2015-06-01 to today`.

```mdx echo
<DateRange
  id="from_december"
  valueColumn="date"
  initialValue="from 2015-12-25"
  title="From Christmas 2015"
/>

<Table data="daily_weather" filters="from_december" pageSize={5} />
```

### Presets

The open field lists four presets: Last 7 Days, Last 30 Days, Month to Date and All Time. A pick of All Time narrows nothing. Picking a start or an end date writes a span such as `2015-06-01 to 2015-06-30`; picking only one writes `from` or `until` that date.

### Title

`title` is the label above the field. Without it, the label is the `id` in title case.

```mdx echo
<DateRange id="reporting_period" />
```

### Use the pick in a query

A query can read the pick itself as `{{params.id}}`: the words, or `null` before a pick. A date range without `valueColumn` narrows no widget, and is read only this way.

```mdx echo
<DateRange id="chosen_span" initialValue="last 7 days" title="Span" />
```

`chosen_span_words`:

```sql chosen_span_words echo
select coalesce({{params.chosen_span}}, 'no span picked') as span
```

```mdx echo
<Table data="chosen_span_words" />
```

## Props

| Prop           | Type   | Default  | What it does                                                          |
| -------------- | ------ | -------- | --------------------------------------------------------------------- |
| `id`           | string | required | The filter's name: in widgets' `filters`, the URL and `{{params.id}}` |
| `valueColumn`  | string | —        | The date column widgets are narrowed on                               |
| `title`        | string | `id`     | The label above the field                                             |
| `initialValue` | string | —        | The span the page opens with when the URL holds none                  |

## Errors

A `<DateRange>` whose `initialValue` is not one of the spans above shows a message in place of the field; the rest of the page still renders. Words in the URL that are not a span narrow nothing.
