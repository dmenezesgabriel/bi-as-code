# ADR-0011 — A named SQL block renders nothing unless its fence opts in with `echo` or `display`

Status: accepted
Date: 2026-10-11

## Context

A page declares its queries as named fences — ` ```sql orders ` — and widgets read them by name (`data="orders"`). Many of those queries exist only to feed a widget: a min/max for a slider's range, a pre-aggregation for a chart, a column extract for a histogram. When every named fence rendered its SQL and its full result table, those helpers dominated the page: `pages/crossfilter-scale.md` showed four SQL listings, a 2,901-row bounds table and three 200,000-row tables above the charts they serve. A page is a report, not a notebook.

The fence's info string is the only place a block can say how it renders. CommonMark gives it no structure: the first word is conventionally the language and the rest is free text ([CommonMark 0.31.2, info string](https://spec.commonmark.org/0.31.2/#info-string)). biac already used the first word after `sql` as the block's name, and every shipped page depends on that.

## Decision drivers

- A page shows only what its author asked for.
- A typo in a fence never silently hides output.
- A failed query is never swallowed, shown or hidden.
- Every existing page keeps its positional block names.

## Options considered

| Concern                   | Option                                                  | Pro                                                                      | Con                                                           |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Default for a named fence | Show code and result table                              | No page changes                                                          | Every helper query floods the page until annotated            |
| Default for a named fence | **Show nothing**                                        | A report reads as a report; helpers need no annotation                   | Every existing fence that should stay visible needs an opt-in |
| How a fence is named      | An `id=name` attribute                                  | Uniform `key=value` grammar                                              | Breaks every shipped page                                     |
| How a fence is named      | **Positional first token after `sql`**                  | Already shipped; shortest to write                                       | The name position cannot hold a flag                          |
| Opt-in vocabulary         | **`echo` (code) and `display` (result table)**          | Two independent switches; the names other markdown-SQL tools already use | Two words to learn                                            |
| Opt-in vocabulary         | One `show=code\|table\|both` attribute                  | One word                                                                 | A value grammar for a two-bit choice                          |
| Unknown token             | Ignore or keep it                                       | Lenient                                                                  | `shwo` turns into a silently hidden block                     |
| Unknown token             | **Compile error naming the token and the accepted set** | A typo is caught where it is written                                     | Every new flag must be added to the parser                    |
| Error of a hidden block   | Surface only where a widget consumes it                 | Nothing hidden ever appears                                              | A hidden block no widget reads fails with no trace            |
| Error of a hidden block   | **Render the inline error in place**                    | No failure is invisible                                                  | A hidden block can appear on the page — only when broken      |
| Loading of a hidden block | Skeleton                                                | Shows work in progress                                                   | A layout jump for a table that will never show                |
| Loading of a hidden block | **Nothing**                                             | No layout shift                                                          | —                                                             |

## Decision

A named ` ```sql ` fence renders nothing unless its info string opts in: `echo` shows its SQL, `display` shows its result table, and a failed query shows its inline error regardless.

The grammar is `sql <name> [echo[=true|false]] [display[=true|false]]`, whitespace-separated: a bare flag or `=true` turns it on, `=false` or no mention leaves it off. Any other token is a compile error that names the token and the accepted `echo`, `display`; a flag or a `key=` token in the name position is a compile error too, so ` ```sql echo ` never becomes a hidden block named `echo`. The page-compile-error page shows both.

- **Parse** — `parseSqlFenceMeta` in `src/engine/sql-fence-meta.ts`, called by `registerSqlBlock` in `src/engine/compile-page.ts`. The registered `SqlBlock` stays `{name, sql}`: the query runs whether shown or not, so widgets reading a hidden block are unaffected.
- **Carry** — `registerSqlBlock` puts the name (`meta`) and the flags on the `<code>` element through hast `hProperties`, because MDX drops mdast `meta`. A flag is an HTML boolean attribute — `""` when on, absent when off — because the `<code>` element reaches the DOM before highlighting and React does not render `true` on a non-boolean attribute.
- **Render** — `SqlBlockPre` in `src/web/src/features/pages/sql-block.tsx` renders the highlighted code only with `echo`; `SqlResult` renders `TableError` on failure before it checks `display`, and nothing while a hidden block loads.

Unnamed ` ```sql ` fences are unchanged: code only, never executed.

## Consequences

- Helper queries cost no page space; a page that should teach the syntax (`pages/index.md`) opts in with `echo`.
- A block name can never be `echo`, `display` or contain `=`.
- The parser is strict on purpose. Adding a fence attribute (a `run=false`, a `connection=`) means adding it to `parseSqlFenceMeta` and amending this ADR; making unknown tokens pass through "for forward compatibility" would bring back the silent-typo failure this rule exists to prevent.
- A hidden block's error shows in place on purpose. Moving it to the consuming widget only would leave a broken block that no widget reads failing invisibly.
