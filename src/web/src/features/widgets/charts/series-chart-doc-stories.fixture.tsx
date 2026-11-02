import type { StoryObj } from "@storybook/react-vite";
import { withQueryData } from "../../../../.storybook/decorators";
import { Table } from "../table/table";
import {
  ORDERS_REGIONAL,
  REGIONAL_ROWS,
  TREND_ROWS,
  WEEKLY_TREND,
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
  expectWholeNumberXAxis,
} from "./series-chart-plays.fixture";
import type { SeriesChartProps } from "./types";

type DocStory = StoryObj<SeriesChartProps>;

export const REGIONAL_DATA = [
  withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS)),
];
export const TREND_DATA = [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))];
export const REGIONAL_ARGS = {
  data: "orders",
  x: "region",
  y: "revenue",
} as const;
/** The demo shape: a series per region over weeks — numeric x on a
 * continuous axis, legend on with more than one series. */
export const SPLIT_ARGS = { series: "region" } as const;

/**
 * The reference-page examples every cartesian series chart (Line, Area)
 * documents the same way. The stories name no component: each chart's
 * `*.stories.tsx` re-exports the ones it documents under `meta.component`.
 *
 * @example
 * export const Color = SERIES_DOC_STORIES.Color;
 */
export const SERIES_DOC_STORIES = {
  /** `data`, `x` and `y` are all a series chart needs: one point per row. */
  FromQuery: {
    args: REGIONAL_ARGS,
    decorators: REGIONAL_DATA,
    play: ({ canvasElement }) => expectSinglePlainSeries(canvasElement, 3),
  },
  /** `y` as a list draws each column as its own series, named in the legend. */
  SeveralMeasures: {
    args: { ...REGIONAL_ARGS, y: ["revenue", "orders"] },
    decorators: REGIONAL_DATA,
    play: ({ canvasElement }) =>
      expectMeasureSeries(canvasElement, ["revenue", "orders"]),
  },
  /** `stacked` piles every series on one stack, so the top reads the total. */
  Stacked: {
    args: { ...SPLIT_ARGS, stacked: true },
    decorators: TREND_DATA,
    play: ({ canvasElement }) => expectTotalStack(canvasElement, "line"),
  },
  /** `stacked="100%"` draws each series as its share: the value axis pins to
   * 0–1. */
  StackedToPercent: {
    args: { ...SPLIT_ARGS, stacked: "100%" },
    decorators: TREND_DATA,
    play: ({ canvasElement }) => expectSharesAxis(canvasElement),
  },
  /** `labels` prints each point's value above it. */
  Labeled: {
    args: { ...REGIONAL_ARGS, labels: true },
    decorators: REGIONAL_DATA,
    play: ({ canvasElement }) => expectLabelsShown(canvasElement),
  },
  /** `labelsFmt` formats the labels with a format code; the axis keeps `yFmt`. */
  LabelFormat: {
    args: { ...REGIONAL_ARGS, labels: true, labelsFmt: "num1k" },
    decorators: REGIONAL_DATA,
    play: ({ canvasElement }) => expectLabelFormatter(canvasElement),
  },
  /** `color` draws every series in one CSS colour. */
  Color: {
    args: { ...REGIONAL_ARGS, color: "#0f766e" },
    decorators: REGIONAL_DATA,
    play: ({ canvasElement }) => expectPaletteColor(canvasElement, "#0f766e"),
  },
  /** `seriesColors` maps a series name to a colour; unnamed series keep the theme's. */
  SeriesColors: {
    args: { ...SPLIT_ARGS, seriesColors: { South: "#f97316" } },
    decorators: TREND_DATA,
    play: ({ canvasElement }) =>
      expectSeriesColor(canvasElement, "South", "#f97316", "North"),
  },
  /** `xFmt="id"` prints a numeric x whole: the number axis would group 1234 as 1,234. */
  XFormat: {
    args: { ...SPLIT_ARGS, xFmt: "id" },
    decorators: TREND_DATA,
    play: ({ canvasElement }) => expectWholeNumberXAxis(canvasElement),
  },
  /** `yFmt` formats the value axis' ticks and the tooltip. */
  YFormat: {
    args: { ...REGIONAL_ARGS, yFmt: "usd0" },
    decorators: REGIONAL_DATA,
    play: ({ canvasElement }) => expectUsdAxisTicks(canvasElement),
  },
  /** `title` heads the chart and `subtitle` sits under it, above the plot. */
  TitleAndSubtitle: {
    args: {
      ...REGIONAL_ARGS,
      title: "Revenue by region",
      subtitle: "US dollars",
    },
    decorators: REGIONAL_DATA,
    play: ({ canvas }) =>
      expectHeading(canvas, "Revenue by region", "US dollars"),
  },
  /** `xTitle` and `yTitle` name the axes. */
  AxisTitles: {
    args: { ...REGIONAL_ARGS, xTitle: "Region", yTitle: "Revenue" },
    decorators: REGIONAL_DATA,
    play: ({ canvasElement }) =>
      expectAxisNames(canvasElement, "Region", "Revenue"),
  },
  /** `legend={false}` hides the legend a multi-series chart shows. */
  NoLegend: {
    args: { ...SPLIT_ARGS, legend: false },
    decorators: TREND_DATA,
    play: ({ canvasElement }) => expectNoLegend(canvasElement),
  },
  /** `height` sets the chart's height in pixels. */
  Height: {
    args: { ...REGIONAL_ARGS, height: 180 },
    decorators: REGIONAL_DATA,
    play: ({ canvasElement }) => expectHostHeight(canvasElement, 180),
  },
  /** `renderer="svg"` draws SVG instead of a canvas. */
  SvgRenderer: {
    args: { ...REGIONAL_ARGS, renderer: "svg" },
    decorators: REGIONAL_DATA,
    play: ({ canvasElement }) => expectSvgHost(canvasElement),
  },
  /** `select="crossfilter"`: clicking a point filters the `opts` consumer to
   * that point's region; clicking it again clears. */
  SelectCrossfilter: {
    args: { ...REGIONAL_ARGS, filters: "region", select: "crossfilter" },
    decorators: REGIONAL_CROSSFILTER_DECORATORS,
    render: (args, { component: Chart }) => {
      if (!Chart) throw new Error("SelectCrossfilter needs meta.component");
      return (
        <>
          <Chart {...args} />
          <Table data="opts" filters="region" />
        </>
      );
    },
    play: crossfilterTogglePlay(3, 3, ["West", "North"]),
  },
  /** A `data` naming no fence alerts in the chart's place. */
  UnknownName: {
    args: { ...REGIONAL_ARGS, data: "ghost" },
    decorators: REGIONAL_DATA,
    play: ({ canvas }) => expectAlertNaming(canvas, "ghost"),
  },
  /** A column the query does not return is named, with the columns it does. */
  UnknownColumn: {
    args: { ...REGIONAL_ARGS, x: "typo" },
    decorators: REGIONAL_DATA,
    play: ({ canvas }) => expectAlertNaming(canvas, '"typo"', "region"),
  },
  /** A format code the column cannot take names itself in the alert. */
  UnknownFmt: {
    args: { ...REGIONAL_ARGS, yFmt: "bogus" },
    decorators: REGIONAL_DATA,
    play: ({ canvas }) => expectAlertNaming(canvas, 'fmt="bogus"'),
  },
  /** A query that returns no rows shows "0 rows" at the chart's height. */
  NoRows: {
    args: REGIONAL_ARGS,
    decorators: [withQueryData([ORDERS_REGIONAL], dbWith([]))],
    play: ({ canvas }) => expectNoRowsFace(canvas),
  },
} satisfies Record<string, DocStory>;
