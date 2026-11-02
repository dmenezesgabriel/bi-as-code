import type { Locator, Page } from "@playwright/test";
import { resultTables } from "./dev-server.fixture.js";

/**
 * One widget reference page: the tags its `mdx echo` fences use, and the
 * live element each one draws, so every example's output is counted
 * against the markup that should have drawn it.
 */
export interface WidgetPage {
  readonly route: string;
  readonly file: string;
  readonly drawn: readonly {
    readonly tag: RegExp;
    readonly live: (page: Page) => Locator;
  }[];
}

export const sparklines = (page: Page) => page.locator("main svg[role=img]");
// echarts marks its host once the applied option has finished painting.
export const charts = (page: Page) => page.locator("main [data-echarts-ready]");

// The page search box sits in the sidebar, outside main.
const comboboxes = (page: Page) => page.locator("main [role=combobox]");

export const WIDGET_PAGES: readonly WidgetPage[] = [
  {
    route: "/components/table",
    file: "pages/components/table.md",
    drawn: [{ tag: /<Table\b/g, live: resultTables }],
  },
  {
    route: "/components/big-value",
    file: "pages/components/big-value.md",
    drawn: [
      // The value line's `text-xl` span is the one mark every BigValue draws.
      {
        tag: /<BigValue\b/g,
        live: (page) => page.locator("main span.text-xl"),
      },
    ],
  },
  {
    route: "/components/value",
    file: "pages/components/value.md",
    drawn: [
      { tag: /<Delta\b/g, live: (page) => page.locator("main [data-status]") },
      { tag: /<Sparkline\b/g, live: sparklines },
    ],
  },
  {
    route: "/components/bar-chart",
    file: "pages/components/bar-chart.md",
    drawn: [{ tag: /<BarChart\b/g, live: charts }],
  },
  {
    route: "/components/line-chart",
    file: "pages/components/line-chart.md",
    drawn: [{ tag: /<LineChart\b/g, live: charts }],
  },
  {
    route: "/components/area-chart",
    file: "pages/components/area-chart.md",
    drawn: [{ tag: /<AreaChart\b/g, live: charts }],
  },
  {
    route: "/components/scatter-chart",
    file: "pages/components/scatter-chart.md",
    drawn: [{ tag: /<ScatterChart\b/g, live: charts }],
  },
  {
    route: "/components/histogram",
    file: "pages/components/histogram.md",
    // The cross-filter example pairs the histograms with a bar chart, and
    // both draw the same echarts host.
    drawn: [{ tag: /<(?:Histogram|BarChart)\b/g, live: charts }],
  },
  {
    route: "/components/heatmap",
    file: "pages/components/heatmap.md",
    drawn: [{ tag: /<Heatmap\b/g, live: charts }],
  },
  {
    route: "/layout/callout",
    file: "pages/layout/callout.md",
    drawn: [
      { tag: /<Callout\b/g, live: (page) => page.locator("main [role=note]") },
    ],
  },
  {
    route: "/layout/note",
    file: "pages/layout/note.md",
    // Other widgets share the muted text-xs tone; only a Note pads below it.
    drawn: [
      {
        tag: /<Note\b/g,
        live: (page) =>
          page.locator("main div.pb-3.text-xs.text-muted-foreground-faded"),
      },
    ],
  },
  {
    route: "/layout/line-break",
    file: "pages/layout/line-break.md",
    // A LineBreak draws one <br> per line, not one mark per tag, so the
    // page is held to the shared no-alert, no-scroll checks only.
    drawn: [],
  },
  {
    route: "/layout/details",
    file: "pages/layout/details.md",
    // The disclosure trigger is the one expandable control a Details draws.
    drawn: [
      {
        tag: /<Details\b/g,
        live: (page) => page.locator("main button[aria-expanded]"),
      },
    ],
  },
  {
    route: "/layout/tabs",
    file: "pages/layout/tabs.md",
    drawn: [
      { tag: /<Tabs\b/g, live: (page) => page.locator("main [role=tablist]") },
    ],
  },
  {
    route: "/layout/accordion",
    file: "pages/layout/accordion.md",
    drawn: [
      {
        tag: /<Accordion(?![A-Za-z])/g,
        live: (page) => page.locator("main [data-slot=accordion-root]"),
      },
    ],
  },
  {
    route: "/layout/row",
    file: "pages/layout/row.md",
    drawn: [
      {
        tag: /<Row\b/g,
        live: (page) => page.locator("main div.flex-wrap.gap-4"),
      },
    ],
  },
  {
    route: "/layout/stack",
    file: "pages/layout/stack.md",
    drawn: [
      {
        tag: /<Stack\b/g,
        live: (page) => page.locator("main div.flex-col.gap-4"),
      },
    ],
  },
  {
    route: "/filters/dropdown",
    file: "pages/filters/dropdown.md",
    drawn: [{ tag: /<Dropdown\b/g, live: comboboxes }],
  },
  {
    route: "/filters/multi-select",
    file: "pages/filters/multi-select.md",
    drawn: [{ tag: /<MultiSelect\b/g, live: comboboxes }],
  },
  {
    route: "/filters/button-group",
    file: "pages/filters/button-group.md",
    // base-ui's ToggleGroup is the one labelled group a ButtonGroup draws.
    drawn: [
      {
        tag: /<ButtonGroup\b/g,
        live: (page) => page.locator("main [role=group][aria-labelledby]"),
      },
    ],
  },
  {
    route: "/filters/slider",
    file: "pages/filters/slider.md",
    // One labelled group per slider root, whether it draws one thumb or two.
    drawn: [
      {
        tag: /<Slider\b/g,
        live: (page) => page.locator("main [role=group][aria-labelledby]"),
      },
    ],
  },
  {
    route: "/filters/date-range",
    file: "pages/filters/date-range.md",
    // The popover trigger is the one control a DateRange draws.
    drawn: [
      {
        tag: /<DateRange\b/g,
        live: (page) => page.locator("main button[aria-haspopup]"),
      },
    ],
  },
  {
    route: "/filters/text-input",
    file: "pages/filters/text-input.md",
    drawn: [
      {
        tag: /<TextInput\b/g,
        live: (page) => page.locator("main input[type=text]"),
      },
    ],
  },
  {
    route: "/filters/toggle",
    file: "pages/filters/toggle.md",
    drawn: [
      { tag: /<Toggle\b/g, live: (page) => page.locator("main [role=switch]") },
    ],
  },
  {
    route: "/filters/search",
    file: "pages/filters/search.md",
    drawn: [
      {
        tag: /<Search\b/g,
        live: (page) => page.locator("main input[type=search]"),
      },
    ],
  },
  {
    route: "/filters/filter-bar",
    file: "pages/filters/filter-bar.md",
    drawn: [
      {
        tag: /<FilterBar\b/g,
        live: (page) => page.locator("main [data-filter-bar]"),
      },
    ],
  },
  {
    route: "/filters/filters-and-urls",
    file: "pages/filters/filters-and-urls.md",
    drawn: [{ tag: /<(?:Dropdown|MultiSelect)\b/g, live: comboboxes }],
  },
  {
    route: "/crossfilter/select-on-a-chart",
    file: "pages/crossfilter/select-on-a-chart.md",
    drawn: [
      { tag: /<(?:BarChart|ScatterChart|Histogram)\b/g, live: charts },
      { tag: /<Table\b/g, live: resultTables },
    ],
  },
];

/** How many times `tag` appears inside the page file's `mdx echo` fences. */
export function echoedTagCount(source: string, tag: RegExp): number {
  const fences = source.matchAll(/^```mdx echo\n([\s\S]*?)^```$/gm);
  return [...fences].reduce(
    (sum, [, body]) => sum + (body!.match(tag)?.length ?? 0),
    0,
  );
}
