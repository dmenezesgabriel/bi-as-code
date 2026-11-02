import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  withFilteredData,
  withQueryData,
} from "../../../../.storybook/decorators";
import { Table } from "../table/table";
import { LineChart } from "./line-chart";
import {
  ORDERS_REGIONAL,
  REGIONAL_ROWS,
  TREND_ROWS,
  WEEKLY_TREND,
  appliedOption,
  crossfilterTogglePlay,
  dbWith,
  expectAxisNames,
  expectHeading,
  expectHostHeight,
  expectNoLegend,
  expectPaletteColor,
  expectSeriesColor,
  expectSvgHost,
} from "./series-chart.fixture";
import {
  type FormatterProbe,
  REGIONAL_CROSSFILTER_DECORATORS,
  expectAlertNaming,
  expectLabelFormatter,
  expectLabelsShown,
  expectMeasureSeries,
  expectNoRowsFace,
  expectSharesAxis,
  expectSinglePlainSeries,
  expectTotalStack,
  expectUsdAxisTicks,
} from "./series-chart-plays.fixture";
import type { SeriesChartProps } from "./types";

const meta = {
  title: "Widgets/Charts/LineChart",
  component: LineChart,
  args: { data: "weekly_trend", x: "week", y: "orders" },
} satisfies Meta<SeriesChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo shape: a line per region over weeks — numeric x on a
 * continuous axis, legend on with more than one series. */
export const MultiSeries: Story = {
  args: { series: "region" },
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
  args: { series: "region" },
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
  args: { series: "region", filters: "region" },
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

const REGIONAL_DATA = [withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS))];
const TREND_DATA = [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))];
const REGIONAL_ARGS = { data: "orders", x: "region", y: "revenue" } as const;
const SPLIT_ARGS = { series: "region" } as const;

/** `data`, `x` and `y` are all a line chart needs: one point per row. */
export const LineFromQuery: Story = {
  args: REGIONAL_ARGS,
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectSinglePlainSeries(canvasElement, 3),
};

/** `y` as a list draws each column as its own line, named in the legend. */
export const SeveralMeasures: Story = {
  args: { ...REGIONAL_ARGS, y: ["revenue", "orders"] },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) =>
    expectMeasureSeries(canvasElement, ["revenue", "orders"]),
};

/** `stacked` piles every line on one stack, so the top line reads the total. */
export const Stacked: Story = {
  args: { ...SPLIT_ARGS, stacked: true },
  decorators: TREND_DATA,
  play: ({ canvasElement }) => expectTotalStack(canvasElement, "line"),
};

/** `stacked="100%"` draws each series as its share: the value axis pins to
 * 0–1. */
export const StackedToPercent: Story = {
  args: { ...SPLIT_ARGS, stacked: "100%" },
  decorators: TREND_DATA,
  play: ({ canvasElement }) => expectSharesAxis(canvasElement),
};

/** `labels` prints each point's value above it. */
export const Labeled: Story = {
  args: { ...REGIONAL_ARGS, labels: true },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectLabelsShown(canvasElement),
};

/** `labelsFmt` formats the labels with a format code; the axis keeps `yFmt`. */
export const LabelFormat: Story = {
  args: { ...REGIONAL_ARGS, labels: true, labelsFmt: "num1k" },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectLabelFormatter(canvasElement),
};

/** `color` draws every line in one CSS colour. */
export const Color: Story = {
  args: { ...REGIONAL_ARGS, color: "#0f766e" },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectPaletteColor(canvasElement, "#0f766e"),
};

/** `seriesColors` maps a series name to a colour; unnamed series keep the theme's. */
export const SeriesColors: Story = {
  args: { ...SPLIT_ARGS, seriesColors: { South: "#f97316" } },
  decorators: TREND_DATA,
  play: ({ canvasElement }) =>
    expectSeriesColor(canvasElement, "South", "#f97316", "North"),
};

/** `xFmt="id"` prints a numeric x whole: the number axis would group 1234 as 1,234. */
export const XFormat: Story = {
  args: { ...SPLIT_ARGS, xFmt: "id" },
  decorators: TREND_DATA,
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      xAxis?: { axisLabel?: FormatterProbe }[];
    }>(canvasElement);
    expect(option.xAxis?.[0]?.axisLabel?.formatter?.(1234)).toBe("1234");
  },
};

/** `yFmt` formats the value axis' ticks and the tooltip. */
export const YFormat: Story = {
  args: { ...REGIONAL_ARGS, yFmt: "usd0" },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectUsdAxisTicks(canvasElement),
};

/** `title` heads the chart and `subtitle` sits under it, above the plot. */
export const TitleAndSubtitle: Story = {
  args: {
    ...REGIONAL_ARGS,
    title: "Revenue by region",
    subtitle: "US dollars",
  },
  decorators: REGIONAL_DATA,
  play: ({ canvas }) =>
    expectHeading(canvas, "Revenue by region", "US dollars"),
};

/** `xTitle` and `yTitle` name the axes. */
export const AxisTitles: Story = {
  args: { ...REGIONAL_ARGS, xTitle: "Region", yTitle: "Revenue" },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) =>
    expectAxisNames(canvasElement, "Region", "Revenue"),
};

/** `legend={false}` hides the legend a multi-series chart shows. */
export const NoLegend: Story = {
  args: { ...SPLIT_ARGS, legend: false },
  decorators: TREND_DATA,
  play: ({ canvasElement }) => expectNoLegend(canvasElement),
};

/** `height` sets the chart's height in pixels. */
export const Height: Story = {
  args: { ...REGIONAL_ARGS, height: 180 },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectHostHeight(canvasElement, 180),
};

/** `renderer="svg"` draws SVG instead of a canvas. */
export const SvgRenderer: Story = {
  args: { ...REGIONAL_ARGS, renderer: "svg" },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectSvgHost(canvasElement),
};

/** `select="crossfilter"`: clicking a point filters the `opts` consumer to
 * that point's region; clicking it again clears. */
export const SelectCrossfilter: Story = {
  args: { ...REGIONAL_ARGS, filters: "region", select: "crossfilter" },
  decorators: REGIONAL_CROSSFILTER_DECORATORS,
  render: (args) => (
    <>
      <LineChart {...args} />
      <Table data="opts" filters="region" />
    </>
  ),
  play: crossfilterTogglePlay(3, 3, ["West", "North"]),
};

/** A `data` naming no fence alerts in the chart's place. */
export const UnknownName: Story = {
  args: { ...REGIONAL_ARGS, data: "ghost" },
  decorators: REGIONAL_DATA,
  play: ({ canvas }) => expectAlertNaming(canvas, "ghost"),
};

/** A column the query does not return is named, with the columns it does. */
export const UnknownColumn: Story = {
  args: { ...REGIONAL_ARGS, x: "typo" },
  decorators: REGIONAL_DATA,
  play: ({ canvas }) => expectAlertNaming(canvas, '"typo"', "region"),
};

/** A format code the column cannot take names itself in the alert. */
export const UnknownFmt: Story = {
  args: { ...REGIONAL_ARGS, yFmt: "bogus" },
  decorators: REGIONAL_DATA,
  play: ({ canvas }) => expectAlertNaming(canvas, 'fmt="bogus"'),
};

/** A query that returns no rows shows "0 rows" at the chart's height. */
export const NoRows: Story = {
  args: REGIONAL_ARGS,
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith([]))],
  play: ({ canvas }) => expectNoRowsFace(canvas),
};
