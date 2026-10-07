import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  withFilteredData,
  withQueryData,
} from "../../../../.storybook/decorators";
import { ScatterChart } from "./scatter-chart";
import {
  ORDERS_REGIONAL,
  SCATTER_ROWS,
  appliedOption,
  dbWith,
  readyHost,
} from "./series-chart.fixture";
import type { ScatterChartProps } from "./types";

const meta = {
  title: "Widgets/Charts/ScatterChart",
  component: ScatterChart,
  args: { data: "orders", x: "orders", y: "revenue" },
} satisfies Meta<ScatterChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One series of order-vs-revenue points on a continuous x-axis. */
export const SingleSeries: Story = {
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith(SCATTER_ROWS))],
  play: async ({ canvasElement }) => {
    const host = await readyHost(canvasElement);
    expect(host.querySelector("canvas")).not.toBeNull();
    expect(host).toHaveAttribute(
      "aria-label",
      "scatter chart of revenue by orders",
    );
    const option = await appliedOption<{
      series?: { type?: string; data?: unknown[]; symbolSize?: unknown }[];
      xAxis?: { type?: string }[];
    }>(canvasElement);
    expect(option.series?.[0]?.type).toBe("scatter");
    expect(option.series?.[0]?.data).toEqual([
      [120, 4800],
      [140, 5300],
      [90, 3700],
      [95, 3900],
    ]);
    expect(option.xAxis?.[0]?.type).toBe("value");
  },
};

/** `series` splits by region and `size` scales each point to a bubble. */
export const SizedByRegion: Story = {
  args: { series: "region", size: "accounts" },
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith(SCATTER_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string; type?: string; symbolSize?: unknown }[];
      legend?: unknown;
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["North", "South"]);
    expect(option.series?.every((s) => s.type === "scatter")).toBe(true);
    expect(
      option.series?.every((s) => typeof s.symbolSize === "function"),
    ).toBe(true);
    expect(option.legend).toBeDefined();
  },
};

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=North` seeds the filter, one series remains. */
export const Filtered: Story = {
  args: { series: "region", filters: "region" },
  decorators: [
    withFilteredData([ORDERS_REGIONAL], SCATTER_ROWS, "region", "North"),
  ],
  play: async ({ canvasElement }) => {
    await readyHost(canvasElement);
    const option = await appliedOption<{
      series?: { name?: string; data?: unknown[] }[];
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["North"]);
    expect(option.series?.[0]?.data).toHaveLength(2);
  },
};
