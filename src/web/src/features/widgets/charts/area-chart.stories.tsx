import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  withFilteredData,
  withQueryData,
} from "../../../../.storybook/decorators";
import { AreaChart } from "./area-chart";
import {
  SPARSE_TREND_ROWS,
  TREND_ROWS,
  WEEKLY_TREND,
  appliedOption,
  dbWith,
} from "./series-chart.fixture";
import {
  SERIES_DOC_STORIES,
  SPLIT_ARGS,
  TREND_DATA,
} from "./series-chart-doc-stories.fixture";
import {
  expectAreaFilled,
  expectSharesAxis,
  expectTotalStack,
} from "./series-chart-plays.fixture";
import type { SeriesChartProps } from "./types";

const meta = {
  title: "Widgets/Charts/AreaChart",
  component: AreaChart,
  args: { data: "weekly_trend", x: "week", y: "orders" },
} satisfies Meta<SeriesChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AreaFromQuery = SERIES_DOC_STORIES.FromQuery;
export const SeveralMeasures = SERIES_DOC_STORIES.SeveralMeasures;

/** `series` splits the points into one shaded area per region, with a legend. */
export const MultiSeries: Story = {
  args: SPLIT_ARGS,
  decorators: TREND_DATA,
  play: async ({ canvasElement }) => {
    await expectAreaFilled(canvasElement);
    const option = await appliedOption<{
      series?: { name?: string }[];
      legend?: unknown[];
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["North", "South"]);
    expect(option.legend?.length).toBeGreaterThan(0);
  },
};

/** `stacked` piles every area on one stack, so the top edge reads the total. */
export const Stacked: Story = {
  args: { ...SPLIT_ARGS, stacked: true },
  decorators: TREND_DATA,
  play: async ({ canvasElement }) => {
    await expectTotalStack(canvasElement, "line");
    await expectAreaFilled(canvasElement);
  },
};

/** A stack where South has no week-2 row: South draws 0 there, so North
 * keeps its base instead of a hole opening through the layer above. */
export const StackedMissingPoint: Story = {
  args: { ...SPLIT_ARGS, stacked: true },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(SPARSE_TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string; data?: unknown[] }[];
    }>(canvasElement);
    const south = option.series?.find((s) => s.name === "South");
    expect(south?.data?.[1]).toEqual([2, 0]);
  },
};

/** The demo shape: the weekly trend as a 100%-stacked area — each week
 * normalized to a share of its total, raw values kept for the tooltip. */
export const PercentStack: Story = {
  args: { ...SPLIT_ARGS, stacked: "100%" },
  decorators: TREND_DATA,
  play: async ({ canvasElement }) => {
    await expectTotalStack(canvasElement, "line");
    await expectAreaFilled(canvasElement);
    await expectSharesAxis(canvasElement);
  },
};

export const Labeled = SERIES_DOC_STORIES.Labeled;
export const LabelFormat = SERIES_DOC_STORIES.LabelFormat;
export const Color = SERIES_DOC_STORIES.Color;
export const SeriesColors = SERIES_DOC_STORIES.SeriesColors;
export const XFormat = SERIES_DOC_STORIES.XFormat;
export const YFormat = SERIES_DOC_STORIES.YFormat;
export const TitleAndSubtitle = SERIES_DOC_STORIES.TitleAndSubtitle;
export const AxisTitles = SERIES_DOC_STORIES.AxisTitles;
export const NoLegend = SERIES_DOC_STORIES.NoLegend;
export const Height = SERIES_DOC_STORIES.Height;
export const SvgRenderer = SERIES_DOC_STORIES.SvgRenderer;

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=South` seeds the filter; the remaining series keeps
 * its area shading. */
export const Filtered: Story = {
  args: { ...SPLIT_ARGS, filters: "region" },
  decorators: [withFilteredData([WEEKLY_TREND], TREND_ROWS, "region", "South")],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{ series?: { name?: string }[] }>(
      canvasElement,
    );
    expect(option.series?.map((s) => s.name)).toEqual(["South"]);
    await expectAreaFilled(canvasElement);
  },
};

export const SelectCrossfilter = SERIES_DOC_STORIES.SelectCrossfilter;
export const UnknownName = SERIES_DOC_STORIES.UnknownName;
export const UnknownColumn = SERIES_DOC_STORIES.UnknownColumn;
export const UnknownFmt = SERIES_DOC_STORIES.UnknownFmt;
export const NoRows = SERIES_DOC_STORIES.NoRows;
