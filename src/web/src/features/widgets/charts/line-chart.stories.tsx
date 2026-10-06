import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { withQueryData } from "../../../../.storybook/decorators";
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
