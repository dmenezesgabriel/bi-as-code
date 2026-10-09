import { useCallback, useMemo, useState } from "react";
import type {
  ClauseOptions,
  QueryClient,
  SelectionClause,
} from "../../crossfilter/types";
import { usePageFilters } from "../../filters/page-filters-context";

/**
 * The chart-side publish seam (ADR-0004) — call it once per interactor (a
 * click, a brush, a legend toggle) so each gesture mints its own stable
 * `source`, mosaic's `source: this` — clauses replace by source identity,
 * so one gesture never clears another's clause. `clauseOptions` also pins
 * `clients` to the chart's own consumption `QueryClient`: under
 * `Selection.crossfilter` the published clause skips the publisher, which
 * is how a chart keeps its own rows while every other consumer narrows.
 *
 * `publish` routes the clause into the selection named by its field —
 * `clause.fields[0]` — our filter id ⇄ column convention standing in for
 * mosaic's author-named `as:` channel. A clause must carry its field even
 * when its predicate is `null` (the clearing case): `clauseNone`'s empty
 * `fields` has nothing to route on. Outside a `FiltersProvider` publish
 * degrades to a no-op, the same way consumption degrades to unfiltered
 * reads.
 *
 * @example
 * const { clauseOptions, publish } = useChartPublish(client);
 * publish(clausePoint("region", "West", clauseOptions));
 */
export function useChartPublish(client: QueryClient): {
  clauseOptions: ClauseOptions;
  publish: (clause: SelectionClause) => void;
} {
  const pageFilters = usePageFilters();
  const [source] = useState<object>(() => ({}));
  const clients = useMemo<ReadonlySet<QueryClient>>(
    () => new Set([client]),
    [client],
  );
  const clauseOptions = useMemo<ClauseOptions>(
    () => ({ source, clients }),
    [source, clients],
  );
  const publish = useCallback(
    (clause: SelectionClause) => {
      const field = clause.fields[0];
      if (!pageFilters || field === undefined) return;
      pageFilters.selection(field).update(clause);
    },
    [pageFilters],
  );
  return { clauseOptions, publish };
}
