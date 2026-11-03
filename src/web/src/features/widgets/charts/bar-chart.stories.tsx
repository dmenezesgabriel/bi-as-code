import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  withFilteredData,
  withQueryData,
  withThemeMode,
} from "../../../../.storybook/decorators";
import type { Row } from "../../data/types";
import type { SqlBlock } from "../../pages/types";
import { MultiSelect } from "../inputs/multi-select";
import { Table } from "../table/table";
import { BarChart } from "./bar-chart";
import {
  ORDERS_REGIONAL,
  REGIONAL_ROWS,
  TREND_ROWS,
  WEEKLY_TREND,
  appliedOption,
  brushMarks,
  clickMark,
  crossfilterScene,
  crossfilterTogglePlay,
  dbWith,
  expectAxisNames,
  expectHeading,
  expectHostHeight,
  expectNoLegend,
  expectPaletteColor,
  expectSeriesColor,
  expectSvgHost,
  readyHost,
} from "./series-chart.fixture";
import {
  REGIONAL_CROSSFILTER_DECORATORS,
  expectAlertNaming,
  expectLabelFormatter,
  expectMeasureSeries,
  expectNoRowsFace,
  expectSharesAxis,
  expectSinglePlainSeries,
  expectTotalStack,
  expectUsdAxisTicks,
} from "./series-chart-plays.fixture";
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
  decorators: REGIONAL_CROSSFILTER_DECORATORS,
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
  decorators: REGIONAL_CROSSFILTER_DECORATORS,
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

/** Opens the Region multi-select and picks `regions`; its popup lives in a
 * portal under `document.body`, so the options are found there. */
async function pickRegions(
  canvas: ReturnType<typeof within>,
  regions: readonly string[],
): Promise<void> {
  await userEvent.click(canvas.getByRole("combobox"));
  const popup = within(document.body);
  for (const region of regions)
    await userEvent.click(popup.getByRole("option", { name: region }));
  await userEvent.keyboard("{Escape}");
}

/**
 * A chart and an input on one column share a selection: the multi-select's
 * two picks narrow the table to two rows, then a bar click adds its own
 * pick and the table keeps only the rows that satisfy both — one. The
 * publishing chart draws all three bars throughout.
 */
export const SelectCrossfilterWithInput: Story = {
  args: { select: "crossfilter" },
  decorators: REGIONAL_CROSSFILTER_DECORATORS,
  render: (args) => (
    <>
      <MultiSelect
        id="region"
        data="orders"
        valueColumn="region"
        title="Region"
      />
      <BarChart {...args} />
      <Table data="opts" filters="region" />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const { host, bodyRows } = await crossfilterScene(canvasElement, 3);

    await pickRegions(canvas, ["West", "North"]);
    await waitFor(() => expect(bodyRows()).toBe(2));

    clickMark(host, 1);
    await waitFor(() => expect(bodyRows()).toBe(1));
    expect(canvasElement.querySelector("tbody")?.textContent).toContain(
      "North",
    );
    const option = await appliedOption<{ series?: { data?: unknown[] }[] }>(
      canvasElement,
    );
    expect(option.series?.[0]?.data).toHaveLength(3);
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
  play: ({ canvasElement }) => expectTotalStack(canvasElement, "bar"),
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

const MONTHLY_RAIN: SqlBlock = {
  name: "monthly_rain",
  sql: "select month, precipitation_mm from rain",
};

/** 2015's twelve months, each a `Date` as DuckDB hands a `DATE` cell over. */
const MONTHLY_RAIN_ROWS: Row[] = Array.from({ length: 12 }, (_, month) => ({
  month: new Date(Date.UTC(2015, month, 1)),
  precipitation_mm: 40 + ((month * 37) % 90),
}));

/** The applied x axis' pinned ticks and the labels shown on them. */
interface PinnedAxisProbe {
  xAxis?: {
    axisTick?: { customValues?: number[] };
    axisLabel?: { customValues?: number[] };
  }[];
}

/** A date `x` with few dates pins a tick to each: four quarters read as
 * four labelled bars, not the engine's twelve month ticks. */
export const QuarterlyTimeAxis: Story = {
  args: {
    data: "monthly_rain",
    x: "month",
    y: "precipitation_mm",
    xFmt: "mdy",
  },
  decorators: [
    withQueryData(
      [MONTHLY_RAIN],
      dbWith(MONTHLY_RAIN_ROWS.filter((_, i) => i % 3 === 0)),
    ),
  ],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<PinnedAxisProbe>(canvasElement);
    expect(option.xAxis?.[0]?.axisTick?.customValues).toHaveLength(4);
    expect(option.xAxis?.[0]?.axisLabel?.customValues).toHaveLength(4);
  },
};

/** At phone width twelve `m/d/yyyy` labels cannot all fit: they thin to an
 * even stride, the first and last month kept, every bar still ticked. */
export const MonthlyTimeAxisNarrow: Story = {
  args: { ...QuarterlyTimeAxis.args },
  decorators: [
    withQueryData([MONTHLY_RAIN], dbWith(MONTHLY_RAIN_ROWS)),
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<PinnedAxisProbe>(canvasElement);
    const shown = option.xAxis?.[0]?.axisLabel?.customValues ?? [];
    const ends = [0, 11].map((i) => MONTHLY_RAIN_ROWS[i]?.month);
    expect(option.xAxis?.[0]?.axisTick?.customValues).toHaveLength(12);
    expect(shown.length).toBeLessThan(12);
    expect(shown).toEqual(
      expect.arrayContaining(ends.map((d) => (d as Date).getTime())),
    );
  },
};

const REGIONAL_DATA = [withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS))];
const TREND_DATA = [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))];
const TREND_ARGS = { data: "weekly_trend", x: "week", y: "orders" } as const;

