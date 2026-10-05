import type { ReactElement } from "react";
import { useQueryResults } from "../../pages/query-registry";
import { projectSparklinePoints, sparklineLabel } from "./sparkline-points";
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
