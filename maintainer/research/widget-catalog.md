# Widget catalog — parity list across the 4 references

**Ephemeral.** Phase-1-scoped like [`feature-census.md`](feature-census.md). Every row is one widget a user could expect; the `Refs` column names which references implement it; `Status` maps it to a backlog slice or marks it `later`. Verified against `evidence/docs/components/*.mdx`, `evidence/core/src/user-components/tags/`, `framework/docs/inputs/*.md`, `mosaic/packages/vgplot/inputs/src/` + `plot/interactors.js`, `streamlit/lib/streamlit/elements/`.

Status vocabulary: `SL-NNN` backlog row · `later` deferred milestone · `—` not planned (would need justification).

## Data display

| Widget            | Refs                                                                                 | Status                   |
| ----------------- | ------------------------------------------------------------------------------------ | ------------------------ |
| `<Table>`         | evidence `table` · framework `Inputs.table` · streamlit `dataframe`                  | SL-004                   |
| `<BigValue>`      | evidence `big_value` · streamlit `metric`                                            | SL-005                   |
| `<Value>` inline  | evidence `value`                                                                     | SL-005                   |
| delta/comparison  | evidence `delta`/`benchmark_comparison`/`target_comparison` · streamlit metric delta | later                    |
| `<ProgressBars>`  | evidence `progress_bars` · streamlit `progress`                                      | later                    |
| `<Sparkline>`     | evidence `sparkline`                                                                 | SL-005 (inside BigValue) |
| `<DimensionGrid>` | evidence `dimension_grid`                                                            | later                    |
| `<Pivot>`         | evidence `pivot`                                                                     | later                    |
| `<Download>`      | evidence `download` · streamlit `download_button`                                    | later                    |
| `<Clock>`         | evidence `clock`                                                                     | later                    |
| `<Html>`          | evidence `html` · framework inline HTML                                              | SL-008 (mdx raw html)    |

## Charts (ECharts engine — chart-type names follow evidence's docs)

| Widget              | Refs                                          | Status |
| ------------------- | --------------------------------------------- | ------ |
| `<BarChart>`        | evidence `bar_chart`/`horizontal_bar_chart`   | SL-006 |
| `<LineChart>`       | evidence `line_chart`                         | SL-006 |
| `<AreaChart>`       | evidence `area_chart`                         | SL-006 |
| `<ScatterChart>`    | evidence `scatter_chart`                      | SL-007 |
| `<Histogram>`       | evidence `histogram`                          | SL-007 |
| `<Heatmap>`         | evidence `heatmap`/`heat_grid`                | SL-007 |
| `<PieChart>`        | evidence `pie_chart`                          | later  |
| `<FunnelChart>`     | evidence `funnel_chart`                       | later  |
| `<SankeyChart>`     | evidence `sankey_chart`                       | later  |
| `<Treemap>`         | evidence `treemap`                            | later  |
| `<Candlestick>`     | evidence `candlestick`                        | later  |
| `<RadarChart>`      | evidence `radar_chart`                        | later  |
| `<PolarChart>`      | evidence `polar_chart`                        | later  |
| `<ComboChart>`      | evidence `combo_chart`                        | later  |
| `<WaterfallChart>`  | evidence `waterfall_chart`                    | later  |
| `<BubbleChart>`     | evidence `bubble_chart`                       | later  |
| `<ChordChart>`      | evidence `chord_chart`                        | later  |
| `<CalendarHeatmap>` | evidence `calendar_heatmap`                   | later  |
| `<Map>`             | evidence `map`/`custom_map` · streamlit `map` | later  |
| reference marks     | evidence `reference_line/area/point`          | later  |
| custom spec         | evidence `custom_echart`                      | later  |

## Filter inputs

| Widget                   | Refs                                                                                                | Status                      |
| ------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------- |
| `<Dropdown>`             | evidence `dropdown` · framework `Inputs.select` · mosaic `Menu` · streamlit `selectbox`             | SL-010                      |
| `<MultiSelect>` + search | evidence dropdown multi · mosaic `Search`/`Menu` · streamlit `multiselect` (search, max-selections) | SL-010                      |
| `<Slider>`               | evidence `slider` · mosaic `Slider` · streamlit `slider`/`select_slider`                            | SL-011                      |
| `<DateRange>`            | evidence `range_calendar` · streamlit `date_input`                                                  | SL-011                      |
| `<TextInput>`            | evidence `text_input` · framework `Inputs.text` · streamlit `text_input`                            | SL-011                      |
| `<ButtonGroup>`          | evidence `button_group`/`input_tabs` · streamlit `segmented_control`/`pills`                        | SL-011                      |
| `<Toggle>`               | evidence `toggle` · framework `Inputs.toggle` · streamlit `toggle`/`checkbox`                       | SL-011                      |
| `<DateGrainSelector>`    | evidence `date_grain_selector`                                                                      | later                       |
| `<ComparisonSelector>`   | evidence `comparison_selector`                                                                      | later                       |
| `<FilterBar>`            | evidence `filter_bar`                                                                               | SL-012                      |
| `<TableFilter>`          | evidence `table_filter`                                                                             | later                       |
| search input             | framework `Inputs.search` · mosaic `Search`                                                         | SL-010 (inside MultiSelect) |

