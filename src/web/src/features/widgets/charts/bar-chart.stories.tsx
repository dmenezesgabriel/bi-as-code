import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { withQueryData } from "../../../../.storybook/decorators";
import { BarChart } from "./bar-chart";
import {
  ORDERS_REGIONAL,
  REGIONAL_ROWS,
  TREND_ROWS,
  WEEKLY_TREND,
  appliedOption,
  dbWith,
  readyHost,
} from "./series-chart.fixture";
import type { SeriesChartProps } from "./types";

const meta = {
  title: "Widgets/Charts/BarChart",
  component: BarChart,
  args: { data: "orders", x: "region", y: "revenue" },
} satisfies Meta<SeriesChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo shape: three labeled bars of revenue by region. */
export const Labeled: Story = {
  args: { labels: true },
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS))],
  play: async ({ canvasElement }) => {
    const host = await readyHost(canvasElement);
    expect(host.querySelector("canvas")).not.toBeNull();
    expect(host).toHaveAttribute(
      "aria-label",
      "bar chart of revenue by region",
    );
    const option = await appliedOption<{ series?: { type?: string }[] }>(
      canvasElement,
    );
    expect(option.series?.[0]?.type).toBe("bar");
  },
};

/** `series` + `stacked` piles each week's regions into one column. */
export const Stacked: Story = {
  args: {
    data: "weekly_trend",
    x: "week",
    y: "orders",
    series: "region",
    stacked: true,
  },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { type?: string; stack?: string }[];
    }>(canvasElement);
    expect(option.series?.every((s) => s.type === "bar")).toBe(true);
    expect(option.series?.every((s) => s.stack === "total")).toBe(true);
  },
};
