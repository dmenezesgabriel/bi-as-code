# SL-021 — Data that reads right

Milestone: Phase 1 — A usable BI-as-code product · State: open · Depends on: — · Closes: GAP-009, GAP-010, GAP-011, GAP-012, GAP-013

## Outcome

A reader sees table numbers with thousands separators and author-chosen formats under human column titles, chart axes and data labels in one unit per axis, bar labels that read on the dark canvas, and positive deltas that pass text contrast.

## Demo

1. Cold start: `pnpm build:cli && bin/biac dev`, open `http://localhost:5175/weekly-review`.
2. Regional split bar chart (light): the y axis reads one unit throughout (`0k 1k … 7k`, no `3,000` beside `6k`); bar labels read `6k`, `5k`, `4k` — one unit, never `6k` beside `3,700` (GAP-010).
3. Toggle dark: the bar labels are a light glyph on the dark canvas with no white halo (GAP-011).
4. Light again: the `+9.9%` in the Quarter revenue `<BigValue>` and the inline `<Delta>` measure ≥ 4.5:1 against white (GAP-013).
5. Order mix → `Table` tab and Order size `<Table>`: numeric cells render `num0` (grouping, 0 decimals), headers read `Week`, `Region`, `Orders`, `Revenue`, `Order ID`, `Order Date` (GAP-009, GAP-012).
6. Trend lines `<Table data="weekly_trend">` with `<Column>` children: only the listed columns show, in the listed order, each with its `fmt` and `title` (GAP-009).
7. `/nested/allocation`: the Channel table headers read `Channel`, `Share`, `Orders`.
8. `bin/biac build && bin/biac preview`: steps 2–6 hold on the static build.

Write this PRD to be grepped: do not hard-wrap paragraphs, keep one fact per table row, write file names in full, and tag every gap it closes with its `GAP-NNN`.

## Baseline measured 2026-10-11 (`bin/biac dev`, playwright-cli headless)

| Gap     | Where                                  | Measured today                                                                                                                                                                                                                                                                                                                                                                                  |
| ------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-009 | `/weekly-review` tables                | first rows: `region_week` → `1\|North\|14\|560`, `order_detail` → `1\|2026-07-06\|North\|40`, `pct_of_total` echo table → `39.4`; the audit's `wow_pct` `0.09915449654112218` cell is no longer on screen since the `kpi` fence is hidden ([ADR-0011](../adr/0011-a-named-sql-block-renders-nothing-unless-it-opts-in.md)) — the demo reintroduces a fractional column via `<Column>` in step 6 |
| GAP-010 | `/weekly-review` Regional split        | y ticks `6k 5k 4k 3,000 2,000 1,000 0` (top `7k` under the sticky filter bar); bar labels `6k`, `5k`, `3,700`                                                                                                                                                                                                                                                                                   |
| GAP-011 | `/weekly-review` Regional split, dark  | bar labels are dark glyphs with a white text border on `#0a0a0a`                                                                                                                                                                                                                                                                                                                                |
| GAP-012 | `/weekly-review`, `/nested/allocation` | headers `week\|region\|orders\|revenue`, `order_id\|order_date\|region\|amount`, `region\|orders\|pct_of_total`; allocation `Channel\|Share\|Orders` (aliased in SQL)                                                                                                                                                                                                                           |
| GAP-013 | `/weekly-review` light / dark          | `+9.9%` computed `oklch(0.596 0.145 163.225)` light (audit: 3.65:1 on white), `oklch(0.765 0.177 163.223)` dark                                                                                                                                                                                                                                                                                 |

Console during the pass: 0 errors, 0 warnings.

## Who else implements this

| Repo      | Has it  | Entry points                                                                                                                                                                                        | Approach in one line                                                                                                                                                                                              |
| --------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | FULL    | `core/src/user-components/formatValue.ts`, `core/src/user-components/formatTitle.ts`, `core/src/user-components/tags/table/Table.svelte`, `core/src/user-components/tags/echarts/echarts-themes.ts` | One `formatValue(value, fmt, fallback, {min,max})`; base codes (`num`/`usd`/`pct`) pick decimals + unit from the range max; tables, axes and labels pass their column/axis range; `formatTitle` humanizes headers |
| framework | PARTIAL | `src/format.ts`, `src/client/stdlib/inputs.js`                                                                                                                                                      | `format.ts` only covers dates and byte sizes; tables are `Inputs.table` from the `@observablehq/inputs` dependency (`package.json` `^0.12.0`), whose source is not in the checkout — unverified here              |
| mosaic    | PARTIAL | `packages/vgplot/inputs/src/Table.js`, `packages/vgplot/inputs/src/util/format.js`                                                                                                                  | `format` option maps column name → formatter; default `formatLocaleAuto` is `toLocaleString` per value (grouping, no range, no units); headers are raw column names                                               |
| streamlit | PARTIAL | `frontend/lib/src/util/formatNumber.ts`, `lib/streamlit/elements/lib/column_types.py`, `frontend/lib/src/components/elements/Metric/metricColors.ts`                                                | Per-column `NumberColumn(format=...)` presets incl. `compact`; metric delta text uses a darker green than its icon                                                                                                |

