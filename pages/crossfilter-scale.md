---
title: Cross-filter at scale
sql:
  flights: data/flights.parquet
---

# Cross-filter at scale

200,000 synthetic flights — departure `time` (hour of day), `distance`
(miles) and arrival `delay` (minutes). Every histogram re-queries the full
table on each change: drag the Distance slider, or drag across any
histogram, and the other histograms follow. Later departures run later, so
brushing the evening hours shifts the delay distribution right.

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

<Histogram data="delays" value="delay" filters={["delay", "distance", "time"]} select="crossfilter" />

## Distance

```sql distances
-- distance histogram
select delay, distance, time
from flights
```

<Histogram data="distances" value="distance" filters={["delay", "distance", "time"]} select="crossfilter" />

## Time

```sql times
-- time histogram
select delay, distance, time
from flights
```

<Histogram data="times" value="time" filters={["delay", "distance", "time"]} select="crossfilter" />
