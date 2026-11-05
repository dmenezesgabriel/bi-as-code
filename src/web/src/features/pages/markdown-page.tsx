import { useRouterState, useSearch } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { searchWithoutEditorKey } from "../editor/edit-search";
import { browserFilterUrlPort } from "../filters/filter-url-port";
import { FiltersProvider } from "../filters/page-filters-context";
import { NavToc } from "../chrome/nav-toc";
import { usePageLanguage } from "../chrome/page-language";
import { CardsProvider } from "../widgets/card/card-scope";
import { withCard } from "../widgets/card/with-card";
import { Column } from "../widgets/table/column";
import { Table } from "../widgets/table/table";
import { AreaChart } from "../widgets/charts/area-chart";
import { BarChart } from "../widgets/charts/bar-chart";
import { LineChart } from "../widgets/charts/line-chart";
import { Heatmap } from "../widgets/charts/heatmap-chart";
import { Histogram } from "../widgets/charts/histogram-chart";
import { ScatterChart } from "../widgets/charts/scatter-chart";
import { ButtonGroup } from "../widgets/inputs/button-group";
import { DateRange } from "../widgets/inputs/date-range";
import { Dropdown } from "../widgets/inputs/dropdown";
import { DOCKED_ROW_HEIGHT, FilterBar } from "../widgets/inputs/filter-bar";
import { MultiSelect } from "../widgets/inputs/multi-select";
import { Search } from "../widgets/inputs/search";
import { Slider } from "../widgets/inputs/slider";
import { TextInput } from "../widgets/inputs/text-input";
import { Toggle } from "../widgets/inputs/toggle";
import { Accordion, AccordionItem } from "../widgets/markdown/accordion";
import { Callout } from "../widgets/markdown/callout";
import { Details } from "../widgets/markdown/details";
import { LineBreak } from "../widgets/markdown/line-break";
import { Note } from "../widgets/markdown/note";
import { Row } from "../widgets/markdown/row";
import { Stack } from "../widgets/markdown/stack";
import { Tab, Tabs } from "../widgets/markdown/tabs";
import { BigValue } from "../widgets/value/big-value";
import { Delta } from "../widgets/value/delta";
import { Sparkline } from "../widgets/value/sparkline-widget";
import { Value } from "../widgets/value/value";
import {
  ProseBlockquote,
  ProseH1,
  ProseH2,
  ProseH3,
  ProseH4,
  ProseH5,
  ProseH6,
  ProseImage,
  ProseLink,
  ProseOrderedList,
  ProseParagraph,
  ProseTable,
  ProseTd,
  ProseTh,
  ProseUnorderedList,
} from "./prose-elements";
import { QueryRegistryProvider } from "./query-registry";
import { SqlBlockPre } from "./sql-block";
import type {
  CompiledPageModule,
  DataUpdateSubscription,
  MdxComponentMap,
} from "./types";
import { useDocumentTitle } from "./use-document-title";

/**
 * MDX element overrides. `h1`–`h6` and `p` give markdown text the page type
 * scale; `ul`, `ol` and `blockquote` stop at the same reading measure; `table`, `th` and `td` pad and rule GFM tables; `a` styles links
 * and routes absolute-path ones through the client router so page-to-page navigation never reloads the SPA; `pre` hands
 * fenced code blocks to shiki and pairs named sql fences with their query
 * results; the widgets (`Table` with its `Column` carrier, `BigValue`, `Value`, `Delta`, `Sparkline`,
 * `BarChart`, `LineChart`, `AreaChart`, `ScatterChart`, `Histogram`,
 * `Heatmap`) resolve `data` against that same registry; the input widgets
 * (`Dropdown`, `MultiSelect`, `Slider`, `ButtonGroup`, `TextInput`,
 * `Search`, `Toggle`, `DateRange`) write the page filters those
 * consumers declare, and `FilterBar` is their presentational sticky
 * container; the markdown
 * widgets (`Callout`, `Note`, `LineBreak`, `Details`, `Tabs`, `Tab`,
 * `Accordion`, `AccordionItem`, `Row`, `Stack`) render prose chrome.
 * The charts, `Table` and `BigValue` are wrapped once in `withCard`, so a
 * page with `cards` on puts each on its own card without remounting it.
 * Kept unexported so the map doesn't trip the Fast Refresh rule
 * that files exporting components export only components.
 */
