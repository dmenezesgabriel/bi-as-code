# 8. Cross-cutting concepts · 12. Glossary

Grows as slices land.

## Concepts

| Concept             | Where decided / enforced                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Library wrapping    | `.dependency-cruiser.cjs` — every third-party UI/engine import sits behind a project-owned module                       |
| Typed errors        | Expected errors are zod-typed/tagged values surfaced at the widget and CLI boundaries; unexpected errors propagate once |
| URL as filter state | Filter values serialize to search params; `history.replaceState`, never `pushState`, for filter writes                  |
| Accessibility       | Widgets ship `aria-*` state, keyboard-complete interactions, and measured target sizes; checked in each slice's demo    |

## Glossary

| Term         | Meaning                                                                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| page         | One `.md`/`.mdx` file under `pages/`; compiles to a route + a React component + a query manifest                                                                                                                                 |
| named query  | A ` ```sql name ` fenced block; its result is addressable as `data="name"`; it renders nothing unless the fence says `echo`/`display` ([ADR-0011](../adr/0011-a-named-sql-block-renders-nothing-unless-it-opts-in.md))           |
| widget       | A JSX component embedded in a page (`<Table/>`, `<BarChart/>`, `<Dropdown/>`)                                                                                                                                                    |
| selection    | A named, resolved set of filter predicates owned by inputs or chart interactions                                                                                                                                                 |
| clause       | One typed predicate contribution (`point`, `interval`, `list`, `match`) inside a selection                                                                                                                                       |
| cross-filter | Other-widgets-update, publisher-excluded filtering ([ADR-0004](../adr/0004-cross-filter-is-ported-from-the-mosaic-architecture.md)); latest-wins re-query throttling ([ADR-0007](../adr/0007-cross-filter-throttling-policy.md)) |
| filter       | A named input's URL-persisted value and the selection it drives                                                                                                                                                                  |
