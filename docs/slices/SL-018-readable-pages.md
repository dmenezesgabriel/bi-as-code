# SL-018 — Pages read like documents: real headings, spaced paragraphs, visible links, ruled tables, code that scrolls in place

Milestone: Phase 1 · State: in-progress · Depends on: SL-001, SL-002 · Closes: GAP-001, GAP-002, GAP-003, GAP-004, GAP-005, GAP-014

## Outcome

A reader of any page sees heading hierarchy, paragraph breaks, links distinguishable from text, ruled GFM tables, and SQL fences that scroll inside themselves on a phone with readable comments in dark mode.

## Demo

1. Cold start: `bin/biac dev`, open `http://localhost:<port>/weekly-review`.
2. The `h1`/`h2`/`h3` are visibly larger and bolder than body text; consecutive paragraphs have a gap between them.
3. A link in the page text is underlined and colored apart from the paragraph; toggle dark — still distinguishable.
4. Open `/nested/allocation`: the markdown table has padded header cells (`Share` and `Orders` no longer touch) and a rule between rows.
5. Resize to 375 px wide on `/weekly-review` and `/`: the page does not scroll sideways; the ` ```sql ` fence scrolls horizontally on its own, and `Tab` reaches it so the keyboard can scroll it.
6. Dark theme: the SQL `-- comment` text in a fence is readable (≥ 4.5:1).
7. `bin/biac build` + `bin/biac preview`: steps 2–6 hold on the static build.

## Who else implements this

| Repo      | Has it | Entry points                                                                                                                                                                                         | Approach in one line                                                                                                                                                                          |
| --------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | FULL   | `research_repos/evidence/cli/src/routes/[...path]/+page.svelte`, `research_repos/evidence/cli/tailwind.config.ts`                                                                                    | Wraps the rendered page in `prose dark:prose-invert prose-code:before:content-none prose-code:after:content-none` from `@tailwindcss/typography`, customized in `typography.DEFAULT.css`      |
| framework | FULL   | `research_repos/framework/src/style/global.css`, `research_repos/framework/src/style/syntax-dark.css`                                                                                                | Global element selectors (`h1`–`h6`, `a[href]`, `pre`, `table`, `th, td`) driven by `--theme-*` custom properties; syntax colors are its own CSS variables                                    |
| mosaic    | ABSENT | `research_repos/mosaic/packages/mosaic`, `research_repos/mosaic/packages/vgplot`                                                                                                                     | A visualization library with no page/markdown rendering; its prose styles belong to its VitePress docs site (`research_repos/mosaic/docs/.vitepress/theme/custom.css`), not the product       |
| streamlit | FULL   | `research_repos/streamlit/frontend/lib/src/components/shared/StreamlitMarkdown/styled-components.ts`, `research_repos/streamlit/frontend/lib/src/components/elements/CodeBlock/styled-components.ts` | Emotion styles scoped to the markdown container (`StyledStreamlitMarkdown`): heading scale from the theme, link color + focus ring, bordered `th, td`; code blocks in a separate styled `pre` |

**Count:** 3 of 4 implement this. Every product that renders markdown pages styles them; the one absence is a library without pages. Build it.

## Implementation inventory

### evidence

| Concern                  | Files                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope (where it applies) | `research_repos/evidence/cli/src/routes/[...path]/+page.svelte` — the `prose` wrapper `div` around `<Renderer>`, twice (with and without a connection)                                      |
| Typography values        | `research_repos/evidence/cli/tailwind.config.ts` — `typography.DEFAULT.css`: `max-width: none`, `p, ul, ol` `margin-block-end: 1.2em`, `a` underline + 2px thickness on hover, list markers |
| Dependency               | `research_repos/evidence/cli/package.json` — `@tailwindcss/typography`                                                                                                                      |
| Dark mode                | `dark:prose-invert` on the same wrapper                                                                                                                                                     |
| Inline code              | `prose-code:before:content-none prose-code:after:content-none` strips the plugin's backtick pseudo-elements                                                                                 |

### framework

| Concern               | Files                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headings              | `research_repos/framework/src/style/global.css` — `h1`–`h6` weight 700, line-height 1.15, `margin-bottom: 0.25rem`, `text-wrap: balance`; `h2 + p` margin-top 0                               |
| Links                 | `research_repos/framework/src/style/global.css` — `a[href]` color `--theme-foreground-focus`, `text-decoration: none`, underline only on `:hover`/`:focus`                                    |
| Code fences           | `research_repos/framework/src/style/global.css` — `pre` `overflow-x: auto`, `background-color: var(--theme-background-alt)`, `padding: 0.5rem 1rem`, `max-width: 960px`                       |
| Tables                | `research_repos/framework/src/style/global.css` — `table` 100% width, collapse, 13px sans; `th, td { padding: 3px 6.5px 3px 0 }`; `tr:not(:last-child)` bottom rule; `thead tr` stronger rule |
| Measure / line length | `research_repos/framework/src/style/global.css` — `p, table, h1…h6` `max-width: 640px`                                                                                                        |
| Syntax colors         | `research_repos/framework/src/style/syntax-dark.css` (`--syntax-comment: var(--theme-foreground-muted)`), `research_repos/framework/src/style/syntax-light.css`                               |
| Theme tokens          | `research_repos/framework/src/style/default.css`                                                                                                                                              |

### streamlit

| Concern         | Files                                                                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Links + focus   | `research_repos/streamlit/frontend/lib/src/components/shared/StreamlitMarkdown/styled-components.ts` — `sharedMarkdownStyle`: `a` color `theme.colors.link`, underline per `theme.linkUnderline`, `:focus-visible` ring |
| Headings        | same file — `h1, h2, …` heading font + line-height, per-level `fontSize`/`fontWeight`, `h1 strong` keeps the heading weight                                                                                             |
| Tables          | same file — `table` collapse + `marginBottom: theme.spacing.lg`; `th, td` padding `xs md` + 1px border                                                                                                                  |
| Scope           | `research_repos/streamlit/frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx` — styles attach to the markdown container only, never to other elements                                           |
| Heading anchors | `research_repos/streamlit/frontend/lib/src/components/shared/StreamlitMarkdown/Heading.tsx`                                                                                                                             |
| Code fences     | `research_repos/streamlit/frontend/lib/src/components/elements/CodeBlock/styled-components.ts` — `StyledPre`/`StyledCode` `whiteSpace: pre` unless wrapping, horizontal overflow on the block; `.token.comment` color   |
| Highlighter     | `research_repos/streamlit/frontend/lib/src/components/elements/CodeBlock/StreamlitSyntaxHighlighter.tsx`                                                                                                                |

**Disagreements the slice must settle:** evidence and streamlit always underline links, framework underlines only on hover; evidence styles by a wrapper class from a plugin, framework by global element selectors, streamlit by a container-scoped stylesheet.

## Trade-offs and what we adopt

| Axis                      | Options seen (repo → approach)                                                                                                                                                                                                                                                         | Trade-off                                                                                                                                                                                                                                                                                                                                                                                                                                        | Our choice, and why                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where typography attaches | evidence → `prose` wrapper class (new dep `@tailwindcss/typography`); framework → global element selectors; streamlit → container-scoped stylesheet; ours already → the MDX `components` map (`a: MarkdownLink`, `pre: SqlBlockPre` in `src/web/src/features/pages/markdown-page.tsx`) | A wrapper or global selector also hits every widget's own `table`/`h*`/`p`/`a` inside `<main>` (`<Table>` `data-table.tsx`, `big-value.tsx`, `callout.tsx`, chart/table/value `states.tsx`) and needs `not-prose`-style escapes. The MDX map only replaces markdown-generated elements — literal JSX tags stay literal (https://mdxjs.com/docs/using-mdx/, "in JSX syntax `a` is a literal tag name") — so widgets are untouched by construction | Extend the MDX `components` map with `h1`–`h6`, `p`, `table`, `thead`, `th`, `td` (and the existing `a`) carrying Tailwind classes. No new dependency, no widget exclusions, same mechanism the page already uses. Values come from framework/evidence                                                                                                                                  |
| Link affordance           | evidence, streamlit → always underlined; framework → underline on hover/focus only                                                                                                                                                                                                     | Hover-only relies on color alone, which WCAG 1.4.1 rejects unless the link color is ≥ 3:1 against the text plus another cue                                                                                                                                                                                                                                                                                                                      | Always underline (evidence/streamlit) plus a distinct link color, light and dark                                                                                                                                                                                                                                                                                                        |
| Fence overflow            | framework → `pre { overflow-x: auto }`; streamlit → overflow on the styled `pre`                                                                                                                                                                                                       | A scrollable region needs keyboard focus (axe rule `scrollable-region-focusable`, https://dequeuniversity.com/rules/axe/4.10/scrollable-region-focusable)                                                                                                                                                                                                                                                                                        | `overflow-x: auto` on the fence. The shiki `<pre>` arrives as `dangerouslySetInnerHTML` inside a `div` (`src/web/src/features/pages/highlighted-pre.tsx`), so the scroll container plus `tabIndex={0}` goes on that wrapper (and on the unhighlighted fallback `pre`). The axe rule's passing example is a bare `tabindex="0"` with no role or label, so no `role="region"` is added    |
| Dark comment contrast     | framework → its own syntax variables (`--syntax-comment: var(--theme-foreground-muted)`); streamlit → its own `.token.comment` color; ours → shiki's bundled `github-dark`                                                                                                             | Overriding one token color fights shiki's inline styles with more `!important`; swapping the bundled theme is a one-line change                                                                                                                                                                                                                                                                                                                  | Swap the dark theme to `github-dark-default`. Measured (shiki `codeToTokens` over a SQL sample, WCAG ratio): `github-dark` comment `#6a737d` on `#24292e` = 3.05 (matches GAP-014); `github-dark-default` comment `#8b949e` on `#0d1117` = 6.15, lowest SQL token 6.15; `github-dark-dimmed` 3.88; `vitesse-dark` 4.79; `one-dark-pro` 2.32. Light `github-light` comment stays at 4.82 |