**Count:** 4 of 4 format numbers for display; 1 of 4 (evidence) formats against a range and humanizes titles; 2 of 4 (evidence, streamlit) theme delta colors. Every gap in this slice has a reference except GAP-013, where no reference passes 4.5:1 (evidence `--theme-positive: #16a34a` is 3.30:1).

## Implementation inventory

### evidence (`research_repos/evidence/core/src/user-components/`)

| Concern                         | Files                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format codes + range auto-scale | `formatValue.ts` (`BASE_AUTO_FORMATS`, `getAutoFormat(baseFormat, range)` reads only `range.max`, `formatValue(value, formatCode, fallbackValue, range, columnType)`), `formatValue.test.ts`, `VALUE_FORMATTING.md` |
| Unformatted default             | `formatValue.ts` — no `fmt` + numeric value → `'num'`; with no range `getAutoFormat` returns `num0` (grouping, 0 decimals)                                                                                          |
| Range computation               | `getMinMax.ts` (column min/max), `getStackedYMinMax.ts`, `tags/table/table-viz.ts` (`calculateFormatRanges` — only for 3-letter base codes via `isAutoScalableFormat`; skips total rows)                            |
| Table cell formatting           | `tags/table/Table.svelte` (`formatRanges` derived; cell `formatValue(value, cellDisplayFormat, fallback, formatRanges.get(col), type)`)                                                                             |
| Column children (fmt/title)     | `tags/table/measure/schema.ts` (`fmt`, `title`), `tags/table/measure/user-component.ts`, `tags/table/measure/MeasureModel.svelte.ts`, `tags/table/dimension/schema.ts`, `tags/table/TableModel.svelte.ts`           |
| Header titles                   | `formatTitle.ts` (acronym list, lowercase joiners `of the and in on`, `_`→space, `(`→`of`; preserves user `AS` aliases), `formatTitle.test.ts`, `tags/table/TableHeader.svelte`                                     |
| Axis ticks against range        | `tags/series_charts/combo_chart/YAxisModel.svelte.ts` (range across all series on the axis; `axisLabel.formatter` → `formatValue(v, axisFormat, …, {min,max})`)                                                     |
| Data labels against range       | `tags/series_charts/combo_chart/series/SeriesModel.svelte.ts` (`minMax = getMinMax(data, yColumnName)`; label formatter passes it; `textBorderWidth` only when the author sets `border_color`)                      |
| Theme label colors              | `tags/echarts/echarts-themes.ts` (`label.color: mutedForeground` on radar/pie/scatter/…; axis label color)                                                                                                          |
| Delta colors                    | `core/src/styles/base.css` (`--theme-positive: #16a34a`, `--theme-negative: #ef4444`)                                                                                                                               |

### mosaic (`research_repos/mosaic/packages/vgplot/inputs/src/`)

| Concern              | Files                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Per-column formatter | `Table.js` (`format` option, `formatof(this.format, schema)`)                              |
| Default formatting   | `util/format.js` (`formatLocaleAuto`, `formatLocaleNumber` → `toLocaleString`, `-0` → `0`) |

### streamlit (`research_repos/streamlit/`)

| Concern            | Files                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Number presets     | `frontend/lib/src/util/formatNumber.ts` (`formatNumber`, `compact`/`percent`/`dollar`/printf), `frontend/lib/src/util/formatNumber.test.ts`                                                         |
| Column config      | `lib/streamlit/elements/lib/column_types.py`, `lib/streamlit/column_config.py`, `frontend/lib/src/components/widgets/DataFrame/columns/utils.ts`                                                    |
| Delta text vs icon | `frontend/lib/src/components/elements/Metric/metricColors.ts` (`greenTextColor` for text, `greenColor` for icon), `frontend/lib/src/theme/emotionBaseTheme/themeColors.ts` (`green90` vs `green70`) |

### framework

| Concern       | Files                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| Formatting    | `research_repos/framework/src/format.ts` (`formatLocaleDate`, `formatByteSize` only)       |
| Table surface | `research_repos/framework/src/client/stdlib/inputs.js` (re-exports `@observablehq/inputs`) |

