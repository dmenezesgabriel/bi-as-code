import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  withFilteredData,
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { Table } from "../table/table";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { BarChart } from "./bar-chart";
import { Histogram } from "./histogram-chart";
import {
  AMOUNT_ROWS,
  ORDER_AMOUNTS,
  OPTS,
  appliedOption,
  brushMarks,
  crossfilterScene,
  dbSelectable,
  dbWith,
  expectHostHeight,
  expectSvgHost,
  readyHost,
} from "./series-chart.fixture";
import type { EChartHostElement, HistogramChartProps } from "./types";

const meta = {
  title: "Widgets/Charts/Histogram",
  component: Histogram,
  args: { data: "order_amounts", value: "amount" },
} satisfies Meta<HistogramChartProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Single-assertion play for the alert stories: the alert names the
 * offending value; the unit tests pin the full message. */
const alertPlay =
  (want: string): Story["play"] =>
  async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(want);
  };

type LabelOption = {
  series?: {
    label?: { show?: boolean; formatter?: (p: { value: number[] }) => string };
  }[];
};

/** 24 orders binned by the rice-rule default — ceil(2·24^⅓) = 6 bars. */
export const RiceRuleDefault: Story = {
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const host = await readyHost(canvasElement);
    expect(host.querySelector("canvas")).not.toBeNull();
    expect(host).toHaveAttribute("aria-label", "histogram chart of amount");
    const option = await appliedOption<{
      series?: { type?: string; stack?: string; data?: unknown[] }[];
      xAxis?: { type?: string; min?: number; max?: number }[];
    }>(canvasElement);
    expect(option.series?.[0]?.type).toBe("bar");
    expect(option.series?.[0]?.stack).toBe("total");
    expect(option.series?.[0]?.data).toHaveLength(6);
    expect(option.xAxis?.[0]).toMatchObject({
      type: "value",
      min: 12,
      max: 98,
    });
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

/** `binCount` pins the bin count — that many bars, ticks still round. */
export const ExplicitBinCount: Story = {
  args: { binCount: 10, valueFmt: "usd0" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      xAxis?: { axisLabel?: { customValues?: number[] } }[];
      series?: { data?: [number, number][] }[];
    }>(canvasElement);
    expect(option.series?.[0]?.data).toHaveLength(10);
    expect(option.xAxis?.[0]?.axisLabel?.customValues).toEqual([
      20, 40, 60, 80,
    ]);
    const counts = option.series?.[0]?.data?.map(([, count]) => count) ?? [];
    expect(counts.reduce((a, b) => a + b, 0)).toBe(AMOUNT_ROWS.length);
  },
};

/**
 * North's bin counts as the cross-filtered re-query returns them: the domain
 * is the fence's full extent (12–98, rice-rule six bins over all 24 orders)
 * and North's 12 orders land two per bin.
 */
const NORTH_BINS = Array.from({ length: 6 }, (_, binIndex) => ({
  lo: 12,
  bin_width: 86 / 6,
  bin_count: 6,
  bin_index: binIndex,
  series: "North",
  first_seen: 1,
  frequency: 2,
}));

/** `filters="region"` re-queries the fence under the page filter's bound
 * predicate — `?region=North` seeds the filter — as bin counts in SQL, over
 * the fence's full extent: six bins, not the five North's own extent would
 * give. */
export const Filtered: Story = {
  args: { series: "region", filters: "region" },
  decorators: [
    withFilteredData(
      [ORDER_AMOUNTS],
      AMOUNT_ROWS,
      "region",
      "North",
      NORTH_BINS,
    ),
  ],
  play: async ({ canvasElement }) => {
    await readyHost(canvasElement);
    const option = await appliedOption<{
      series?: { name?: string; data?: unknown[] }[];
      xAxis?: { min?: number; max?: number }[];
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["North"]);
    const counts = (option.series?.[0]?.data as [number, number][]).map(
      ([, count]) => count,
    );
    expect(counts).toEqual([2, 2, 2, 2, 2, 2]);
    expect(option.xAxis?.[0]).toMatchObject({ min: 12, max: 98 });
  },
};

/**
 * `select="crossfilter"`: a brush over the bins publishes the covered
 * bin-edge window as an interval clause on `amount` — a 30–50 brush
 * touches bins 1–2 of the rice-rule six, the ~26–55 window — so the consumer table narrows to the
 * amounts inside it while the histogram keeps its full shape (its own
 * clause skips it); a brush with no areas clears.
 */