const mdxComponents: MdxComponentMap = {
  h1: ProseH1,
  h2: ProseH2,
  h3: ProseH3,
  h4: ProseH4,
  h5: ProseH5,
  h6: ProseH6,
  p: ProseParagraph,
  ul: ProseUnorderedList,
  ol: ProseOrderedList,
  blockquote: ProseBlockquote,
  table: ProseTable,
  th: ProseTh,
  td: ProseTd,
  a: ProseLink,
  img: ProseImage,
  pre: SqlBlockPre,
  Table: withCard(Table),
  Column,
  BigValue: withCard(BigValue),
  Value,
  Delta,
  Sparkline,
  BarChart: withCard(BarChart),
  LineChart: withCard(LineChart),
  AreaChart: withCard(AreaChart),
  ScatterChart: withCard(ScatterChart),
  Histogram: withCard(Histogram),
  Heatmap: withCard(Heatmap),
  Dropdown,
  MultiSelect,
  Slider,
  ButtonGroup,
  TextInput,
  Search,
  Toggle,
  DateRange,
  FilterBar,
  Callout,
  Note,
  LineBreak,
  Details,
  Tabs,
  Tab,
  Accordion,
  AccordionItem,
  Row,
  Stack,
};

/**
 * Renders one compiled page module: the resolved title is applied to the
 * document and the MDX component renders with the shared component map.
 * Unless its layout sets `table_of_contents: false`, a right-rail ToC built
 * from the article's h2/h3 headings rides along on `xl` viewports, headed
 * by its layout's `table_of_contents_label`.
 * Front-matter `page_width: full` lifts the reading-column caps so the
 * content fills the space beside the sidebar; the ToC rail stays.
 * `cards: true` puts each chart, table and big value on a card over a
 * tinted background.
 *
 * @example
 * const mod = await entry.load();
 * return <MarkdownPage page={mod} siteTitle={config.title} />;
 */
export function MarkdownPage({
  page,
  siteTitle,
  dataUpdates,
}: {
  page: CompiledPageModule;
  siteTitle: string;
  /** `biac dev`'s data-change channel; absent in a build. */
  dataUpdates?: DataUpdateSubscription;
}) {
  useDocumentTitle(page.title, siteTitle);
  const [article, setArticle] = useState<HTMLElement | null>(null);
  const readingColumn = page.layout.page_width !== "full";
  const cards = page.layout.cards === true;
  return (
    <CardModeBackground on={cards}>
      {/* A size container: the ToC rail shows by the width this page has, not
        the viewport's — the editor's preview pane is half the screen. */}
      <div
        className={cn(
          "@container mx-auto flex gap-8 px-6 py-10",
          readingColumn && "max-w-6xl",
        )}
      >
        {/* A jumped heading clears the header by 2rem, and on a page with a
          filter bar the docked row too, by the same gap. The margin is on
          the heading, not `scroll-padding-top` on the scroller: the editor's
          preview pane is a second scroller with its own `--dock-top`. */}
        <main
          ref={setArticle}
          style={{ "--docked-row-height": DOCKED_ROW_HEIGHT } as CSSProperties}
          className={cn(
            "mx-auto w-full min-w-0 space-y-block-gap [&_h2]:scroll-mt-20 [&_h3]:scroll-mt-20 has-[[data-filter-bar]]:[&_h2]:scroll-mt-[calc(var(--dock-top,4rem)+var(--docked-row-height)+2rem)] has-[[data-filter-bar]]:[&_h3]:scroll-mt-[calc(var(--dock-top,4rem)+var(--docked-row-height)+2rem)]",
            readingColumn && "max-w-4xl",
          )}
        >
          <CardsProvider cards={cards}>
            <PageBody page={page} dataUpdates={dataUpdates} />
          </CardsProvider>
        </main>
        {page.layout.table_of_contents !== false && article && (
          <NavToc
            article={article}
            label={page.layout.table_of_contents_label}
          />
        )}
      </div>
    </CardModeBackground>
  );
}