## Cross-filter interactions (from mosaic `interactors.js`)

| Interaction                                | Maps to clause  | Status |
| ------------------------------------------ | --------------- | ------ |
| intervalX / intervalY / intervalXY brush   | `interval`      | SL-014 |
| point click on a mark                      | `point`         | SL-014 |
| toggleX/Y/Z/color (legend/category toggle) | `list`          | SL-014 |
| nearestX/Y/XY (pointer-driven)             | `point`         | later  |
| region (rectangular lasso)                 | `interval`×2    | later  |
| highlight (hover emphasis, no filter)      | — (visual only) | later  |

## Layout & structure

| Widget           | Refs                                      | Status           |
| ---------------- | ----------------------------------------- | ---------------- |
| `<Row>`          | evidence `row` · framework `hconcat`      | SL-008           |
| `<Stack>`/`Grid` | evidence `stack` · framework `vconcat`    | SL-008           |
| `<Tabs>`         | evidence `tab`/`tabs` · streamlit `tabs`  | SL-008           |
| `<Accordion>`    | evidence `accordion`/`accordion_item`     | SL-008           |
| `<Details>`      | evidence `details` · streamlit `expander` | SL-008           |
| `<Modal>`        | evidence `modal` · streamlit `dialog`     | later            |
| `<InputTabs>`    | evidence `input_tabs`                     | later            |
| `<Repeat>`       | evidence `repeat`                         | later            |
| `<If>`/`<Else>`  | evidence `if`/`else`/`else_if`            | later            |
| `<Partial>`      | evidence `partial`                        | later            |
| `<PageBreak>`    | evidence `page_break`                     | later            |
| `<PrintGroup>`   | evidence `print_group`                    | later            |
| `<LineBreak>`    | evidence `line_break`                     | SL-008 (trivial) |

## Markdown content

| Widget                 | Refs                                             | Status         |
| ---------------------- | ------------------------------------------------ | -------------- |
| `<Callout>`            | evidence `callout` · streamlit `alert`           | SL-008         |
| `<Note>`               | evidence `note`                                  | SL-008         |
| `<Commentary>`         | evidence `commentary`                            | later          |
| `<Info>`               | evidence `info`                                  | later          |
| `<Icon>`               | evidence `icon`                                  | later          |
| `<Image>`              | evidence `image` · streamlit `image`             | later          |
| `<Iframe>`             | evidence `iframe` · streamlit `iframe`           | later          |
| `<Audio>`/media        | evidence `audio` · streamlit media               | later          |
| `<File>`               | evidence `file`                                  | later          |
| `<Logo>`               | evidence `logo`                                  | later          |
| code fence + highlight | evidence `fence` · framework fenced blocks       | SL-001 (shiki) |
| ` ```sql ` block       | evidence + framework                             | SL-003         |
| `<LinkButton>`         | evidence `link_button` · streamlit `link_button` | later          |
| `<Badge>`/`chip`       | (none directly; streamlit `badge`)               | later          |

## Page chrome / app shell

| Surface           | Refs                                           | Status |
| ----------------- | ---------------------------------------------- | ------ |
| sidebar nav tree  | evidence `PageNavTree` · framework `sidebar`   | SL-002 |
| table of contents | evidence `TableOfContents` · framework `toc`   | SL-002 |
| theme light/dark  | evidence `theme` · framework `themes`          | SL-002 |
| breadcrumbs       | (framework header nav; streamlit `navigation`) | SL-002 |
| search            | framework `search`                             | later  |
| language menu     | evidence `LanguageMenuItems`                   | later  |
| period picker     | evidence `PeriodPicker`/`workflow_period`      | later  |

## Execution-model widgets (streamlit-only semantics — recorded for completeness)

| Widget                                 | Note                                                                                                                                        | Status                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| form batching                          | streamlit `form` defers widget rerun until submit — our URL/selection model has no rerun loop; closest analog is a "apply filters" deferral | later, only if interaction-reference shows the need |
| `data_editor`                          | editable grid — write-back is outside BI-read model                                                                                         | —                                                   |
| `file_uploader`/`camera`/`audio_input` | upload inputs — outside Phase-1 scope                                                                                                       | later                                               |
| `chat`/feedback widgets                | conversational UX — out of scope                                                                                                            | —                                                   |
| `balloons`/`snow`                      | decorative                                                                                                                                  | —                                                   |

---

## Gaps

| Id      | Gap                                                                                                                                                                                               | Reference                                                                                                                                                                       | Closed by |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| GAP-100 | `<Table>` and the `display` sql fence have no way to take their rows away: no CSV serializer, no file-saving helper, no download icon (`grep -rli download src` finds no export code, 2026-11-11) | evidence `core/src/user-components/tags/table/TableDownloadButton.svelte` (xlsx), streamlit `DataFrame/hooks/useDataExporter.ts` (CSV with BOM); framework and mosaic have none | SL-070    |
