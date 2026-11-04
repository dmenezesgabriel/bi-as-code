-- Penguins per island, the largest colony first.
select island, count(*) as penguins
from penguins
group by island
order by penguins desc