/** `data`, `x` and `y` are all a bar chart needs: one bar per row. */
export const BarsFromQuery: Story = {
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectSinglePlainSeries(canvasElement, 3),
};

/** `y` as a list draws each column as its own bars, named in the legend. */
export const SeveralMeasures: Story = {
  args: { y: ["revenue", "orders"] },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) =>
    expectMeasureSeries(canvasElement, ["revenue", "orders"]),
};

/** `series` splits the bars by a column's values, side by side. */
export const SplitByColumn: Story = {
  args: { ...TREND_ARGS, series: "region" },
  decorators: TREND_DATA,
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string; stack?: string }[];
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["North", "South"]);
    expect(option.series?.every((s) => s.stack === undefined)).toBe(true);
  },
};

/** `stacked="100%"` draws each series as its share: the value axis pins to
 * 0–1 and the labels default to percent. */
export const StackedToPercent: Story = {
  args: { ...TREND_ARGS, series: "region", stacked: "100%" },
  decorators: TREND_DATA,
  play: ({ canvasElement }) => expectSharesAxis(canvasElement),
};

/** `labelsFmt` formats the labels with a format code; the axis keeps `yFmt`. */
export const LabelFormat: Story = {
  args: { y: ["revenue", "orders"], labels: true, labelsFmt: "num1k" },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectLabelFormatter(canvasElement),
};

/** `color` paints every bar one CSS colour. */
export const Color: Story = {
  args: { color: "#0f766e" },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectPaletteColor(canvasElement, "#0f766e"),
};

/** `seriesColors` maps a series name to a colour; unnamed series keep the theme's. */
export const SeriesColors: Story = {
  args: { ...TREND_ARGS, series: "region", seriesColors: { South: "#f97316" } },
  decorators: TREND_DATA,
  play: ({ canvasElement }) =>
    expectSeriesColor(canvasElement, "South", "#f97316", "North"),
};

/** `yFmt` formats the value axis' ticks and the tooltip. */
export const YFormat: Story = {
  args: { yFmt: "usd0" },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectUsdAxisTicks(canvasElement),
};

/** `title` heads the chart and `subtitle` sits under it, above the plot. */
export const TitleAndSubtitle: Story = {
  args: { title: "Revenue by region", subtitle: "US dollars" },
  decorators: REGIONAL_DATA,
  play: ({ canvas }) =>
    expectHeading(canvas, "Revenue by region", "US dollars"),
};

/** `xTitle` and `yTitle` name the axes. */
export const AxisTitles: Story = {
  args: { xTitle: "Region", yTitle: "Revenue" },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) =>
    expectAxisNames(canvasElement, "Region", "Revenue"),
};

/** `legend={false}` hides the legend a multi-series chart shows. */
export const NoLegend: Story = {
  args: { ...TREND_ARGS, series: "region", legend: false },
  decorators: TREND_DATA,
  play: ({ canvasElement }) => expectNoLegend(canvasElement),
};

/** `height` sets the chart's height in pixels. */
export const Height: Story = {
  args: { height: 180 },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectHostHeight(canvasElement, 180),
};

/** `renderer="svg"` draws SVG instead of a canvas. */
export const SvgRenderer: Story = {
  args: { renderer: "svg" },
  decorators: REGIONAL_DATA,
  play: ({ canvasElement }) => expectSvgHost(canvasElement),
};

/** A `data` naming no fence alerts in the chart's place. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: REGIONAL_DATA,
  play: ({ canvas }) => expectAlertNaming(canvas, "ghost"),
};

/** A column the query does not return is named, with the columns it does. */
export const UnknownColumn: Story = {
  args: { x: "typo" },
  decorators: REGIONAL_DATA,
  play: ({ canvas }) => expectAlertNaming(canvas, '"typo"', "region"),
};

/** A format code the column cannot take names itself in the alert. */
export const UnknownFmt: Story = {
  args: { yFmt: "bogus" },
  decorators: REGIONAL_DATA,
  play: ({ canvas }) => expectAlertNaming(canvas, 'fmt="bogus"'),
};

/** A query that returns no rows shows "0 rows" at the chart's height. */
export const NoRows: Story = {
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith([]))],
  play: ({ canvas }) => expectNoRowsFace(canvas),
};
