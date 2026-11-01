import type { ReactElement, ReactNode } from "react";
import type { FilterUrlPort } from "../../filters/filter-url-port";
import { usePageFilters } from "../../filters/page-filters-context";
import { decodeSearchParam } from "../../filters/search-param-value";
import { usePageFilter } from "../../filters/use-page-filter";
import { Table } from "../table/table";
import { QueryRegistryProvider } from "../../pages/query-registry";
import type { SqlBlock } from "../../pages/types";

/**
 * Test/story scaffold bridging a page filter into `{{params.*}}`
 * interpolation — the harness analogue of `markdown-page.tsx`'s
 * `useSearch` → `params` wiring (which needs the real router). Mounts a
 * nested `QueryRegistryProvider` whose params re-read the filter's URL
 * param through `port` on every committed write (the `usePageFilter`
 * subscription drives the re-render), so a `{{params.id}}` fence
 * re-interpolates and re-queries exactly as the page does. Without a URL
 * param the filter's held value binds, as on the page.
 *
 * @example
 * <TextInput id="q" />
 * <ParamsBridge id="q" blocks={[{ name: "hits", sql: "...{{params.q}}..." }]} port={port}>
 *   <Table data="hits" />
 * </ParamsBridge>
 */
export function ParamsBridge({
  id,
  blocks,
  port,
  children,
}: {
  readonly id: string;
  readonly blocks: readonly SqlBlock[];
  readonly port: FilterUrlPort;
  readonly children?: ReactNode;
}): ReactElement {
  // Subscribed for its writes, never read — each committed write re-renders
  // the bridge, and the URL param read below is what `useSearch` hands the
  // real page. A bare ensure is a configure-no-op, so `column: false` set
  // by the input widget survives.
  usePageFilter(id);
  const held = usePageFilters()?.heldParams()[id] ?? null;
  const raw = port.read()?.searchParams.get(id) ?? null;
  return (
    <QueryRegistryProvider
      sqlBlocks={blocks}
      sqlTables={{}}
      params={{ [id]: raw === null ? held : decodeSearchParam(raw) }}
    >
      {children}
    </QueryRegistryProvider>
  );
}

/**
 * A `{{params.id}}` fence rendered as a table — the consumer half of the
 * input stories' params-consumption examples.
 *
 * @example
 * <ParamsTable id="amount" block={HEAVY} port={port} />
 */
export function ParamsTable({
  id,
  block,
  port,
}: {
  readonly id: string;
  readonly block: SqlBlock;
  readonly port: FilterUrlPort;
}): ReactElement {
  return (
    <ParamsBridge id={id} blocks={[block]} port={port}>
      <Table data={block.name} />
    </ParamsBridge>
  );
}
