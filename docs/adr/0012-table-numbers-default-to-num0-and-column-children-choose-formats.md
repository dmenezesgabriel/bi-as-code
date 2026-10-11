# ADR-0012 — Table numbers default to `num0`; `<Column>` children choose, order and format columns

Status: accepted
Date: 2026-10-11

## Context

A `<Table>` and a named fence's `display` result render the same `DataTable`. It printed every cell as `String(value)`: `6100` beside a chart reading `6k`, and a ratio as `0.09915449654112218`. Charts and value widgets already format through `formatValue` in `src/web/src/features/widgets/value/format.ts`; tables did not, and an author had no way to say which columns a table shows, in what order, or how.

## Decision drivers

- A table cell reads like the number it is, without the author doing anything.
- A column reads in one unit, whatever the sort or page.
- An author can pick, order, title and format columns in the page, in the same `fmt` codes the other widgets take.
- A bad column reference or format is one inline alert, never a broken page.

## Options considered

| Concern              | Option                                                        | Pro                                                     | Con                                                         |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unformatted number   | `toLocaleString` per value                                    | Keeps every decimal                                     | Decimals vary row to row; `0.3333333333333333` stays long   |
| Unformatted number   | Auto-scale like an unset `fmt` (`6100` → `6k`)                | Matches the charts                                      | A table is for exact reading; `6k` hides `6,100`            |
| Unformatted number   | **`num0` — grouped, no decimals**                             | Exact for counts and money; one look down a column      | A fraction renders `0` until the author sets a `fmt`        |
| Author override      | A `formats` map prop                                          | One prop                                                | Cannot order or select columns; JSX object syntax in a page |
| Author override      | **`<Column id fmt title />` children**                        | Selects, orders, titles and formats in one readable tag | A carrier tag and child inspection                          |
| Range of a base code | Each value on its own                                         | No precomputation                                       | `$6.1k` beside `$950` in one column                         |
| Range of a base code | **The column's range over every row**                         | One unit per column, stable across sort and page        | One pass over the column per render                         |
| Bad `id` / `fmt`     | Throw during render                                           | —                                                       | One typo takes down the page                                |
| Bad `id` / `fmt`     | **Inline alert naming the cause, checked once before render** | Author sees the available columns or the expected codes | `fmt` is probed on the first non-null cell only             |

## Decision

With no `<Column>` children a table shows every column in query order; numbers and bigints render `num0`, null renders empty and anything else renders its string. With `<Column>` children only the listed columns render, in listed order: `title` is the header (else the column name), and `fmt` is any `formatValue` code — the bare bases `num`/`usd`/`pct` scale against that column's range over every row, so the whole column reads in one unit. Sorting compares raw values, never formatted text.

- **Columns** — `defaultTableColumns` and `resolveTableColumns` in `src/web/src/features/widgets/table/table-columns.ts` turn rows (and specs) into `TableColumn`s; the range is `numericRange` from `src/web/src/features/widgets/value/numeric-range.ts`, the same span the charts' axes use.
- **Children** — `<Table>` in `src/web/src/features/widgets/table/table.tsx` reads `<Column>` (`src/web/src/features/widgets/table/column.tsx`) through `collectItemChildren` in `src/web/src/features/widgets/markdown/collect-children.ts`, the contract `<Tabs>` and `<Accordion>` use.
- **Errors** — an `id` the result lacks throws `ColumnError` (it lists the available columns), a `fmt` the values cannot take throws `FormatError`; `<Table>` renders either as its inline `TableError`.

## Consequences

- Every echo/`display` result changes too: `pct_of_total` `39.4` now reads `39`. Authors who need decimals put that query in a `<Table>` with a `<Column fmt>`.
- A fractional column with no `fmt` reads `0` — the price of the exact default; the alternative would make every count read differently from the same number in prose.
- An all-null column with an unknown `fmt` code passes the render check, since no cell exercises the code.
- New column options (alignment, links, conditional colors) extend `ColumnProps` and `TableColumn`; this ADR is amended when they change the defaults above.
