import { Cause, Exit } from "effect";
import { DuckDb } from "../data/data-service";
import type { DataRuntime } from "../data/runtime";
import type { InterpolatedQuery } from "./interpolate";
import { attributedToQueryFile } from "./query-file-source";
import type { QueryResult } from "./types";

/**
 * Runs block `name`'s interpolated query to a `QueryResult`, awaiting the
 * page's table registration first — the registry's own block loop and the
 * filtered consumers (`useFilteredQueryRows`) share it. Never rejects:
 * callers `void` it and a rejection would be unobserved (a disposed runtime
 * mid-unmount throws on await). Every failure becomes an `error` result —
 * or a discarded one when aborted — named by its query file when the block
 * is one.
 *
 * @example
 * const result = await runBlock(runtime, registered, "orders", interpolated["orders"], signal);
 */
export async function runBlock(
  runtime: DataRuntime,
  registered: Promise<Exit.Exit<void, unknown>>,
  name: string,
  interpolated: InterpolatedQuery,
  signal: AbortSignal,
): Promise<QueryResult> {
  return attributedToQueryFile(
    name,
    await resultOf(runtime, registered, interpolated, signal),
  );
}

async function resultOf(
  runtime: DataRuntime,
  registered: Promise<Exit.Exit<void, unknown>>,
  interpolated: InterpolatedQuery,
  signal: AbortSignal,
): Promise<QueryResult> {
  if (interpolated.errors.length > 0) {
    return { status: "error", message: interpolated.errors.join("; ") };
  }
  try {
    const reg = await registered;
    if (Exit.isFailure(reg)) {
      return { status: "error", message: errorMessage(reg.cause) };
    }
    if (signal.aborted) return { status: "loading" };
    const exit = await runtime.runPromiseExit(
      DuckDb.use((db) => db.queryRows(interpolated.sql, interpolated.params)),
      { signal },
    );
    if (Exit.isSuccess(exit)) return { status: "success", rows: exit.value };
    return { status: "error", message: errorMessage(exit.cause) };
  } catch (cause) {
    return {
      status: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

function errorMessage(cause: Cause.Cause<unknown>): string {
  const squashed = Cause.squash(cause);
  return squashed instanceof Error ? squashed.message : String(squashed);
}
