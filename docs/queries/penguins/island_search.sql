-- The islands of island_counts whose name holds the text of the island_text
-- parameter, or every island while that box is empty.
select island, penguins
from {{/queries/island_counts}}
where {{params.island_text}} is null
  or island ilike '%' || {{params.island_text}}::varchar || '%'
