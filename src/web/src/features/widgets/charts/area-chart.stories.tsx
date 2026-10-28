import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  withFilteredData,
  withQueryData,
} from "../../../../.storybook/decorators";
import { AreaChart } from "./area-chart";
import {
  SPARSE_TREND_ROWS,
  TREND_ROWS,
  WEEKLY_TREND,
  appliedOption,
  dbWith,
} from "./series-chart.fixture";
import type { SeriesChartProps } from "./types";

const meta = {
  title: "Widgets/Charts/AreaChart",
  component: AreaChart,
  args: { data: "weekly_trend", x: "week", y: "orders", series: "region" },
} satisfies Meta<SeriesChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo shape: the weekly trend as a 100%-stacked area — each week
 * normalized to a share of its total, raw values kept for the tooltip. */
export const PercentStack: Story = {
  args: { stacked: "100%" },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { type?: string; areaStyle?: unknown; stack?: string }[];
      yAxis?: { max?: number }[];
    }>(canvasElement);
    expect(option.series?.every((s) => s.type === "line")).toBe(true);
    expect(option.series?.every((s) => s.areaStyle !== undefined)).toBe(true);
    expect(option.series?.every((s) => s.stack === "total")).toBe(true);
    expect(option.yAxis?.[0]?.max).toBe(1);
  },
};

/** A stack where South has no week-2 row: South draws 0 there, so North
 * keeps its base instead of a hole opening through the layer above. */
export const StackedMissingPoint: Story = {
  args: { stacked: true },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(SPARSE_TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string; data?: unknown[] }[];
    }>(canvasElement);
    const south = option.series?.find((s) => s.name === "South");
    expect(south?.data?.[1]).toEqual([2, 0]);
  },
};

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=South` seeds the filter; the remaining series keeps
 * its area shading. */
export const Filtered: Story = {
  args: { filters: "region" },
  decorators: [withFilteredData([WEEKLY_TREND], TREND_ROWS, "region", "South")],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string; areaStyle?: unknown }[];
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["South"]);
    expect(option.series?.[0]?.areaStyle).toBeDefined();
  },
};