/**
 * In card mode the page behind the cards is tinted so a white card stands
 * out on a white theme. It is painted here, not on `body`, so the tint goes
 * when the reader navigates to a page without cards. The minimum height is
 * the viewport under the `h-12` header — also the editor's preview pane
 * height — so a short page is tinted to the bottom without a scrollbar.
 * The div renders either way: dropping it would change the tree above the
 * widgets and remount them when `cards` is toggled.
 */
function CardModeBackground({
  on,
  children,
}: {
  on: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-cards={on || undefined}
      className={cn(on && "min-h-[calc(100vh-3rem)] bg-card-mode-background")}
    >
      {children}
    </div>
  );
}

/**
 * A hot-swapped page module brings a new MDX component, so its widgets
 * remount. Under a surviving filter scope their render-time `ensure` would
 * re-configure live filters — republishing a slider's silent bounds
 * correction in the middle of a render. Each page version gets a fresh
 * scope instead, re-seeded from the URL, so `?region=` survives the swap.
 */
const pageVersions = new WeakMap<object, number>();
let lastPageVersion = 0;

function pageVersion(content: object): number {
  const known = pageVersions.get(content);
  if (known !== undefined) return known;
  pageVersions.set(content, ++lastPageVersion);
  return lastPageVersion;
}

type PageParams = Readonly<Record<string, unknown>>;

/**
 * What `{{params.*}}` binds: the page filters' held values — an
 * `initialValue` or a seeded default the URL does not hold yet, which the
 * filter scope reports through the returned setter — under the URL's
 * params, which win whenever one is present.
 */
function usePageParams(): [PageParams, (held: PageParams) => void] {
  const search = useSearch({ strict: false });
  const [held, setHeld] = useState<PageParams>({});
  // The editor's flag is not a page parameter, so `{{params.*}}` never sees
  // it. Memoized because the registry re-interpolates whenever `params` is
  // a new object and does so during render: a fresh object per render
  // would never settle.
  const params = useMemo(
    () => ({ ...held, ...searchWithoutEditorKey(search) }),
    [held, search],
  );
  return [params, setHeld];
}

/**
 * The registry sits outside the filter scope so a page swap re-runs only
 * the fences whose SQL changed.
 */
function PageBody({
  page,
  dataUpdates,
}: {
  page: CompiledPageModule;
  dataUpdates: DataUpdateSubscription | undefined;
}) {
  const [params, setHeldParams] = usePageParams();
  // Filter writes use `replaceState`, which the router never sees, so its
  // `search` can be stale: the history entry's key changes on every
  // navigation, including one to a URL the router already believes it is on.
  const navigationKey = useRouterState({
    select: (state) => state.location.state.__TSR_key ?? state.location.href,
  });
  const language = usePageLanguage();
  // Memoized for the same reason; a hot-swapped page module brings the
  // edited translations.yaml with it, so a new page re-reads them.
  const translations = useMemo(
    () => page.translationsFor?.(language),
    [page, language],
  );
  const Content = page.default;
  const scoped = (
    <FiltersProvider
      key={pageVersion(Content)}
      port={browserFilterUrlPort}
      onHeldParamsChange={setHeldParams}
      navigationKey={navigationKey}
    >
      <Content components={mdxComponents} language={language} />
    </FiltersProvider>
  );
  // A page with no named ```sql blocks mounts no registry, so it never
  // downloads the wasm bundle.
  if (page.sqlBlocks.length === 0) return scoped;
  return (
    <QueryRegistryProvider
      sqlBlocks={page.sqlBlocks}
      sqlTables={page.sqlTables}
      params={params}
      translations={translations}
      dataUpdates={dataUpdates}
    >
      {scoped}
    </QueryRegistryProvider>
  );
}
