import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  withFilteredData,
  withPageFilters,
  withQueryData,
  withThemeMode,
} from "../../../../.storybook/decorators";
import { Table } from "../table/table";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { BarChart } from "./bar-chart";
import {
  OPTS,
  ORDERS_REGIONAL,
  REGIONAL_ROWS,
  TREND_ROWS,
  WEEKLY_TREND,
  appliedOption,
  brushMarks,
  crossfilterScene,
  crossfilterTogglePlay,
  dbSelectable,
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

/** The applied value axis' readout switches, as echarts merges them. */
interface ValueAxisProbe {
  axisLabel?: { show?: boolean };
  splitLine?: { show?: boolean };
}

/** The demo shape: three labeled bars of revenue by region. The labels
 * replace the value axis — no y ticks, no gridlines — and keep a decimal in
 * their unit (`3.7k`). */
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
    const option = await appliedOption<{
      series?: { type?: string }[];
      yAxis?: ValueAxisProbe[];
    }>(canvasElement);
    expect(option.series?.[0]?.type).toBe("bar");
    expect(option.yAxis?.[0]?.axisLabel?.show).toBe(false);
    expect(option.yAxis?.[0]?.splitLine?.show).toBe(false);
  },
};

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=West` seeds the filter, one bar remains. */
export const Filtered: Story = {
  args: { filters: "region" },
  decorators: [
    withFilteredData([ORDERS_REGIONAL], REGIONAL_ROWS, "region", "West"),
  ],
  play: async ({ canvasElement }) => {
    await readyHost(canvasElement);
    const option = await appliedOption<{ series?: { data?: unknown[] }[] }>(
      canvasElement,
    );
    await expect(option.series?.[0]?.data).toHaveLength(1);
  },
};

/**
 * `select="crossfilter"`: a mark click publishes a `region = ?` clause —
 * the consumer table re-queries while the publishing chart's own clause
 * skips it (all three bars hold), and clicking the same bar again clears.
 */
export const SelectCrossfilter: Story = {
  args: { filters: "region", select: "crossfilter" },
  decorators: [
    withQueryData(
      [ORDERS_REGIONAL, OPTS],
      dbSelectable("region", REGIONAL_ROWS),
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  render: (args) => (
    <>
      <BarChart {...args} />
      <Table data="opts" filters="region" />
    </>
  ),
  play: crossfilterTogglePlay(3, 3, ["West", "North"]),
};

/**
 * `select="crossfilter"`: a brush across bars publishes the covered
 * categories as a list clause — the Region-rect semantic on a category
 * axis. The consumer narrows to the covered regions while the bar chart
 * keeps all three bars; a brush with no areas clears.
 */
export const SelectCrossfilterBrush: Story = {
  args: { filters: "region", select: "crossfilter" },
  decorators: [
    withQueryData(
      [ORDERS_REGIONAL, OPTS],
      dbSelectable("region", REGIONAL_ROWS),
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  render: (args) => (
    <>
      <BarChart {...args} />
      <Table data="opts" filters="region" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const { host, bodyRows } = await crossfilterScene(canvasElement, 3);

    brushMarks(host, [0, 1]);
    await waitFor(() => expect(bodyRows()).toBe(2));
    expect(canvasElement.querySelector("tbody")?.textContent).toContain(
      "North",
    );
    const option = await appliedOption<{ series?: { data?: unknown[] }[] }>(
      canvasElement,
    );
    expect(option.series?.[0]?.data).toHaveLength(3);

    brushMarks(host, undefined);
    await waitFor(() => expect(bodyRows()).toBe(3));
  },
};

/** In dark mode the labels above the bars take the theme's muted text
 * color — a light glyph on the dark surface, with no outline. */
export const LabeledDark: Story = {
  args: { labels: true },
  decorators: [
    withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS)),
    withThemeMode("dark"),
  ],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { label?: { color?: string; textBorderWidth?: number } }[];
    }>(canvasElement);
    expect(option.series?.[0]?.label?.color).toBe("#a1a1a1");
    expect(option.series?.[0]?.label?.textBorderWidth).toBeUndefined();
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

/** A stacked bar's labels sit inside their segments, so they stay white on
 * the series fill rather than taking the theme's page-contrast color. */
export const StackedLabeled: Story = {
  args: { ...Stacked.args, labels: true },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { label?: { position?: string; color?: string } }[];
      yAxis?: ValueAxisProbe[];
    }>(canvasElement);
    // Segment labels don't give the stack totals, so the axis stays.
    expect(option.yAxis?.[0]?.axisLabel?.show).toBe(true);
    expect(option.yAxis?.[0]?.splitLine?.show).toBe(true);
    expect(option.series?.every((s) => s.label?.position === "inside")).toBe(
      true,
    );
    expect(option.series?.every((s) => s.label?.color === "#ffffff")).toBe(
      true,
    );
  },
};
