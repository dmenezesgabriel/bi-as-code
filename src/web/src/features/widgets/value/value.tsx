import type { ReactElement } from "react";
import { cn } from "../../../lib/cn";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import { cellAt } from "./cell";
import { coerceNumeric, formatValue } from "./format";
import { ValueResult } from "./states";
import type { ValueProps } from "./types";

/**
 * The `<Value>` MDX widget: `data` names a ```sql fence on the same page
 * whose materialized rows it reads — `column` picks the cell (default: the
 * row's first key), `row` the row index (default 0). All SQL, including the
 * aggregation, lives in the fence the author wrote; the widget only formats
 * and renders. `filters` names page filters whose predicates wrap the
 * fence's query. It renders inline, so it can sit mid-sentence in prose.
 *
 * @example
 * Quarter revenue closed at <Value data="kpi" column="revenue" fmt="usd" />.
 */
export function Value({
  data,
  column,
  row = 0,
  fmt,
  color,
  redNegatives = false,
  filters,
}: ValueProps): ReactElement {
  const result = useFilteredQueryRows(data, filters);
  return (
    <ValueResult name={data} result={result}>
      {(rows) => {
        const cell = cellAt(rows, row, column);
        const formatted = formatValue(cell, fmt);
        const numeric = coerceNumeric(cell);
        // evidence parity: a negative under redNegatives reads red even when
        // color is also set — the class wins, so the style is withheld.
        const negative = redNegatives && numeric !== null && numeric < 0;
        return (
          <span
            className={cn(
              "inline",
              negative && "text-red-600 dark:text-red-400",
            )}
            style={negative || color === undefined ? undefined : { color }}
          >
            {formatted}
          </span>
        );
      }}
    </ValueResult>
  );
}
