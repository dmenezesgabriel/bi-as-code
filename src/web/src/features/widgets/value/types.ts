import { Data } from "effect";

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
