import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { withQueryData } from "../../../../.storybook/decorators";
import { Histogram } from "./histogram-chart";
import {
  AMOUNT_ROWS,
  ORDER_AMOUNTS,
  appliedOption,
  dbWith,
  readyHost,
} from "./series-chart.fixture";
import type { HistogramChartProps } from "./types";

const meta = {
  title: "Widgets/Charts/Histogram",
  component: Histogram,
  args: { data: "order_amounts", value: "amount" },
} satisfies Meta<HistogramChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 24 orders binned by the rice-rule default — ceil(2·24^⅓) = 6 bars. */
export const RiceRuleDefault: Story = {
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const host = await readyHost(canvasElement);
    expect(host.querySelector("canvas")).not.toBeNull();
    expect(host).toHaveAttribute("aria-label", "histogram chart of amount");
    const option = await appliedOption<{
      series?: { type?: string; stack?: string; data?: unknown[] }[];
      xAxis?: { type?: string; data?: unknown[]; boundaryGap?: boolean }[];
    }>(canvasElement);
    expect(option.series?.[0]?.type).toBe("bar");
    expect(option.series?.[0]?.stack).toBe("total");
    expect(option.series?.[0]?.data).toHaveLength(6);
    expect(option.xAxis?.[0]?.type).toBe("category");
    expect(option.xAxis?.[0]?.data).toHaveLength(6);
    expect(option.xAxis?.[0]?.boundaryGap).toBe(false);
  },
};

/** `series` splits each bin into a stacked segment per region. */
export const StackedByRegion: Story = {
  args: { series: "region" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string; stack?: string }[];
      legend?: unknown;
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["North", "South"]);
    expect(option.series?.every((s) => s.stack === "total")).toBe(true);
    expect(option.legend).toBeDefined();
  },
};

/** `binCount` pins the bin count — the category axis carries that many labels. */
export const ExplicitBinCount: Story = {
  args: { binCount: 10, valueFmt: "usd0" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      xAxis?: { data?: unknown[] }[];
      series?: { data?: unknown[] }[];
    }>(canvasElement);
    expect(option.xAxis?.[0]?.data).toHaveLength(10);
    expect(option.xAxis?.[0]?.data?.[0]).toBe("$12");
    const counts = option.series?.[0]?.data as number[];
    expect(counts.reduce((a, b) => a + b, 0)).toBe(AMOUNT_ROWS.length);
  },
};