**Where they disagree:** evidence scales against a range and humanizes titles; mosaic formats each value alone and keeps raw names. Evidence's range is the axis/column `max` only (a column of large negatives scales by its `max`); this slice decides on the larger of `Math.abs(min)` and `Math.abs(max)` (Trade-offs).

## Trade-offs and what we adopt

| Axis                                | Options seen (repo → approach)                                                                         | Trade-off                                                                        | Our choice, and why                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Range API                           | evidence → `formatValue(…, range)` per call; mosaic → precomputed formatter per column                 | per-call range is one signature change; precomputed avoids re-resolving per cell | Optional `range` argument on `formatValue` (`{ min, max }`), resolved inside `resolveAuto`; callers compute the range once per column/axis                                                                |
| Range magnitude                     | evidence → `Math.abs(range.max)`                                                                       | misses all-negative columns                                                      | the larger of `Math.abs(min)` and `Math.abs(max)` — a deviation, stated in a code comment                                                                                                                 |
| Unformatted table column            | evidence → `num0` (grouping, 0 decimals, no range); mosaic → `toLocaleString` per value                | `num0` renders `0.0991` as `0`                                                   | **evidence parity: `num0`** — decided by the project owner 2026-10-11. Fractions are the author's job via `<Column fmt>`. Non-numeric cells keep `String(value)`; null renders empty as today             |
| Author per-column override          | evidence → `{% measure fmt title %}` children; mosaic → `format` map; streamlit → `column_config`      | children add a tag + child parsing; a map is one prop                            | **`<Column id fmt title />` children** — decided by the project owner 2026-10-11. With children, only listed columns render, in listed order (evidence measure/dimension semantics); none → all columns   |
| Base code in a column (`fmt="usd"`) | evidence → scales against column range (`calculateFormatRanges`)                                       | —                                                                                | same: a base code on a `<Column>` formats against that column's range                                                                                                                                     |
| Header titles                       | evidence → `formatTitle` (acronyms, joiners, `_`→space); mosaic → raw                                  | evidence's grain/comparison branches are for its pivot model                     | Port the humanize core + a short acronym list (`id`, `usd`, `pct`, `wow`, `yoy`, `mom`, `qoq`, `roi`, `kpi`); skip grain/comparison; `<Column title>` wins; a SQL alias with a space or capital is kept   |
| Axis + label range                  | evidence → union of all series on the axis (`YAxisModel`) for ticks; per-series `getMinMax` for labels | per-series labels can still mix units across series                              | One range per value axis (all series, stack totals when stacked) used for both ticks and labels                                                                                                           |
| Dark label color                    | evidence → `label.color: mutedForeground` per series type in the theme                                 | —                                                                                | Theme sets `label.color: textMuted` (and no text border) for `bar`, `line`, `scatter`, `heatmap` in both modes                                                                                            |
| Delta text tone                     | evidence → `#16a34a` (3.30:1, fails); streamlit → darker text than icon                                | darkening the chip too changes the look                                          | Text only, streamlit-style: light `text-emerald-700` (hex 5.48:1 on white), chip/arrow unchanged; dark keeps `emerald-400` (hex 10.30:1 on `#0a0a0a`). Measure the computed oklch in T6 before committing |

Contrast of candidate tones (sRGB hex approximations of the Tailwind tokens; the executing task re-measures computed `oklch`): emerald-600 3.77 white / 5.25 n950; emerald-700 5.48 / 3.61; emerald-400 1.92 / 10.30; red-600 4.83 / 4.10; red-700 6.47 / 3.06; red-400 2.77 / 7.16. `red-600` light already passes; dark `red-400` passes.

## Gap analysis — what we already have vs the references

