import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  withFilteredData,
  withQueryData,
  withThemeMode,
} from "../../../../.storybook/decorators";
import { Heatmap } from "./heatmap-chart";
import {
  TREND_ROWS,
  WEEKLY_TREND,
  appliedOption,
  dbWith,
  readyHost,
} from "./series-chart.fixture";
import type { HeatmapChartProps } from "./types";

const meta = {
  title: "Widgets/Charts/Heatmap",
  component: Heatmap,
  args: { data: "weekly_trend", x: "week", y: "region", value: "orders" },
} satisfies Meta<HeatmapChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Week columns × region rows, cell shade by orders — the visualMap strip
 * doubles as the legend. */
export const WeeklyGrid: Story = {
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const host = await readyHost(canvasElement);
    expect(host.querySelector("canvas")).not.toBeNull();
    expect(host).toHaveAttribute(
      "aria-label",
      "heatmap chart of orders by week and region",
    );
    const option = await appliedOption<{
      series?: { type?: string; data?: unknown[] }[];
      xAxis?: { type?: string; position?: string; data?: unknown[] }[];
      yAxis?: { type?: string; inverse?: boolean }[];
      visualMap?: {
        min?: number;
        max?: number;
        inRange?: { color?: string[] };
      }[];
    }>(canvasElement);
    expect(option.series?.[0]?.type).toBe("heatmap");
    expect(option.series?.[0]?.data).toHaveLength(6);
    expect(option.xAxis?.[0]?.type).toBe("category");
    expect(option.xAxis?.[0]?.position).toBe("top");
    expect(option.yAxis?.[0]?.inverse).toBe(true);
    expect(option.visualMap?.[0]?.min).toBe(90);
    expect(option.visualMap?.[0]?.max).toBe(140);
  },
};

/** `colorScale` with one color expands to a surface-anchored gradient. */
export const SingleColorScale: Story = {
  args: { colorScale: "#d97706" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      visualMap?: { inRange?: { color?: string[] } }[];
    }>(canvasElement);
    expect(option.visualMap?.[0]?.inRange?.color).toEqual([
      "#ffffff",
      "#d97706",
    ]);
  },
};

/** A sparse fence leaves the unobserved cells blank — no zero-fill. */
export const SparseGrid: Story = {
  decorators: [
    withQueryData(
      [WEEKLY_TREND],
      // South only observed week 1 — its weeks 2–3 cells stay blank.
      dbWith(
        TREND_ROWS.filter(
          (r) =>
            !(r.region === "South" && typeof r.week === "number" && r.week > 1),
        ),
      ),
    ),
  ],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { data?: unknown[] }[];
      yAxis?: { data?: unknown[] }[];
    }>(canvasElement);
    expect(option.yAxis?.[0]?.data).toEqual(["North", "South"]);
    expect(option.series?.[0]?.data).toHaveLength(4);
  },
};

/** `labels` prints each cell's `valueFmt`-formatted value. */
export const CellLabels: Story = {
  args: { labels: true, valueFmt: "num0" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: {
        label?: {
          show?: boolean;
          formatter?: (p: { value: number[] }) => string;
        };
      }[];
    }>(canvasElement);
    const label = option.series?.[0]?.label;
    expect(label?.formatter?.({ value: [0, 0, 95.4] })).toBe("95");
  },
};

/** An all-equal value column pins `visualMap` min==max — the ramp still
 * renders a single solid fill instead of collapsing. */
export const ConstantValue: Story = {
  decorators: [
    withQueryData(
      [WEEKLY_TREND],
      dbWith(TREND_ROWS.map((r) => ({ ...r, orders: 7 }))),
    ),
  ],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      visualMap?: { min?: number; max?: number }[];
    }>(canvasElement);
    expect(option.visualMap?.[0]?.min).toBe(7);
    expect(option.visualMap?.[0]?.max).toBe(7);
  },
};

/** The dark theme re-anchors the ramp on the dark surface — the "no data"
 * end blends into `dark:bg-neutral-950` instead of going white. */
export const Dark: Story = {
  decorators: [
    withThemeMode("dark"),
    withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS)),
  ],
  play: async ({ canvasElement }) => {
    // appliedOption waits for the ready host — the dark theme's presence is
    // implied by the ramp anchor, which only resolves to the dark surface
    // when mode is dark.
    const option = await appliedOption<{
      visualMap?: { inRange?: { color?: string[] } }[];
    }>(canvasElement);
    expect(option.visualMap?.[0]?.inRange?.color).toEqual([
      "#0a0a0a",
      "#2563eb",
    ]);
  },
};

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=South` seeds the filter, one row of cells remains. */
export const Filtered: Story = {
  args: { filters: "region" },
  decorators: [withFilteredData([WEEKLY_TREND], TREND_ROWS, "region", "South")],
  play: async ({ canvasElement }) => {
    await readyHost(canvasElement);
    const option = await appliedOption<{
      series?: { data?: unknown[] }[];
      yAxis?: { data?: unknown[] }[];
    }>(canvasElement);
    expect(option.yAxis?.[0]?.data).toEqual(["South"]);
    expect(option.series?.[0]?.data).toHaveLength(3);
  },
};
