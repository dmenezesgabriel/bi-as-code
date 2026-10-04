---
title: Orders overview
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

```sql orders
select region, count(*) as orders, sum(amount) as revenue
from orders
group by region
order by revenue desc
```
