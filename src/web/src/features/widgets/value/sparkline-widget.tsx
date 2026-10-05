import type { ReactElement } from "react";
import { useQueryResults } from "../../pages/query-registry";
import { projectSparklinePoints } from "./sparkline-points";
import { SparklineDisplay } from "./sparkline";
import { ValueResult } from "./states";
import type { SparklineProps } from "./types";

/**
 * The `<Sparkline>` MDX widget: `data` names a ```sql fence whose rows are
 * the series — `x`/`y` pick the projection columns (defaults: y = second
 * column, x = first column that isn't y). Renders inline in prose; an empty
 * result renders `–`, an unknown column an inline alert.
 *
 * @example
 * <Sparkline data="weekly_revenue" />
 * <Sparkline data="weekly_revenue" x="week" y="revenue" type="bar" />
 */
export function Sparkline({
  data,
  x,
  y,
  type,
  color,
  label,
}: SparklineProps): ReactElement {
  const result = useQueryResults()[data];
  return (
    <ValueResult name={data} result={result}>
      {(rows) => (
        <SparklineDisplay
          points={projectSparklinePoints(rows, x, y)}
          type={type}
          color={color}
          label={label ?? sparklineLabel(data, x, y)}
        />
      )}
    </ValueResult>
  );
}

/**
 * The svg's accessible name when `label` is unset: `"revenue by week"` when
 * both axes are authored, else the query name — it at least identifies the
 * series.
 */
function sparklineLabel(data: string, x?: string, y?: string): string {
  return x !== undefined && y !== undefined ? `${y} by ${x}` : data;
}
