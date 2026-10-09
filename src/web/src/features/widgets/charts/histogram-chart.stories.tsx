import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  withFilteredData,
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { Table } from "../table/table";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { Histogram } from "./histogram-chart";
import {
  AMOUNT_ROWS,
  ORDER_AMOUNTS,
  OPTS,
  appliedOption,
  brushMarks,
  dbSelectable,
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

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=North` seeds the filter, North's 12 orders bin. */
export const Filtered: Story = {
  args: { series: "region", filters: "region" },
  decorators: [
    withFilteredData([ORDER_AMOUNTS], AMOUNT_ROWS, "region", "North"),
  ],
  play: async ({ canvasElement }) => {
    await readyHost(canvasElement);
    const option = await appliedOption<{
      series?: { name?: string; data?: unknown[] }[];
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["North"]);
    const counts = option.series?.[0]?.data as number[];
    expect(counts.reduce((a, b) => a + b, 0)).toBe(12);
  },
};

/**
 * `select="crossfilter"`: a brush over the bins publishes the covered
 * bin-edge window as an interval clause on `amount` — bins 1–2 of the
 * rice-rule six, the ~26–55 window — so the consumer table narrows to the
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
    const host = await readyHost(canvasElement);
    const bodyRows = () => canvasElement.querySelectorAll("tbody tr").length;
    await waitFor(() => expect(bodyRows()).toBe(3));

    brushMarks(host, [1, 2]);
    await waitFor(() => expect(bodyRows()).toBe(2));
    expect(canvasElement.querySelector("tbody")?.textContent).toContain("48");
    const option = await appliedOption<{ xAxis?: { data?: unknown[] }[] }>(
      canvasElement,
    );
    expect(option.xAxis?.[0]?.data).toHaveLength(6);

    brushMarks(host, undefined);
    await waitFor(() => expect(bodyRows()).toBe(3));
  },
};
