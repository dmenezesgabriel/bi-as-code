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
