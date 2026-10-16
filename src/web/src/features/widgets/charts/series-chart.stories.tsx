import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  withFilteredData,
  withQueryData,
  withThemeMode,
} from "../../../../.storybook/decorators";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { SeriesChart } from "./series-chart";
import {
  ORDERS_REGIONAL,
  REGIONAL_ROWS,
  TREND_ROWS,
  WEEKLY_TREND,
  appliedOption,
  dbWith,
  readyHost,
} from "./series-chart.fixture";
import type { SeriesChartWidgetProps } from "./types";

const meta = {
  title: "Widgets/Charts/SeriesChart",
  component: SeriesChart,
  args: { type: "bar", data: "orders", x: "region", y: "revenue" },
} satisfies Meta<SeriesChartWidgetProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: `data` names a sql fence, the registry result draws
 * a canvas with an aria description. */
export const Success: Story = {
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS))],
  play: async ({ canvasElement }) => {
    const host = await readyHost(canvasElement);
    expect(host.querySelector("canvas")).not.toBeNull();
    expect(host).toHaveAttribute(
      "aria-label",
      "bar chart of revenue by region",
    );
  },
};

/** `series` names a grouping column — one series per value, legend on. */
export const MultiSeries: Story = {
  args: {
    type: "line",
    data: "weekly_trend",
    x: "week",
    y: "orders",
    series: "region",
  },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string }[];
      legend?: unknown[];
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["North", "South"]);
    expect(option.legend?.length).toBeGreaterThan(0);
  },
};

/** `y` accepts an array of columns — each becomes a named series. */
export const MultiY: Story = {
  args: { data: "orders", x: "region", y: ["revenue", "orders"] },
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{ series?: { name?: string }[] }>(
      canvasElement,
    );
    expect(option.series?.map((s) => s.name)).toEqual(["revenue", "orders"]);
  },
};

/** `stacked` piles the series on one stack. */
export const Stacked: Story = {
  args: {
    type: "bar",
    data: "weekly_trend",
    x: "week",
    y: "orders",
    series: "region",
    stacked: true,
  },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{ series?: { stack?: string }[] }>(
      canvasElement,
    );
    expect(option.series?.every((s) => s.stack === "total")).toBe(true);
  },
};

/** `stacked="100%"` normalizes each x to a share of its total — the y axis
 * pins to 0–1 while tooltips keep the raw values. */
export const PercentStack: Story = {
  args: {
    type: "area",
    data: "weekly_trend",
    x: "week",
    y: "orders",
    series: "region",
    stacked: "100%",
  },
  decorators: [withQueryData([WEEKLY_TREND], dbWith(TREND_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{ yAxis?: { max?: number }[] }>(
      canvasElement,
    );
    expect(option.yAxis?.[0]?.max).toBe(1);
  },
};

/** `labels` draws per-point values on the marks. */
export const Labels: Story = {
  args: { labels: true },
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS))],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { label?: { show?: boolean } }[];
    }>(canvasElement);
    expect(option.series?.[0]?.label?.show).toBe(true);
  },
};

/** `useThemeMode` picks the registered dark theme — canvas can't read
 * `.dark` CSS, so the mode arrives as a value. */
export const Dark: Story = {
  decorators: [
    withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS)),
    withThemeMode("dark"),
  ],
  play: async ({ canvasElement }) => {
    const host = await readyHost(canvasElement);
    expect(host).toHaveAttribute("data-echarts-theme", "dark");
  },
};

/** While the query is in flight the pulse reserves the chart's pixels. */
export const Loading: Story = {
  decorators: [withQueryData([ORDERS_REGIONAL], FakeDuckDb.pending())],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("status")).toBeVisible();
  },
};

/** The query's own failure surfaces inline, naming the block. */
export const QueryError: Story = {
  decorators: [
    withQueryData(
      [ORDERS_REGIONAL],
      FakeDuckDb.failing("Catalog Error: Table orders does not exist"),
    ),
  ],
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent("orders");
    await expect(alert).toHaveTextContent("does not exist");
  },
};

/** `title` and `subtitle` render as text above the plot, and the title
 * names the chart's figure. */
export const Titled: Story = {
  args: { title: "Revenue by region", subtitle: "US dollars" },
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS))],
  play: async ({ canvas, canvasElement }) => {
    const host = await readyHost(canvasElement);
    const figure = canvas.getByRole("figure", { name: "Revenue by region" });
    await expect(figure).toContainElement(host);
    await expect(canvas.getByText("US dollars")).toBeVisible();
  },
};

/** The title stays over the loading pulse. */
export const TitledLoading: Story = {
  args: { title: "Revenue by region", subtitle: "US dollars" },
  decorators: [withQueryData([ORDERS_REGIONAL], FakeDuckDb.pending())],
  play: async ({ canvas }) => {
    const figure = canvas.getByRole("figure", { name: "Revenue by region" });
    await expect(figure).toContainElement(await canvas.findByRole("status"));
  },
};

/** The title stays over a failed query's alert. */
export const TitledQueryError: Story = {
  args: { title: "Revenue by region", subtitle: "US dollars" },
  decorators: [
    withQueryData(
      [ORDERS_REGIONAL],
      FakeDuckDb.failing("Catalog Error: Table orders does not exist"),
    ),
  ],
  play: async ({ canvas }) => {
    const figure = canvas.getByRole("figure", { name: "Revenue by region" });
    await expect(figure).toContainElement(await canvas.findByRole("alert"));
  },
};

/** A `data` value no ```sql fence declares renders the named alert. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent("ghost");
  },
};

/** An `x`/`y`/`series` typo names the column and lists the available ones. */
export const UnknownColumn: Story = {
  args: { x: "typo" },
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS))],
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent('"typo"');
    await expect(alert).toHaveTextContent("region");
  },
};

/** A filtered-empty fence renders "0 rows" — not an error — at chart
 * height so the page layout holds. */
export const Empty: Story = {
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith([]))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("0 rows")).toBeVisible();
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=South` seeds the filter, one series remains. */
export const Filtered: Story = {
  args: {
    type: "line",
    data: "weekly_trend",
    x: "week",
    y: "orders",
    series: "region",
    filters: "region",
  },
  decorators: [withFilteredData([WEEKLY_TREND], TREND_ROWS, "region", "South")],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<{
      series?: { name?: string; data?: unknown[] }[];
    }>(canvasElement);
    expect(option.series?.map((s) => s.name)).toEqual(["South"]);
    expect(option.series?.[0]?.data).toHaveLength(3);
  },
};
