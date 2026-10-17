---
title: Regional orders
sql:
  regions: data/region-revenue.csv
  daily: data/daily-orders.csv
---

# Regional orders

Orders and revenue per region, and orders per day. Neither table is a
checked-in file: `regions` is the output of the Python data loader
`data/region-revenue.csv.py`, and `daily` the output of the shell data loader
`data/daily-orders.csv.sh`. A loader runs in whichever language its last
extension names; `biac dev` runs it on the first request and caches the
result, and `biac build` runs it and ships only the output.

## By region

```sql region_totals
select region, orders, revenue
from regions
order by region
```

<BarChart data="region_totals" x="region" y="revenue" title="Revenue by region" subtitle="Sum of order amounts, US dollars" />

<Table data="region_totals" />

## By day

```sql daily_totals
select order_date::varchar as order_date, orders
from daily
order by order_date
```

<LineChart data="daily_totals" x="order_date" y="orders" title="Orders by day" subtitle="Count of orders placed each day" />

<Table data="daily_totals" />