## Gap analysis — what we already have vs the references

| Concern          | Ours today (file)                                                                                                                                                          | Best reference (file)                                              | Gap                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Heading styles   | none — Tailwind preflight resets `h1`–`h6`; `src/web/src/styles.css` adds nothing; `markdown-page.tsx` `<main>` only sets `scroll-mt-20` on `h2`/`h3`                      | `framework/src/style/global.css` headings; streamlit heading scale | **absent** (GAP-001)                                       |
| Paragraph rhythm | none — `p` margin 0                                                                                                                                                        | evidence `p` `margin-block-end: 1.2em`                             | **absent** (GAP-002)                                       |
| Link affordance  | `MarkdownLink` in `src/web/src/features/pages/markdown-page.tsx` routes internal hrefs, no class                                                                           | evidence `a` underline; streamlit focus ring                       | **partial** — behavior present, no styling (GAP-003)       |
| GFM tables       | none — `th` padding 0, border 0                                                                                                                                            | framework `table`/`th, td`/row rules                               | **absent** (GAP-004)                                       |
| Fence overflow   | `src/web/src/features/pages/highlighted-pre.tsx` wraps shiki HTML in an unstyled `div`; no `overflow` anywhere                                                             | framework `pre { overflow-x: auto }`                               | **absent** (GAP-005)                                       |
| Dark code colors | `src/web/src/features/pages/shiki-highlighter.ts` `THEMES = { light: "github-light", dark: "github-dark" }`; `src/web/src/styles.css` applies `--shiki-dark` under `.dark` | bundled `github-dark-default`                                      | **partial** — dual theme works, wrong dark theme (GAP-014) |
| Widget isolation | widgets render their own `table`/`p`/`h*` inside `<main>`                                                                                                                  | streamlit container scope                                          | n/a today; the MDX-map choice keeps it true                |

