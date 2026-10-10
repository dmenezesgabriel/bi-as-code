import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { QueryResult } from "../../pages/types";
import { useSettledChartResult } from "./use-settled-chart-result";

const LOADING: QueryResult = { status: "loading" };
const REGISTRY: QueryResult = { status: "success", rows: [{ n: 1 }] };
const FAILED: QueryResult = { status: "error", message: "boom" };

interface SettledProps {
  result: QueryResult | undefined;
  filtered: boolean;
  pending?: boolean;
}

function renderSettled(result: QueryResult | undefined, filtered: boolean) {
  return renderHook(
    (props: SettledProps) =>
      useSettledChartResult(
        props.result,
        props.filtered,
        props.pending ?? false,
      ),
    { initialProps: { result, filtered } as SettledProps },
  );
}

describe("useSettledChartResult", () => {
  it("reports the first load as loading — nothing was painted yet", () => {
    const { result } = renderSettled(LOADING, false);

    expect(result.current).toEqual({
      result: LOADING,
      filtered: false,
      pending: false,
    });
  });

  it("keeps the last success with the filtered flag its rows came with", () => {
    const { result, rerender } = renderSettled(REGISTRY, false);

    rerender({ result: LOADING, filtered: true });

    expect(result.current.result).toBe(REGISTRY);
    expect(result.current.filtered).toBe(false);
    expect(result.current.pending).toBe(true);
  });

  it("paints a landed result dimmed while a newer re-query is pending", () => {
    const { result, rerender } = renderSettled(REGISTRY, false);
    const landed: QueryResult = { status: "success", rows: [{ n: 2 }] };

    rerender({ result: landed, filtered: true, pending: true });

    expect(result.current).toEqual({
      result: landed,
      filtered: true,
      pending: true,
    });
  });

  it("forgets the kept rows after an error so a later load shows loading", () => {
    const { result, rerender } = renderSettled(REGISTRY, false);
    rerender({ result: FAILED, filtered: true });

    rerender({ result: LOADING, filtered: true });

    expect(result.current).toEqual({
      result: LOADING,
      filtered: true,
      pending: false,
    });
  });
});
