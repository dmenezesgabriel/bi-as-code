---
title: Orders overview
sql:
  orders: data/orders.parquet
---

# Orders overview

Weekly order volume across regions. The `orders` query below feeds this
page's widgets; for a per-region breakdown see the
[region detail page](/nested/page).

| Region | Orders | Revenue |
| ------ | -----: | ------: |
| North  |    120 |  $4,800 |
| South  |     95 |  $3,700 |
| West   |    140 |  $6,100 |

The West leads on revenue at <Value data="orders" column="revenue" fmt="usd0" />
this quarter.

```sql orders echo display
select region, count(*) as orders, sum(amount) as revenue
from orders
where {{params.region}} is null or region = {{params.region}}
group by region
order by revenue desc
```

<Table data="orders" />

<BarChart data="orders" x="region" y="revenue" />
