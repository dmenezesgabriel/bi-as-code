-- Revenue and order count per region, largest revenue first. Pages read
-- it as data="/queries/region_orders"; it reads the page's `orders` table.
select region, count(*) as orders, sum(amount) as revenue
from orders
group by region
order by revenue desc
