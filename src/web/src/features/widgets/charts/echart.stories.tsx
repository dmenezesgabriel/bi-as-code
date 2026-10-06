import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { withThemeMode } from "../../../../.storybook/decorators";
import { EChart } from "./echart";
import type { EChartProps } from "./types";

const BAR_OPTION: EChartProps["option"] = {
  aria: { enabled: true, label: { description: "Revenue by region" } },
  xAxis: { type: "category", data: ["North", "South", "West"] },
  yAxis: {},
  series: [{ type: "bar", data: [4800, 3700, 6100] }],
};

const LINE_OPTION: EChartProps["option"] = {
  legend: {},
  tooltip: { trigger: "axis" },
  xAxis: {
    type: "category",
    data: Array.from({ length: 13 }, (_, i) => i + 1),
  },
  yAxis: {},
  series: ["North", "South", "West"].map((region, r) => ({
    name: region,
    type: "line" as const,
    data: Array.from(
      { length: 13 },
      (_, i) => 20 + r * 8 + ((i * 7 + r * 3) % 11),
    ),
  })),
};

const meta = {
  title: "Widgets/Charts/EChart",
  component: EChart,
  args: { option: BAR_OPTION },
} satisfies Meta<EChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The engine wrapper paints a canvas, exposes `echartsInstance`, and marks
 * itself ready once the first finished render lands. */
export const Canvas: Story = {
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector("[data-echarts-theme]");
    await waitFor(() => expect(host).toHaveAttribute("data-echarts-ready", ""));
    expect(host?.querySelector("canvas")).not.toBeNull();
    expect(host).toHaveAttribute("aria-label", "Revenue by region");
  },
};

/** Multi-series options render a legend through the same wrapper. */
export const MultiSeriesLine: Story = {
  args: { option: LINE_OPTION },
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector("[data-echarts-theme]");
    await waitFor(() => expect(host).toHaveAttribute("data-echarts-ready", ""));
  },
};

/** `useThemeMode` picks the registered dark theme — canvas can't see
 * `.dark` CSS, so the mode arrives as a value. */
export const Dark: Story = {
  decorators: [withThemeMode("dark")],
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector("[data-echarts-theme]");
    await waitFor(() =>
      expect(host).toHaveAttribute("data-echarts-theme", "dark"),
    );
    await waitFor(() => expect(host).toHaveAttribute("data-echarts-ready", ""));
  },
};

/** `renderer="svg"` is the jsdom/seam path — same option, DOM output. */
export const SvgRenderer: Story = {
  args: { renderer: "svg" },
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector("[data-echarts-theme]");
    await waitFor(() => expect(host?.querySelector("svg")).not.toBeNull());
  },
};
