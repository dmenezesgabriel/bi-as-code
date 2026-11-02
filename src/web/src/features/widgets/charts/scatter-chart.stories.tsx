import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  withFilteredData,
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { Table } from "../table/table";
import { ScatterChart } from "./scatter-chart";
import {
  OPTS,
  OPTS_BY_ORDERS,
  ORDERS_REGIONAL,
  SCATTER_ROWS,
  appliedOption,
  crossfilterScene,
  crossfilterTogglePlay,
  dbSelectable,
  dbWith,
  expectAxisNames,
  expectHeading,
  expectHostHeight,
  expectNoLegend,
  expectPaletteColor,
  expectSeriesColor,
  expectSvgHost,
  legendToggle,
  readyHost,
  tooltipFormatter,
} from "./series-chart.fixture";
import {
  NO_ROWS_DATA,
  expectAlertNaming,
  expectLabelFormatter,
  expectLabelsShown,
  expectMeasureSeries,
  expectNoRowsFace,
  expectUsdAxisTicks,
  expectWholeNumberXAxis,
} from "./series-chart-plays.fixture";
import type { ScatterChartProps } from "./types";

const meta = {
  title: "Widgets/Charts/ScatterChart",
  component: ScatterChart,
  args: { data: "orders", x: "orders", y: "revenue" },
} satisfies Meta<ScatterChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

const SCATTER_DATA = [withQueryData([ORDERS_REGIONAL], dbWith(SCATTER_ROWS))];

/** One series of order-vs-revenue points on a continuous x-axis. */
export const SingleSeries: Story = {
  decorators: SCATTER_DATA,
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

/** `y` as a list draws each column as its own series against the same `x`. */
export const SeveralMeasures: Story = {
  args: { y: ["revenue", "accounts"] },
  decorators: SCATTER_DATA,
  play: ({ canvasElement }) =>
    expectMeasureSeries(canvasElement, ["revenue", "accounts"]),
};

/** `series` splits the points by region, one colour and a legend entry each. */
export const SplitBySeries: Story = {
  args: { series: "region" },
  decorators: SCATTER_DATA,
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string; symbolSize?: unknown }[];
      legend?: unknown[];
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["North", "South"]);
    expect(option.series?.every((s) => typeof s.symbolSize === "number")).toBe(
      true,
    );
    expect(option.legend?.length).toBeGreaterThan(0);
  },
};

/** `sizeFmt` formats the `size` row of the tooltip with a format code. */
export const SizeFormat: Story = {
  args: { size: "accounts", sizeFmt: "usd0" },
  decorators: SCATTER_DATA,
  play: async ({ canvasElement }) => {
    // getOption() wraps each component in an array; the helper reads one.
    const option = await appliedOption<{ tooltip?: unknown[] }>(canvasElement);
    const html = tooltipFormatter({ tooltip: option.tooltip?.[0] })({
      seriesName: "revenue",
      value: [120, 4800, 14],
    });
    expect(html).toContain("accounts: $14");
  },
};

/** `labels` prints each point's `y` value beside it. */
export const Labeled: Story = {
  args: { labels: true },
  decorators: SCATTER_DATA,
  play: ({ canvasElement }) => expectLabelsShown(canvasElement),
};

/** `labelsFmt` formats the labels with a format code; the axis keeps `yFmt`. */
export const LabelFormat: Story = {
  args: { labels: true, labelsFmt: "num1k" },
  decorators: SCATTER_DATA,
  play: ({ canvasElement }) => expectLabelFormatter(canvasElement),
};

/** `color` draws every point in one CSS colour. */
export const Color: Story = {
  args: { color: "#0f766e" },
  decorators: SCATTER_DATA,
  play: ({ canvasElement }) => expectPaletteColor(canvasElement, "#0f766e"),
};

/** `seriesColors` maps a series name to a colour; unnamed series keep the theme's. */
export const SeriesColors: Story = {
  args: { series: "region", seriesColors: { South: "#f97316" } },
  decorators: SCATTER_DATA,
  play: ({ canvasElement }) =>
    expectSeriesColor(canvasElement, "South", "#f97316", "North"),
};

/** `xFmt="id"` prints the numeric x whole: the number axis would group 1234 as 1,234. */
export const XFormat: Story = {
  args: { xFmt: "id" },
  decorators: SCATTER_DATA,
  play: ({ canvasElement }) => expectWholeNumberXAxis(canvasElement),
};

/** `yFmt` formats the value axis' ticks and the tooltip. */
export const YFormat: Story = {
  args: { yFmt: "usd0" },
  decorators: SCATTER_DATA,
  play: ({ canvasElement }) => expectUsdAxisTicks(canvasElement),
};

/** `title` heads the chart and `subtitle` sits under it, above the plot. */
export const TitleAndSubtitle: Story = {
  args: { title: "Revenue by orders", subtitle: "US dollars" },
  decorators: SCATTER_DATA,
  play: ({ canvas }) =>
    expectHeading(canvas, "Revenue by orders", "US dollars"),
};

