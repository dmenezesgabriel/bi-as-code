---
title: Weekly orders
sql:
  weekly: data/weekly-orders.csv
---

# Weekly orders

Order count and revenue per trading week. No file named
`data/weekly-orders.csv` is checked in: the `weekly` table is the output of
the data loader `data/weekly-orders.csv.js`, a program that reads the raw
orders and prints one row per week. `biac dev` runs it on the first request
and caches the result; `biac build` runs it and ships only the output.

```sql weekly_totals
select week, orders, revenue
from weekly
order by week
```

<LineChart data="weekly_totals" x="week" y="revenue" title="Revenue by week" subtitle="Sum of order amounts, US dollars" />

<Table data="weekly_totals" />
