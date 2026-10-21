---
title: Weekly revenue (embed)
icon: chart-line
sidebar: false
header: false
table_of_contents: false
sql:
  weekly: data/weekly-orders.csv
---

```sql weekly_revenue
select week, revenue
from weekly
order by week
```

<LineChart data="weekly_revenue" x="week" y="revenue" title="Revenue by week" subtitle="Sum of order amounts, US dollars" />
