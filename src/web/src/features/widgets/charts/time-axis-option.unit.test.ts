import { describe, expect, it } from "vitest";
import { xAxisOption } from "./to-option";
import { PINNED_TICK_LIMIT } from "./time-ticks";
import type { SeriesChartProps, XAxisKind } from "./types";

const PROPS: SeriesChartProps = { data: "rain", x: "quarter", y: "mm" };

/* A structural view over the loosely-typed axis option. */
interface TimeAxisProbe {
  boundaryGap?: unknown;
  axisLabel?: {
    customValues?: readonly number[];
    hideOverlap?: boolean;
    showMinLabel?: boolean;
    showMaxLabel?: boolean;
    formatter?: (value: number, index: number) => string;
  };
  axisTick?: { customValues?: readonly number[] };
}

function axis(
  xDomain: readonly unknown[],
  xType: XAxisKind = "time",
  props: Partial<SeriesChartProps> = {},
): TimeAxisProbe {
  return xAxisOption({ xDomain, xType }, { ...PROPS, ...props });
}

function utcDays(count: number): Date[] {
  return Array.from(
    { length: count },
    (_, i) => new Date(Date.UTC(2015, 0, i + 1)),
  );
}

const QUARTERS = [0, 3, 6, 9].map((m) => new Date(Date.UTC(2015, m, 1)));
const QUARTER_TICKS = QUARTERS.map((d) => d.getTime());

describe("xAxisOption on a time axis", () => {
  it("pins its ticks and labels to the data's dates", () => {
    const option = axis(QUARTERS);

    expect(option.axisTick?.customValues).toEqual(QUARTER_TICKS);
    expect(option.axisLabel?.customValues).toEqual(QUARTER_TICKS);
  });

  it("keeps both end labels and pads both ends alike", () => {
    const option = axis(QUARTERS);

    expect(option.axisLabel).toMatchObject({
      showMinLabel: true,
      showMaxLabel: true,
      hideOverlap: false,
    });
    expect(option.boundaryGap).toEqual(["2%", "2%"]);
  });

  it("formats its pinned labels with xFmt", () => {
    const option = axis(QUARTERS, "time", { xFmt: "mdy" });

    expect(option.axisLabel?.formatter?.(QUARTER_TICKS[1] ?? 0, 1)).toBe(
      "4/1/2015",
    );
    expect(option.axisLabel?.customValues).toEqual(QUARTER_TICKS);
  });

  it("leaves a dense axis' ticks to the engine and hides its overlaps", () => {
    const option = axis(utcDays(PINNED_TICK_LIMIT + 1));

    expect(option.axisTick).toBeUndefined();
    expect(option.axisLabel?.customValues).toBeUndefined();
    expect(option.axisLabel?.hideOverlap).toBe(true);
  });
});

describe("xAxisOption on other axes", () => {
  it("pins nothing on a category axis", () => {
    const option = axis(["North", "South"], "category");

    expect(option.axisTick).toBeUndefined();
    expect(option.axisLabel).toBeUndefined();
  });

  it("pins nothing on a value axis", () => {
    const option = axis([1, 2, 3], "value");

    expect(option.axisTick).toBeUndefined();
    expect(option.axisLabel?.customValues).toBeUndefined();
  });
});
