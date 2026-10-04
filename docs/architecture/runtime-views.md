# 6. Runtime views

Grows as slices land.

## Page request → render (dev)

````
GET /orders
  → SPA route /orders → virtual page manifest → import compiled page module
    → page front-matter (title, sql: tables) applied
    → ```sql blocks registered in the page query registry
    → widgets mount: data="name" resolves → duckdb-wasm query → Arrow result → render
````

## Cross-filter propagation (target)

```
user gesture (brush/select/click)
  → widget publishes a SelectionClause to its Selection
    → Coordinator resolves each subscribed client's predicate
      (intersect/union/single; client-published clauses excluded when cross)
    → each client re-runs query(predicate) against duckdb-wasm
    → results push back into widgets; pending/error states render
```