/** `legend={false}` hides the legend a multi-series chart shows. */
export const NoLegend: Story = {
  args: { series: "region", legend: false },
  decorators: SCATTER_DATA,
  play: ({ canvasElement }) => expectNoLegend(canvasElement),
};

/** `height` sets the chart's height in pixels. */
export const Height: Story = {
  args: { height: 180 },
  decorators: SCATTER_DATA,
  play: ({ canvasElement }) => expectHostHeight(canvasElement, 180),
};

/** `renderer="svg"` draws SVG instead of a canvas. */
export const SvgRenderer: Story = {
  args: { renderer: "svg" },
  decorators: SCATTER_DATA,
  play: ({ canvasElement }) => expectSvgHost(canvasElement),
};

/** `series` splits by region and `size` scales each point to a bubble. */
export const SizedByRegion: Story = {
  args: { series: "region", size: "accounts" },
  decorators: SCATTER_DATA,
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

/** `xTitle`/`yTitle` name both axes; the grid shrinks so the y title clears
 * the legend and the x title stays inside the canvas. */
export const AxisTitles: Story = {
  args: { series: "region", xTitle: "Orders", yTitle: "Revenue" },
  decorators: SCATTER_DATA,
  play: async ({ canvasElement }) => {
    await expectAxisNames(canvasElement, "Orders", "Revenue");
    const option = await appliedOption<{
      grid?: { outerBoundsContain?: string }[];
    }>(canvasElement);
    expect(option.grid?.[0]?.outerBoundsContain).toBe("all");
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

/**
 * `select="crossfilter"` on a value-axis chart: a point click publishes
 * `orders = ?` with the datum's numeric x — the consumer narrows, the
 * publishing scatter keeps all four points, click-same clears.
 */
export const SelectCrossfilter: Story = {
  args: { filters: "orders", select: "crossfilter" },
  decorators: [
    withQueryData(
      [ORDERS_REGIONAL, OPTS],
      dbSelectable("orders", SCATTER_ROWS, OPTS_BY_ORDERS),
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  render: (args) => (
    <>
      <ScatterChart {...args} />
      <Table data="opts" filters="orders" />
    </>
  ),
  play: crossfilterTogglePlay(4, 4, ["120", "140"]),
};

/**
 * `select="crossfilter"` + `series="region"`: toggling a legend item
 * publishes the enabled set as `region IN (…)` — the consumer narrows,
 * the publishing scatter keeps both series (its own clause skips it) and
 * the legend's native hide/show is the local de-emphasis. Toggling the
 * item back on clears the clause.
 */
export const SelectCrossfilterLegend: Story = {
  args: { series: "region", filters: "region", select: "crossfilter" },
  decorators: [
    withQueryData(
      [ORDERS_REGIONAL, OPTS],
      dbSelectable("region", SCATTER_ROWS),
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  render: (args) => (
    <>
      <ScatterChart {...args} />
      <Table data="opts" filters="region" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const { host, bodyRows } = await crossfilterScene(canvasElement, 3);

    // North off → `region IN (South)`: the consumer keeps the South row
    // while the publisher's own clause skips it — both series and the
    // disabled legend entry stay in its option.
    legendToggle(host, "North");
    await waitFor(() => expect(bodyRows()).toBe(1));
    const option = await appliedOption<{
      series?: { name?: string }[];
      legend?: { selected?: Record<string, boolean> }[];
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["North", "South"]);
    expect(option.legend?.[0]?.selected?.North).toBe(false);

    legendToggle(host, "North");
    await waitFor(() => expect(bodyRows()).toBe(3));
    const restored = await appliedOption<{
      legend?: { selected?: Record<string, boolean> }[];
    }>(canvasElement);
    expect(restored.legend?.[0]?.selected?.North).toBe(true);
  },
};

/** A `data` naming no fence alerts in the chart's place. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: SCATTER_DATA,
  play: ({ canvas }) => expectAlertNaming(canvas, "ghost"),
};

/** A column the query does not return is named, with the columns it does. */
export const UnknownColumn: Story = {
  args: { x: "typo" },
  decorators: SCATTER_DATA,
  play: ({ canvas }) => expectAlertNaming(canvas, '"typo"', "region"),
};

/** A format code the column cannot take names itself in the alert. */
export const UnknownFmt: Story = {
  args: { yFmt: "bogus" },
  decorators: SCATTER_DATA,
  play: ({ canvas }) => expectAlertNaming(canvas, 'fmt="bogus"'),
};

/** A query that returns no rows shows "0 rows" at the chart's height. */
export const NoRows: Story = {
  decorators: NO_ROWS_DATA,
  play: ({ canvas }) => expectNoRowsFace(canvas),
};
