import { Link, useSearch } from "@tanstack/react-router";
import { useState, type AnchorHTMLAttributes } from "react";
import { browserFilterUrlPort } from "../filters/filter-url-port";
import { FiltersProvider } from "../filters/page-filters-context";
import { NavToc } from "../chrome/nav-toc";
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
import { FilterBar } from "../widgets/inputs/filter-bar";
import { MultiSelect } from "../widgets/inputs/multi-select";
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
  ProseH1,
  ProseH2,
  ProseH3,
  ProseH4,
  ProseH5,
  ProseH6,
  ProseParagraph,
} from "./prose-elements";
import { QueryRegistryProvider } from "./query-registry";
import { SqlBlockPre } from "./sql-block";
import type { CompiledPageModule, MdxComponentMap } from "./types";
import { useDocumentTitle } from "./use-document-title";

/**
 * MDX element overrides. `h1`–`h6` and `p` give markdown text the page type
 * scale; `a` routes absolute-path links through the client
 * router so page-to-page navigation never reloads the SPA; `pre` hands
 * fenced code blocks to shiki and pairs named sql fences with their query
 * results; the widgets (`Table`, `BigValue`, `Value`, `Delta`, `Sparkline`,
 * `BarChart`, `LineChart`, `AreaChart`, `ScatterChart`, `Histogram`,
 * `Heatmap`) resolve `data` against that same registry; the input widgets
 * (`Dropdown`, `MultiSelect`, `Slider`, `ButtonGroup`, `TextInput`,
 * `Toggle`, `DateRange`) write the page filters those
 * consumers declare, and `FilterBar` is their presentational sticky
 * container; the markdown
 * widgets (`Callout`, `Note`, `LineBreak`, `Details`, `Tabs`, `Tab`,
 * `Accordion`, `AccordionItem`, `Row`, `Stack`) render prose chrome.
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
  a: MarkdownLink,
  pre: SqlBlockPre,
  Table,
  BigValue,
  Value,
  Delta,
  Sparkline,
  BarChart,
  LineChart,
  AreaChart,
  ScatterChart,
  Histogram,
  Heatmap,
  Dropdown,
  MultiSelect,
  Slider,
  ButtonGroup,
  TextInput,
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

function MarkdownLink({
  href = "",
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href.startsWith("/")) {
    return <Link to={href} {...rest} />;
  }
  return <a href={href} {...rest} />;
}

/**
 * Renders one compiled page module: the resolved title is applied to the
 * document and the MDX component renders with the shared component map.
 * Unless front-matter `table_of_contents: false`, a right-rail ToC built
 * from the article's h2/h3 headings rides along on `xl` viewports.
 *
 * @example
 * const mod = await entry.load();
 * return <MarkdownPage page={mod} siteTitle={config.title} />;
 */
export function MarkdownPage({
  page,
  siteTitle,
}: {
  page: CompiledPageModule;
  siteTitle: string;
}) {
  useDocumentTitle(page.title, siteTitle);
  const [article, setArticle] = useState<HTMLElement | null>(null);
  return (
    // A size container: the ToC rail shows by the width this page has, not
    // the viewport's — the editor's preview pane is half the screen.
    <div className="@container mx-auto flex max-w-6xl gap-8 px-6 py-10">
      <main
        ref={setArticle}
        className="mx-auto w-full min-w-0 max-w-4xl [&_h2]:scroll-mt-20 [&_h3]:scroll-mt-20"
      >
        <PageBody page={page} />
      </main>
      {page.frontmatter.table_of_contents !== false && article && (
        <NavToc article={article} />
      )}
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

/**
 * The registry sits outside the filter scope so a page swap re-runs only
 * the fences whose SQL changed.
 */
function PageBody({ page }: { page: CompiledPageModule }) {
  const params = useSearch({ strict: false });
  const Content = page.default;
  const scoped = (
    <FiltersProvider key={pageVersion(Content)} port={browserFilterUrlPort}>
      <Content components={mdxComponents} />
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
    >
      {scoped}
    </QueryRegistryProvider>
  );
}
