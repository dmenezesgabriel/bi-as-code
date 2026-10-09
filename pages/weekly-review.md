---
title: Weekly review
sql:
  orders: data/orders.parquet
---

# Weekly review

A standing read on the trading week: what moved, where it moved, and what
to watch next. Figures below come from the `orders` data set shared with
the [orders overview](/).

<Callout type="info" title="Reading guide">
Every figure on this page re-runs live against the `orders` table — the
`?region=`, `?amount=`, `?ordered=`, `?q=` and `?large_orders=` URL
parameters scope the widgets that declare `filters` and the queries that
interpolate them. Charts cross-filter in session state, with no URL
parameter: a regional-split bar click or an order-mix legend toggle
narrows the `region`-filtered widgets, a drag across the order-size
histogram the `amount`-filtered ones; repeat the gesture (or click
the histogram once) to clear.
</Callout>

## Overview

<FilterBar>
  <Dropdown id="region" data="order_amounts" valueColumn="region" title="Region" filters={["region", "amount"]} />
  <Slider id="amount" data="order_amounts" valueColumn="amount" range title="Amount" filters={["region"]} />
  <DateRange id="ordered" valueColumn="order_date" title="Ordered" />
  <TextInput id="q" title="Search regions" placeholder="e.g. West" />
  <Toggle id="large_orders" label="Large orders only" />
</FilterBar>

<Row>
  <BigValue data="kpi" column="revenue" title="Quarter revenue" fmt="usd" delta="wow_pct" deltaFmt="pct1" text="last week vs. prior" sparkline="weekly_revenue" />
  <BigValue data="kpi" column="orders" title="Quarter orders" />
  <BigValue data="kpi" column="wow_pct" title="Revenue WoW" fmt="pct1" />
</Row>

<Note>Figures cover the 13-week trading quarter; the delta compares the
final week with the one before it.</Note>

<LineBreak lines={2} />

Quarter revenue closed at <Value data="kpi" column="revenue" fmt="usd" />,
up <Delta data="kpi" column="wow_pct" fmt="pct1" text="WoW" /> on the prior
week.

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

```sql kpi
select
  sum(amount) as revenue,
  count(*) as orders,
  sum(case when week = (select max(week) from orders) then amount end)
    / nullif(sum(case when week = (select max(week) from orders) - 1 then amount end), 0)
    - 1 as wow_pct
from orders
where {{params.region}} is null or region = {{params.region}}
```

<Details title="Metric definitions">
- **Revenue** — `sum(amount)` over the quarter.
- **Order volume** — count of booked orders.
- **Revenue WoW** — the final week against the one before it, signed.
</Details>

<Details title="How the region filter works" open>
The `?region=` URL parameter feeds the widgets that declare
`filters=["region"]` — each re-queries its fence's result scoped to the
region. The KPI and sparklines read the same parameter through
`{{params.region}}`; the trend charts keep their full-quarter read.
</Details>

<Details title="Mobile summary" openMobile>
Revenue is up roughly 10% week over week on volume, led by the West.
</Details>

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
group by region
order by revenue desc
```

<BarChart data="orders" x="region" y="revenue" labels filters={["region"]} select="crossfilter" />

```sql region_share
select region, orders,
  round(orders * 100.0 / sum(orders) over (), 1) as pct_of_total
from {{orders}}
order by orders desc
```

<Callout type="warning" title="Concentration risk">
The top five accounts drove 38% of weekly revenue, all of them in the
West and North. A quiet week for even one of them shows up directly in
the trend lines below.
</Callout>

## Order mix

Orders and revenue track together across the quarter — the weeks each
region booked more orders are the weeks it closed more revenue, and no
region's week reads as an outlier against that line. The mix is volume,
not a few oversized tickets carrying a region's number.

```sql region_week
select week, region, count(*) as orders, sum(amount) as revenue
from orders
group by week, region
order by week, region
```

<Tabs>
  <Tab title="Chart">
    <ScatterChart data="region_week" x="orders" y="revenue" series="region" filters={["region"]} select="crossfilter" />
  </Tab>
  <Tab title="Table">
    <Table data="region_week" filters={["region"]} />
  </Tab>
</Tabs>

## Order size

Order amounts sit in a narrow band — the whole quarter's distribution
fits inside a few dollars around $41, so the week's lift is a volume
story rather than a ticket-size story. A wider spread would put the
average-order-value read above in question; this shape doesn't.

```sql order_amounts
-- varchar: the result table would render the raw DATE as epoch ms
select order_date::varchar as order_date, amount, region
from orders
```

<Histogram data="order_amounts" value="amount" filters={["region", "amount", "ordered"]} select="crossfilter" />

The same distribution at order grain — the fence's own preview below
stays unfiltered; the `<Table>` narrows on every input above: the region
pick, the amount range and the ordered window through `filters`, a
drag across the histogram through the same `amount` clause, `q`
over the region name and the large-orders switch (`amount >= 44`)
through the fence's own `{{params.*}}` clauses.

```sql order_detail
select order_id, order_date::varchar as order_date, region, amount
from orders
where ({{params.q}} is null or region ilike '%' || {{params.q}} || '%')
  and ({{params.large_orders}} is distinct from 'true' or amount >= 44)
```

<Table data="order_detail" filters={["region", "amount", "ordered"]} />

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

<LineChart data="weekly_trend" x="week" y="orders" series="region" />

<AreaChart
  data="weekly_trend"
  x="week"
  y="orders"
  series="region"
  stacked="100%"
/>

<Heatmap data="weekly_trend" x="week" y="region" value="orders" />

```sql weekly_revenue
select week, sum(amount) as revenue
from orders
where {{params.region}} is null or region = {{params.region}}
group by week
order by week
```

Weekly revenue as a line <Sparkline data="weekly_revenue" /> and as
bars <Sparkline data="weekly_revenue" type="bar" />.

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

<Row>
  <Stack>
    <Value data="kpi" column="revenue" fmt="usd" />
    <Note>quarter revenue, all regions</Note>
  </Stack>
  <Callout type="success" title="Clean lift">
    Returns and cancellations stayed inside their normal band — the
    week's growth is not being bought at the cost of order quality.
  </Callout>
</Row>

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

<Accordion single>
  <AccordionItem title="Methodology">
    Figures aggregate the `orders` table over the 13-week quarter.
    Week over week compares the final week with the one before it; the
    regional split ranks regions by revenue.
  </AccordionItem>
  <AccordionItem title="Data quality">
    Returns and cancellations stayed inside their normal band, and the
    `orders` extract carries no late-arriving adjustments this week.
  </AccordionItem>
</Accordion>

<Accordion>
  <AccordionItem title="Change log">
    This week: markdown layout widgets across the page. Last week:
    scatter, histogram and heatmap views.
  </AccordionItem>
  <AccordionItem title="Sources">
    `data/orders.parquet` — the shared orders extract behind the
    [orders overview](/).
  </AccordionItem>
</Accordion>
