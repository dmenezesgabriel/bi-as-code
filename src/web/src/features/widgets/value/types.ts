import { Data } from "effect";
import type { FilterIds } from "../../filters/filter-ids";

/**
 * A `fmt` failure a widget renders inline as `role=alert` — an unknown code,
 * or a value type the code cannot format — so a bad `fmt` never takes down
 * the page around it.
 */
export class FormatError extends Data.TaggedError("FormatError")<{
  /** The `fmt` code the author wrote (`"date"`/`"num"` when unset). */
  readonly code: string;
  /** What was wrong — the received value/type and the expected shape. */
  readonly detail: string;
}> {
  get message(): string {
    return `fmt="${this.code}": ${this.detail}`;
  }
}

/**
 * The span of values one axis or table column shows. Bare `num`/`usd`/`pct`
 * pick decimals and unit from it instead of from each value, so every label
 * on the axis reads in one unit — `{ min: 0, max: 7000 }` renders `3000` as
 * `3k`, not `3,000`.
 */
export interface FormatRange {
  readonly min: number;
  readonly max: number;
}

/**
 * A `column=`/`x=`/`y=` miss against a result row: the widget renders the
 * message inline as `role=alert`, naming the absent column and listing the
 * ones the query actually returned.
 */
export class ColumnError extends Data.TaggedError("ColumnError")<{
  /** The column name the author wrote. */
  readonly column: string;
  /** Every key present on the result rows. */
  readonly available: readonly string[];
}> {
  get message(): string {
    const cols =
      this.available.length === 0 ? "(no columns)" : this.available.join(", ");
    return `column "${this.column}" is not in the result — available: ${cols}`;
  }
}

/** Sign status of a delta value against its neutral range. */
export type DeltaStatus = "positive" | "negative" | "neutral";

/**
 * `[min, max]` around zero where a delta reads as neutral instead of
 * up/down; a `null` bound is infinite, so `[null, 0]` neutralizes every
 * non-positive value. Default `[0, 0]` — only an exact zero is neutral.
 */
export type NeutralRange = readonly [min: number | null, max: number | null];

/** One projected sparkline datum: `x` keeps the source cell, `y` is numeric. */
export interface SparklinePoint {
  readonly x: unknown;
  readonly y: number;
}

/** The sparkline's mark — a stroked path, a filled path, or bars. */
export type SparklineType = "line" | "area" | "bar";

/**
 * Props of the `<Value>` MDX widget: `data` is the name a named ```sql
 * fence on the same page registered; `column` picks the cell out of the
 * selected row (default: the row's first key — the aggregation SQL lives in
 * the fence, this names a result column, not an expression); `row` selects
 * the row index (default 0); `filters` names the page filters whose
 * predicates wrap the fence's query — a lone id or a list.
 */
export interface ValueProps {
  readonly data: string;
  readonly column?: string;
  readonly row?: number;
  readonly fmt?: string;
  readonly filters?: FilterIds;
  /** CSS color for the formatted value. */
  readonly color?: string;
  /** Render negative numbers in the negative color, wins over `color`. */
  readonly redNegatives?: boolean;
}

/**
 * Props of the `<Delta>` MDX widget: `data`/`column`/`row` bind the signed
 * delta cell exactly like `<Value>`; `filters` names the page filters whose
 * predicates wrap the fence's query; the remaining props pass through to
 * `DeltaDisplay` unchanged.
 */
export interface DeltaProps {
  readonly data: string;
  readonly column?: string;
  readonly row?: number;
  readonly fmt?: string;
  readonly filters?: FilterIds;
  readonly text?: string;
  readonly chip?: boolean;
  readonly downIsGood?: boolean;
  readonly showValue?: boolean;
  readonly showSymbol?: boolean;
  readonly symbolPosition?: "left" | "right";
  readonly neutralRange?: NeutralRange;
}

/**
 * Props of the `<BigValue>` MDX widget — a KPI headline composing the
 * family's pieces: `data`/`column`/`row`/`fmt` bind and format the scalar
 * exactly like `<Value>`; `delta` names a second column in the same row
 * holding the signed comparison (the WoW/QoQ math lives in the fence),
 * dressed by `deltaFmt`/`text`/`chip`/`downIsGood`/`showSymbol`/
 * `symbolPosition`/`neutralRange`; `sparkline` names a second ```sql fence
 * whose rows are the series, projected by `sparklineX`/`sparklineY` and
 * drawn as `sparklineType` in `sparklineColor`; `filters` names the page
 * filters whose predicates wrap BOTH fences — the value's and the
 * sparkline's — so the KPI narrows as a unit: a trend of the same data
 * must answer the same predicate. A missing cell renders `–`
 * and hides the delta and sparkline — a param-driven empty result is not
 * an author error.
 */
export interface BigValueProps {
  readonly data: string;
  readonly column?: string;
  readonly row?: number;
  readonly fmt?: string;
  readonly filters?: FilterIds;
  /** Title line; defaults to the resolved column key. */
  readonly title?: string;
  /** Column in the same row holding the signed delta. */
  readonly delta?: string;
  /** `formatValue` preset for the delta; defaults to `fmt`. */
  readonly deltaFmt?: string;
  /** Caption after the delta — "vs. prior week". */
  readonly text?: string;
  readonly chip?: boolean;
  readonly downIsGood?: boolean;
  readonly showSymbol?: boolean;
  readonly symbolPosition?: "left" | "right";
  readonly neutralRange?: NeutralRange;
  /** Name of a second ```sql fence whose rows are the sparkline series. */
  readonly sparkline?: string;
  readonly sparklineType?: SparklineType;
  readonly sparklineX?: string;
  readonly sparklineY?: string;
  readonly sparklineColor?: string;
}

/**
 * Props of the `<Sparkline>` MDX widget: `data` names a ```sql fence whose
 * rows are the series; `x`/`y` name the projection columns (defaults: y =
 * second column or first on single-column rows, x = first column that isn't
 * y, else row position); `label` is the svg's `aria-label`; `filters` names
 * the page filters whose predicates wrap the fence's query — a lone id or a
 * list.
 */
export interface SparklineProps {
  readonly data: string;
  readonly x?: string;
  readonly y?: string;
  readonly type?: SparklineType;
  readonly color?: string;
  readonly label?: string;
  readonly filters?: FilterIds;
}
