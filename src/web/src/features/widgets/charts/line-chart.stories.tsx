import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  withFilteredData,
  withQueryData,
} from "../../../../.storybook/decorators";
import { LineChart } from "./line-chart";
import {
  TREND_ROWS,
  WEEKLY_TREND,
  appliedOption,
  dbWith,
} from "./series-chart.fixture";
import type { SeriesChartProps } from "./types";

const meta = {
  title: "Widgets/Charts/LineChart",
  component: LineChart,
  args: { data: "weekly_trend", x: "week", y: "orders", series: "region" },
} satisfies Meta<SeriesChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo shape: a line per region over weeks — numeric x on a
 * continuous axis, legend on with more than one series. */
export const MultiSeries: Story = {
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string; type?: string }[];
      legend?: unknown[];
    }>(canvasElement);
    expect(option.series?.every((s) => s.type === "line")).toBe(true);
    expect(option.series?.map((s) => s.name)).toEqual(["North", "South"]);
    expect(option.legend?.length).toBeGreaterThan(0);
  },
};

/** A DATE x arrives as UTC-midnight `Date`s: the axis turns `time` and
 * ticks on the UTC clock, so a week starts on its own day for every
 * viewer. */
export const DateAxis: Story = {
  decorators: [
    withQueryData(
      [WEEKLY_TREND],
      dbWith(
        [5, 12, 19].flatMap((day, i) => [
          {
            week: new Date(Date.UTC(2026, 0, day)),
            region: "North",
            orders: 40 + i,
          },
          {
            week: new Date(Date.UTC(2026, 0, day)),
            region: "South",
            orders: 30 + i,
          },
        ]),
      ),
    ),
  ],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      useUTC?: boolean;
      xAxis?: { type?: string }[];
    }>(canvasElement);
    expect(option.xAxis?.[0]?.type).toBe("time");
    expect(option.useUTC).toBe(true);
  },
};

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=North` seeds the filter; a single series also means
 * the legend drops. */
export const Filtered: Story = {
  args: { filters: "region" },
  decorators: [withFilteredData([WEEKLY_TREND], TREND_ROWS, "region", "North")],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string }[];
      legend?: unknown[];
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["North"]);
    expect(option.legend ?? []).toHaveLength(0);
  },
};