export const SelectCrossfilterBrush: Story = {
  args: { select: "crossfilter" },
  decorators: [
    withQueryData([ORDER_AMOUNTS, OPTS], dbSelectable("amount", AMOUNT_ROWS)),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  render: (args) => (
    <>
      <Histogram {...args} />
      <Table data="opts" filters="amount" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const { host, bodyRows } = await crossfilterScene(canvasElement, 3);

    brushMarks(host, [30, 50]);
    await waitFor(() => expect(bodyRows()).toBe(2));
    expect(canvasElement.querySelector("tbody")?.textContent).toContain("48");
    const option = await appliedOption<{ series?: { data?: unknown[] }[] }>(
      canvasElement,
    );
    expect(option.series?.[0]?.data).toHaveLength(6);

    brushMarks(host, undefined);
    await waitFor(() => expect(bodyRows()).toBe(3));
  },
};

/** The consumer's brushed re-query never lands — the chart stays pending. */
function dbHoldingBrushedRequery(): ReturnType<typeof dbSelectable> {
  const db = dbSelectable("amount", AMOUNT_ROWS);
  db.holdWhen = (sql) =>
    sql.includes("amount BETWEEN") ? new Promise(() => {}) : null;
  return db;
}

/**
 * A consumer chart whose cross-filter re-query is in flight keeps its last
 * painted bars, dimmed and `aria-busy`, instead of swapping in the loading
 * pulse — so a drag repaints progressively and the canvas never remounts.
 */
export const ConsumerKeepsChartWhilePending: Story = {
  args: { select: "crossfilter" },
  decorators: [
    withQueryData([ORDER_AMOUNTS, OPTS], dbHoldingBrushedRequery()),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  render: (args) => (
    <>
      <Histogram {...args} />
      <BarChart data="opts" x="region" y="amount" filters="amount" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const hosts = () =>
      canvasElement.querySelectorAll<EChartHostElement>("[data-echarts-ready]");
    await waitFor(() => expect(hosts()).toHaveLength(2));
    const [publisher, consumer] = [...hosts()];
    if (!publisher || !consumer) throw new Error("expected two chart hosts");

    brushMarks(publisher, [30, 50]);

    await waitFor(() =>
      expect(consumer.parentElement).toHaveAttribute("aria-busy", "true"),
    );
    expect(consumer.isConnected).toBe(true);
    expect(canvasElement.querySelector("[role=status]")).toBeNull();
  },
};

/** `binWidth` cuts the 12–98 range into ceil(86 / 20) = 5 bins. */
export const BinWidth: Story = {
  args: { binWidth: 20 },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{ series?: { data?: unknown[] }[] }>(
      canvasElement,
    );
    expect(option.series?.[0]?.data).toHaveLength(5);
  },
};

/** `labels` prints each bar's count on it. */
export const ValueLabels: Story = {
  args: { labels: true, binCount: 8 },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<LabelOption>(canvasElement);
    expect(option.series?.[0]?.label?.show).toBe(true);
  },
};

/** `labelsFmt` formats the labels with a format code; the axis keeps `yFmt`. */
export const LabelFormat: Story = {
  args: { labels: true, binCount: 4, labelsFmt: "num1k" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<LabelOption>(canvasElement);
    expect(option.series?.[0]?.label?.formatter?.({ value: [0, 6] })).toBe(
      "0.0k",
    );
  },
};

/** `color` paints every bar one CSS colour. */
export const Color: Story = {
  args: { color: "#0f766e" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{ color?: string[] }>(canvasElement);
    expect(option.color).toEqual(["#0f766e"]);
  },
};

/** `seriesColors` maps a series name to a colour; unnamed series keep the theme's. */
export const SeriesColors: Story = {
  args: { series: "region", seriesColors: { South: "#f97316" } },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string; color?: string }[];
    }>(canvasElement);
    const colorOf = (name: string) =>
      option.series?.find((s) => s.name === name)?.color;
    expect(colorOf("South")).toBe("#f97316");
    expect(colorOf("North")).toBeUndefined();
  },
};

/** `valueFmt` formats the value axis' ticks. */
export const ValueFormat: Story = {
  args: { valueFmt: "usd0" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      xAxis?: { axisLabel?: { formatter?: (v: number) => string } }[];
    }>(canvasElement);
    expect(option.xAxis?.[0]?.axisLabel?.formatter?.(20)).toBe("$20");
  },
};

/** `yFmt` formats the count axis and the tooltip's counts. */
export const YFormat: Story = {
  args: { binCount: 4, yFmt: "num1k" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      yAxis?: { axisLabel?: { formatter?: (v: number) => string } }[];
    }>(canvasElement);
    expect(option.yAxis?.[0]?.axisLabel?.formatter?.(6)).toBe("0.0k");
  },
};

/** `title` heads the chart and `subtitle` sits under it, above the plot. */
export const TitleAndSubtitle: Story = {
  args: { title: "Order amounts", subtitle: "USD" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Order amounts")).toBeInTheDocument();
    await expect(canvas.getByText("USD")).toBeInTheDocument();
  },
};

/** `xTitle` names the bin axis; `yTitle` the count axis (Frequency by default). */
export const AxisTitles: Story = {
  args: { xTitle: "Amount (USD)", yTitle: "Orders" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      xAxis?: { name?: string }[];
      yAxis?: { name?: string }[];
    }>(canvasElement);
    expect(option.xAxis?.[0]?.name).toBe("Amount (USD)");
    expect(option.yAxis?.[0]?.name).toBe("Orders");
  },
};

/** `legend={false}` hides the legend a multi-series histogram shows. */
export const NoLegend: Story = {
  args: { series: "region", legend: false },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{ legend?: unknown[] }>(canvasElement);
    expect(option.legend ?? []).toEqual([]);
  },
};

/** `height` sets the chart's height in pixels. */
export const Height: Story = {
  args: { height: 180 },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: ({ canvasElement }) => expectHostHeight(canvasElement, 180),
};

/** `renderer="svg"` draws SVG instead of a canvas. */
export const SvgRenderer: Story = {
  args: { renderer: "svg" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: ({ canvasElement }) => expectSvgHost(canvasElement),
};

/** A `data` naming no fence alerts in the chart's place. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: alertPlay("ghost"),
};

/** A column the query does not return is named, with the columns it does. */
export const UnknownColumn: Story = {
  args: { value: "nope" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: alertPlay('"nope"'),
};

/** A format code the column cannot take names itself in the alert. */
export const UnknownFmt: Story = {
  args: { valueFmt: "bogus" },
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith(AMOUNT_ROWS))],
  play: alertPlay('fmt="bogus"'),
};

/** A query that returns no rows shows "0 rows" at the chart's height. */
export const NoRows: Story = {
  decorators: [withQueryData([ORDER_AMOUNTS], dbWith([]))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("0 rows")).toBeInTheDocument();
  },
};
