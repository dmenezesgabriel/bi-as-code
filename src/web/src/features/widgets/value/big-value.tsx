import type { ReactElement } from "react";
import type { Row } from "../../data/types";
import type { FilterIds } from "../../filters/filter-ids";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import { cellAt } from "./cell";
import { DeltaDisplay } from "./delta-display";
import { formatValue } from "./format";
import { projectSparklinePoints, sparklineLabel } from "./sparkline-points";
import { SparklineDisplay } from "./sparkline";
import { ValueResult } from "./states";
import type { BigValueProps, SparklineType } from "./types";

/**
 * The `<BigValue>` MDX widget: a KPI headline — small title, formatted
 * scalar, signed delta below, sparkline inline-right — over an all-`<span>`
 * `display:block` tree so MDX `<p>` wrapping stays valid HTML. `data` names
 * a ```sql fence whose selected row holds the value and delta cells;
 * `sparkline` names a second fence for the series; `filters` names page
 * filters whose predicates wrap BOTH fences, so the KPI narrows as a unit.
 * A missing value cell renders `–` and hides the delta and sparkline.
 *
 * @example
 * <BigValue data="kpi" column="revenue" title="Quarter revenue" fmt="usd"
 *   delta="wow_pct" deltaFmt="pct1" text="vs. prior" sparkline="weekly" />
 */
export function BigValue({
  data,
  filters,
  ...props
}: BigValueProps): ReactElement {
  const result = useFilteredQueryRows(data, filters);
  // A cross-filter re-renders the figure in place; tabular digits keep its
  // width from jittering under the reader's eye as the value changes.
  return (
    <span className="block tabular-nums">
      <ValueResult name={data} result={result}>
        {(rows) => (
          <BigValueSuccess
            resolved={resolveCells(rows, props)}
            filters={filters}
            props={props}
          />
        )}
      </ValueResult>
    </span>
  );
}

/** What `resolveCells` lifts out of the render: the display-ready cells. */
interface ResolvedCells {
  readonly formatted: string;
  readonly empty: boolean;
  readonly shownTitle: string | undefined;
  readonly deltaCell: unknown;
}

/**
 * Reads the value and delta cells out of `rows`, throwing `ColumnError`/
 * `FormatError` for bad `column`/`delta`/`fmt`/`deltaFmt` refs. Runs
 * synchronously inside `ValueResult`'s children so its catch renders these
 * as inline alerts — `DeltaDisplay` formats internally, beyond that catch,
 * so the delta's code is validated here first (same dance `delta.tsx` does).
 */
function resolveCells(
  rows: readonly Row[],
  props: Pick<
    BigValueProps,
    "column" | "row" | "fmt" | "title" | "delta" | "deltaFmt"
  >,
): ResolvedCells {
  const row = props.row ?? 0;
  const cell = cellAt(rows, row, props.column);
  const deltaCell =
    props.delta === undefined ? undefined : cellAt(rows, row, props.delta);
  if (props.delta !== undefined) {
    formatValue(deltaCell, props.deltaFmt ?? props.fmt);
  }
  const target = rows[row];
  return {
    formatted: formatValue(cell, props.fmt),
    empty: cell === undefined || cell === null,
    shownTitle:
      props.title ??
      props.column ??
      (target === undefined ? undefined : Object.keys(target)[0]),
    deltaCell,
  };
}

/**
 * The success face: title line, value + sparkline line, delta row. The
 * missing-cell case renders `–` and hides both dressing slots — a
 * param-driven empty result is not an author error.
 */
function BigValueSuccess({
  resolved,
  filters,
  props,
}: {
  resolved: ResolvedCells;
  filters: FilterIds | undefined;
  props: Omit<BigValueProps, "data" | "filters">;
}): ReactElement {
  const showDelta =
    !resolved.empty &&
    resolved.deltaCell !== undefined &&
    resolved.deltaCell !== null;
  return (
    <>
      {resolved.shownTitle !== undefined && (
        <span className="block text-sm text-muted-foreground-faded">
          {resolved.shownTitle}
        </span>
      )}
      <span className="flex items-center gap-2">
        <span className="text-xl font-semibold">{resolved.formatted}</span>
        {!resolved.empty && props.sparkline !== undefined && (
          <SparklineSlot
            name={props.sparkline}
            filters={filters}
            type={props.sparklineType}
            x={props.sparklineX}
            y={props.sparklineY}
            color={props.sparklineColor}
          />
        )}
      </span>
      {showDelta && (
        <span className="block">
          <DeltaDisplay
            value={resolved.deltaCell}
            fmt={props.deltaFmt ?? props.fmt}
            text={props.text}
            chip={props.chip}
            downIsGood={props.downIsGood}
            showSymbol={props.showSymbol}
            symbolPosition={props.symbolPosition ?? "left"}
            neutralRange={props.neutralRange}
          />
        </span>
      )}
    </>
  );
}

/**
 * The sparkline on the value line: its own `ValueResult` so a missing,
 * in-flight or failed second query renders its face without touching the
 * value. It reads the same `filters` the value fence answers — the KPI
 * narrows as a unit. An empty series draws nothing — standalone
 * `<Sparkline>` shows `–`, but inside a KPI the slot collapses instead.
 */
function SparklineSlot({
  name,
  filters,
  type,
  x,
  y,
  color,
}: {
  name: string;
  filters: FilterIds | undefined;
  type: SparklineType | undefined;
  x?: string;
  y?: string;
  color?: string;
}): ReactElement {
  const result = useFilteredQueryRows(name, filters);
  return (
    <ValueResult name={name} result={result}>
      {(rows) => {
        const points = projectSparklinePoints(rows, x, y);
        if (points.length === 0) return null;
        return (
          <SparklineDisplay
            points={points}
            type={type}
            color={color}
            label={sparklineLabel(name, x, y)}
          />
        );
      }}
    </ValueResult>
  );
}
