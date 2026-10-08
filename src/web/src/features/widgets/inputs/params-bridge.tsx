import type { ReactElement, ReactNode } from "react";
import type { FilterUrlPort } from "../../filters/filter-url-port";
import { usePageFilter } from "../../filters/use-page-filter";
import { QueryRegistryProvider } from "../../pages/query-registry";
import type { SqlBlock } from "../../pages/types";

/**
 * `useSearch`'s default parsing — TanStack `parseSearch` JSON-decodes each
 * param value (`"true"` → `true`, `"30"` → `30`, `["a","b"]` → an array)
 * and falls back to the raw string when it isn't JSON. An absent param
 * binds NULL downstream.
 */
function parseParam(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Test/story scaffold bridging a page filter into `{{params.*}}`
 * interpolation — the harness analogue of `markdown-page.tsx`'s
 * `useSearch` → `params` wiring (which needs the real router). Mounts a
 * nested `QueryRegistryProvider` whose params re-read the filter's URL
 * param through `port` on every committed write (the `usePageFilter`
 * subscription drives the re-render), so a `{{params.id}}` fence
 * re-interpolates and re-queries exactly as the page does.
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
  return (
    <QueryRegistryProvider
      sqlBlocks={blocks}
      sqlTables={{}}
      params={{ [id]: parseParam(port.read()?.searchParams.get(id) ?? null) }}
    >
      {children}
    </QueryRegistryProvider>
  );
}