| Concern                 | Ours today (file)                                                                                                                          | Best reference (file)                     | Gap                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Range-aware auto format | `src/web/src/features/widgets/value/format.ts` — `formatValue(value, code)`, `resolveAuto(base, abs)` on the single value's magnitude      | evidence `formatValue.ts` `getAutoFormat` | partial — same thresholds (k at 4000), no range input (GAP-010)                                                                                                         |
| Table cells             | `src/web/src/features/widgets/table/data-table.tsx` — `String(value)`                                                                      | evidence `tags/table/Table.svelte`        | absent (GAP-009); `DataTable` is shared with `src/web/src/features/pages/sql-block.tsx` echo tables                                                                     |
| Column children         | `src/web/src/features/widgets/table/types.ts` `TableProps` (`data`, `pageSize`, `filters`); `src/web/src/features/widgets/table/table.tsx` | evidence `tags/table/measure/schema.ts`   | absent; reuse `src/web/src/features/widgets/markdown/collect-children.ts` — it requires `title`, so `id` must become the required key and zero children must be allowed |
| Header titles           | `data-table.tsx` `SortableHeader` renders `{column}`                                                                                       | evidence `formatTitle.ts`                 | absent (GAP-012)                                                                                                                                                        |
| Axis ticks              | `src/web/src/features/widgets/charts/to-option.ts` `yAxisOption`, `xTickFormatter` → `safeFormat(v, fmt)`                                  | evidence `YAxisModel.svelte.ts`           | partial — formatted, but per tick (GAP-010)                                                                                                                             |
| Data labels             | `to-option.ts` `labelOption`                                                                                                               | evidence `SeriesModel.svelte.ts`          | partial — per value (GAP-010)                                                                                                                                           |
| Chart label color       | `src/web/src/features/widgets/charts/theme.ts` `buildTheme` — no series `label`                                                            | evidence `echarts-themes.ts`              | absent (GAP-011)                                                                                                                                                        |
| Delta colors            | `src/web/src/features/widgets/value/delta-display.tsx` `GOOD_TEXT`/`BAD_TEXT`                                                              | streamlit `metricColors.ts`               | present, fails WCAG 1.4.3 light (GAP-013)                                                                                                                               |

Status: present and partial. The SL-004/SL-005/SL-006 `shipped` claims survive — they shipped widgets that render; this slice makes them read correctly.

## Deviations

- Range magnitude uses the larger of `Math.abs(min)` and `Math.abs(max)` rather than evidence's `max` — stated in a code comment in `format.ts`.
- `formatTitle` drops evidence's grain/period/comparison branches — they belong to its pivot/metric model, which we do not have.
- `textBorderWidth` is not set on labels at all (evidence sets it only on author request; we have no such option).

## Open decisions

None open — the two owner decisions (unformatted default `num0`; `<Column>` children) are recorded above with their date. After T4 ships, record "Table column formatting follows evidence: `num0` default, `<Column>` children" as an ADR.

## Surface

| Layer  | Files                                                                                                                                                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | — (MDX already passes `<Column>` children through as JSX; confirm the widget registry exposes `Column` in `src/web/src/features/pages/markdown-page.tsx`)                                                                                                               |
| client | `src/web/src/features/widgets/value/format.ts`, new `src/web/src/features/widgets/table/format-title.ts`, new range helper beside `format.ts`                                                                                                                           |
| ui     | `src/web/src/features/widgets/table/data-table.tsx`, `table.tsx`, new `column.tsx`; `src/web/src/features/widgets/charts/to-option.ts`, `theme.ts`; `src/web/src/features/widgets/value/delta-display.tsx`; `src/web/src/features/widgets/markdown/collect-children.ts` |
| pages  | `pages/weekly-review.md` (`weekly_trend` `<Column>` demo)                                                                                                                                                                                                               |
| tests  | colocated `*.unit.test.ts(x)`, `*.stories.tsx` per changed component, `test/integration/`, `test/e2e-browser/`                                                                                                                                                          |

## Tasks

- [ ] T1 — `formatValue` takes an optional `{ min, max }` range; base codes resolve decimals + unit from the larger of `Math.abs(min)` and `Math.abs(max)`; value-only callers unchanged. Unit cases from evidence `formatValue.test.ts` range cases. No screen change.
- [ ] T2 — Charts format value-axis ticks and data labels against one axis range (stack totals when stacked) (GAP-010). Measure: `/weekly-review` Regional split ticks and labels in one unit (screenshot); `/crossfilter-scale` histogram axis unchanged in kind.
- [ ] T3 — echarts theme sets series `label.color` per mode (GAP-011). Measure: dark Regional split label glyph pixels light on `#0a0a0a`, no white border (screenshot pixel sample); light unchanged.
- [ ] T4 — `<Table>` cells: numbers `num0` by default; `<Column id fmt title />` children select, order and format columns (base codes against the column range); `collect-children.ts` generalized for a required `id` (GAP-009). Measure: `/weekly-review` cell text via `eval`, `weekly_trend` demo columns; `/` orders table.
- [ ] T5 — Humanized headers through `format-title.ts`; `<Column title>` wins; sort `aria-sort` and header button names updated (GAP-012). Measure: header text + accessible names via `eval` on `/weekly-review`, `/nested/allocation`.
- [ ] T6 — Delta text tone: light positive text darkened to pass 4.5:1, chip/arrow unchanged (GAP-013). Measure: computed `color` of every delta span in light and dark, ratio ≥ 4.5:1 against its background.

## Out of scope

- Locale/decimal-separator settings (evidence `format-settings.ts`) — no locale story yet.
- Currencies beyond `usd`, `<Column>` alignment, links, conditional colors, sparklines in cells — later table work.
- Touch targets in table pagination — SL-022.