No shipped ledger row claims page typography; SL-001's `shipped` stays true (it promised compile and render, not styling).

## Deviations

- We do not adopt framework's `max-width: 640px` on `p`/`table`: our `<main>` is already `max-w-4xl` and widgets share the column; a narrower text measure is a separate layout decision.
- We do not add `@tailwindcss/typography` (evidence); the MDX map needs no dependency.

## Open decisions

- Exact heading scale (sizes per level) — take framework/evidence values; record the chosen numbers in the task's commit body.

## Surface

| Layer  | Files                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | none                                                                                                                                                                                                                                                                                                                                                                          |
| client | `src/web/src/features/pages/shiki-highlighter.ts`                                                                                                                                                                                                                                                                                                                             |
| ui     | `src/web/src/features/pages/markdown-page.tsx` (MDX components map; split prose elements into a new `src/web/src/features/pages/prose-elements.tsx` if the map grows past the file's size budget), `src/web/src/features/pages/highlighted-pre.tsx`, `src/web/src/styles.css`                                                                                                 |
| tests  | `src/web/src/features/pages/markdown-page.unit.test.tsx`, `src/web/src/features/pages/highlighted-pre.unit.test.tsx`, `src/web/src/features/pages/markdown-page.stories.tsx`, `src/web/src/features/pages/highlighted-pre.stories.tsx`, `test/e2e-browser/page-chrome.spec.ts` (or a new `test/e2e-browser/page-typography.spec.ts`), `test/e2e-browser/static-build.spec.ts` |

## Tasks

- [ ] T1 — Headings and paragraphs (GAP-001, GAP-002): `h1`–`h6` and `p` in the MDX map. Measure `getComputedStyle` font-size/weight of `h1`/`h2`/`h3` and `main p` margin on `/`, `/weekly-review`, `/nested/allocation`, `/nested/page`; confirm a widget's own `p`/`h*` (e.g. `<BigValue>`, `<Callout>`) is unchanged.
- [ ] T2 — Links (GAP-003): classes on `MarkdownLink` for both branches. Measure link vs paragraph color contrast (≥ 3:1) and `text-decoration-line: underline`, light and dark; visible `:focus-visible` outline.
- [ ] T3 — GFM tables (GAP-004): `table`/`thead`/`th`/`td` in the MDX map. Measure on `/nested/allocation`: `th` padding > 0, row border width 1px, header widths no longer touching; `<Table>` widget on `/weekly-review` unchanged.
- [ ] T4 — Fences scroll in place (GAP-005): overflow + keyboard focus on the fence container in `highlighted-pre.tsx` (highlighted and fallback paths). Measure `document.documentElement.scrollWidth - innerWidth` → 0 at 375 px on `/weekly-review` and `/`; `Tab` focuses the fence.
- [ ] T5 — Dark comment contrast (GAP-014): `THEMES.dark = "github-dark-default"`. Measure computed comment color vs fence background in dark ≥ 4.5:1 on `/weekly-review`; light unchanged.
- [ ] T6 — Re-measure all six gaps on dev and on `bin/biac build` + `bin/biac preview`, mark them closed in `docs/research/usability-audit.md`, run the Demo.

## Out of scope

- Display control of a named ` ```sql ` block (code vs result) — SL-019.
- Number formats, table headers, chart label colors in widgets — SL-021.
- Touch-target sizes of `<Table>` pagination and `<Details>` — SL-022.
- Theming beyond light/dark and a configurable text measure — Platform phase.
