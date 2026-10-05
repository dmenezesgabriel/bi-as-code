import { Data } from "effect";

/**
 * One query-result row: column name → value. Arrow `Table` rows stay
 * proxied views over record batches; `toRows` copies them into plain
 * objects so widgets never touch Arrow.
 */
export type Row = Record<string, unknown>;

/**
 * Every failure leaving the data feature. `operation` names the port
 * method that failed; `detail` carries the offending input (the SQL text,
 * the `name ← source` pair, …) so an inline error can say what broke.
 */
export class DataError extends Data.TaggedError("DataError")<{
  readonly operation: "instantiate" | "registerTable" | "query";
  readonly detail: string;
  readonly cause: unknown;
}> {
  get message(): string {
    return `${this.operation} failed (${this.detail}): ${String(this.cause)}`;
  }
}
