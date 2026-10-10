import { useState } from "react";
import type { QueryResult } from "../../pages/types";

type SuccessResult = Extract<QueryResult, { status: "success" }>;

/** The last success a chart painted, with the `filtered` flag its rows came with. */
interface PaintedResult {
  readonly result: SuccessResult;
  readonly filtered: boolean;
}

/** What a chart renders: `pending` marks kept rows a newer re-query will replace. */
export interface SettledChartResult {
  readonly result: QueryResult | undefined;
  readonly filtered: boolean;
  readonly pending: boolean;
}

/**
 * Paint the last result that landed (`settled`) and flag it `pending` while
 * a newer re-query is in flight, so the chart stays mounted and repaints as
 * each result lands instead of swapping in its loading face on every
 * cross-filter publish — the unmount dropped the echarts instance (and a held
 * brush) before a fast drag's results could paint. Before the first filtered
 * result lands, `settled` is `loading`: the last success painted (the
 * registry's rows) is kept with the `filtered` flag it came with, so it
 * still projects through the raw-row model. An error or a missing fence
 * forgets the kept rows, so stale numbers never hide a failure. Mosaic's
 * vgplot keeps its last render the same way.
 *
 * @example
 * const { result, filtered, pending } = useSettledChartResult(read.settled, read.filtered, read.pending);
 */
export function useSettledChartResult(
  settled: QueryResult | undefined,
  filtered: boolean,
  pending: boolean,
): SettledChartResult {
  const [painted, setPainted] = useState<PaintedResult | undefined>(undefined);
  const next = nextPainted(painted, settled, filtered);
  // React's "adjust state while rendering" pattern: no effect round-trip,
  // so the first render after a success already reports it as kept.
  if (next !== painted) setPainted(next);
  if (settled?.status === "loading" && next) return { ...next, pending: true };
  return {
    result: settled,
    filtered,
    pending: pending && settled?.status === "success",
  };
}

/** The painted result after `result` lands — `painted` itself when nothing changes. */
function nextPainted(
  painted: PaintedResult | undefined,
  result: QueryResult | undefined,
  filtered: boolean,
): PaintedResult | undefined {
  if (result?.status === "loading") return painted;
  if (result?.status !== "success") return undefined;
  if (painted?.result === result && painted.filtered === filtered) {
    return painted;
  }
  return { result, filtered };
}
