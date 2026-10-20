-- Revenue and order count per region, largest revenue first. Pages read
-- it as data="/queries/region_orders" or name the same path inside a
-- fence's braces; it reads the page's `orders` table. A brace token in
-- this comment would expand too, so none is written here.
select region, count(*) as orders, sum(amount) as revenue
from orders
group by region
order by revenue desc
