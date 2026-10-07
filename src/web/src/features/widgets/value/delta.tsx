import type { ReactElement } from "react";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import { cellAt } from "./cell";
import { DeltaDisplay } from "./delta-display";
import { formatValue } from "./format";
import { ValueResult } from "./states";
import type { DeltaProps } from "./types";

/**
 * The `<Delta>` MDX widget: `data`/`column`/`row` bind the cell holding the
 * signed delta — the WoW/QoQ/target logic lives in the ```sql fence as an
 * author-computed column, `fmt` only dresses it. `filters` names page
 * filters whose predicates wrap the fence's query. Renders inline in prose.
 *
 * @example
 * up <Delta data="kpi" column="wow_pct" fmt="pct1" text="WoW" /> on the prior week.
 */
export function Delta({
  data,
  column,
  row = 0,
  filters,
  ...display
}: DeltaProps): ReactElement {
  const result = useFilteredQueryRows(data, filters);
  return (
    <ValueResult name={data} result={result}>
      {(rows) => {
        const cell = cellAt(rows, row, column);
        // DeltaDisplay formats internally, and a FormatError thrown in that
        // child render would escape ValueResult's catch — so a bad `fmt` is
        // validated here, where the catch still sees it.
        formatValue(cell, display.fmt);
        return <DeltaDisplay value={cell} {...display} />;
      }}
    </ValueResult>
  );
}
