---
title: Weekly review
sql:
  orders: data/orders.parquet
---

# Weekly review

A standing read on the trading week: what moved, where it moved, and what
to watch next. Figures below come from the `orders` data set shared with
the [orders overview](/).

## Overview

Order volume closed the quarter at 355 orders, up 18% on the final week
against the trailing four-week average. Revenue followed the same shape — growth concentrated
in the West region, where a single wholesale account contributed nearly a
third of the lift. No channel or region contracted; the question is
whether the West lift repeats or mean-reverts.

Average order value held flat at roughly $42, so the week's gain is
volume-led rather than price-led. Volume-led growth is the healthier
kind, but it also means the trend is sensitive to churn in a small number
of active accounts — the regional split below shows how concentrated the
week was.

## Regional split

The West remains the largest region by revenue and was also the fastest
growing this week, widening its lead over the North. The South is flat
for a third consecutive week — not a decline, but no longer keeping pace
with the other two regions.

| Region | Orders | Revenue | WoW change |
| ------ | -----: | ------: | ---------: |
| West   |    140 |  $6,100 |       +16% |
| North  |    120 |  $4,800 |         0% |
| South  |     95 |  $3,700 |         0% |

```sql orders
select region, count(*) as orders, sum(amount) as revenue
from orders
where {{params.region}} is null or region = {{params.region}}
group by region
order by revenue desc
```

```sql region_share
select region, orders,
  round(orders * 100.0 / sum(orders) over (), 1) as pct_of_total
from {{orders}}
order by orders desc
```

The concentration risk is real: the top five accounts drove 38% of weekly
revenue, all of them in the West and North. A quiet week for even one of
them shows up directly in the trend lines below.

## Trend lines

Weekly volume has climbed in four of the last five weeks. The shape is a
steady grind upward rather than a step change, which is consistent with
gradual account expansion rather than a promotion or seasonality effect.

```sql weekly_trend
select week, region, count(*) as orders
from orders
group by week, region
order by week, region
```

Returns and cancellations stayed inside their normal band — nothing in
the trend suggests the growth is being bought at the cost of order
quality.

### Quarter detail

Zooming out to the quarter, the West's lead is recent: the North carried
the first six weeks before the West overtook it. The South has been
flat-to-slightly-down all quarter, which makes this week's zero-change
reading part of a pattern rather than noise.

<Table data="weekly_trend" />

## Takeaways

- West growth is volume-led and concentrated — watch the top five
  accounts before calling it a trend.
- The South needs attention: three flat weeks is the longest stall this
  quarter.
- Marketplace allocation holds at ~32%; no action needed this week.
- Returns stayed inside the normal band, so the lift is clean.

The watch list for next week's review is short and specific:

| Watch item             | Region | Trigger to act             |
| ---------------------- | ------ | -------------------------- |
| Top-five account churn | West   | Any quiet week ≥20% drop   |
| Flat-line streak       | South  | Fourth consecutive 0% week |
| Marketplace share      | All    | Sustained move above 35%   |

If none of these triggers fire, next week's review should read as a
continuation — same shape, updated numbers. If the South stalls again, it
graduates from watch item to its own section. Next week's review re-runs
the same sections against fresh data — the page edits itself once
`orders` updates.
