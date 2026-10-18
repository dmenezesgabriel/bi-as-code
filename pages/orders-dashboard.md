---
title: Orders dashboard
page_width: full
cards: true
sql:
  orders: data/orders.parquet
---

# Orders dashboard

The quarter's orders at a glance. This page sets `page_width: full` and
`cards: true` in its front-matter, so it spans the space beside the sidebar
and each big value, chart and table sits on its own card; every other page
keeps the article column. Pick a region to narrow every figure.

<FilterBar>
  <Dropdown id="region" data="regions" valueColumn="region" title="Region" />
</FilterBar>

```sql regions
select distinct region from orders order by region
```

```sql totals
select sum(amount) as revenue, count(*) as orders, avg(amount) as avg_order
from orders
where {{params.region}} is null or region = {{params.region}}
```

<Row>
  <BigValue data="totals" column="revenue" title="Quarter revenue" fmt="usd" />
  <BigValue data="totals" column="orders" title="Quarter orders" />
  <BigValue data="totals" column="avg_order" title="Average order" fmt="usd" />
</Row>

```sql region_revenue
select region, sum(amount) as revenue
from orders
where {{params.region}} is null or region = {{params.region}}
group by region
order by region
```

<BarChart data="region_revenue" x="region" y="revenue" title="Revenue by region" subtitle="Sum of order amounts, US dollars" />

```sql weekly_orders
select week, region, count(*) as orders
from orders
where {{params.region}} is null or region = {{params.region}}
group by week, region
order by week, region
```

<LineChart data="weekly_orders" x="week" y="orders" series="region" title="Orders by week" subtitle="Count of orders placed each week, per region" />

```sql recent_orders
select order_id, order_date::varchar as order_date, region, amount
from orders
where {{params.region}} is null or region = {{params.region}}
order by order_date desc, order_id desc
```

<Table data="recent_orders" />
