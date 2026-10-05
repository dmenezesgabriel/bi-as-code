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
