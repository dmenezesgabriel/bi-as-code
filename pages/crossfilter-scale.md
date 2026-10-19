---
title: Cross-filter at scale
table_of_contents: true
table_of_contents_label: Measures
sql:
  flights: data/flights.parquet
brand:
  colors:
    primary: { light: "#7c3aed", dark: "#c4b5fd" }
  palette: { light: ["#7c3aed"], dark: ["#c4b5fd"] }
---

# Cross-filter at scale

200,000 synthetic flights — departure `time` (hour of day), `distance`
(miles) and arrival `delay` (minutes). Every histogram re-queries the full
table on each change: drag the Distance slider, or drag across any
histogram, and the other histograms follow. Later departures run later, so
brushing the evening hours shifts the delay distribution right.
This page's front-matter `brand:` gives it its own violet primary and first
series colour; every other page keeps the project's.

<FilterBar>
  <Slider id="distance" data="distance_bounds" valueColumn="distance" range title="Distance" />
</FilterBar>

```sql distance_bounds
-- the slider only needs the extent: distinct values, not 200k rows
select distinct distance
from flights
```

## Delay

```sql delays
-- delay histogram
select delay, distance, time
from flights
```

<Histogram data="delays" value="delay" title="Arrival delay" subtitle="Flights per bin, minutes" filters={["delay", "distance", "time"]} select="crossfilter" />

## Distance

```sql distances
-- distance histogram
select delay, distance, time
from flights
```

<Histogram data="distances" value="distance" title="Flight distance" subtitle="Flights per bin, miles" filters={["delay", "distance", "time"]} select="crossfilter" />

## Time

```sql times
-- time histogram
select delay, distance, time
from flights
```

<Histogram data="times" value="time" title="Departure time" subtitle="Flights per bin, hour of day" filters={["delay", "distance", "time"]} select="crossfilter" />
