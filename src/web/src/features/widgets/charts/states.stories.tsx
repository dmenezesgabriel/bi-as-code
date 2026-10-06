import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ChartEmpty, ChartError, ChartLoading } from "./states";

const meta: Meta = {
  title: "Widgets/ChartStates",
};

export default meta;

type Story = StoryObj<typeof meta>;

/** A chart-sized pulse while a query is in flight — the box reserves the
 * pixels the canvas will claim, so the page doesn't jump when data lands. */
export const Loading: Story = {
  render: () => <ChartLoading height={300} />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("status", { name: "Loading query result" }),
    ).toBeVisible();
  },
};

/** A block failure naming the query — a bad `data`/`x`/`y`/`fmt` ref or a
 * query error must not take down the page around the chart. */
export const QueryError: Story = {
  render: () => (
    <ChartError
      name="weekly_trend"
      message='column "orders" is not in the result — available: week, revenue'
      height={300}
    />
  ),
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("weekly_trend");
    await expect(alert).toHaveTextContent("orders");
  },
};

/** A filtered-empty fence — the success path that found zero rows keeps the
 * chart's height so the page layout holds. */
export const Empty: Story = {
  render: () => <ChartEmpty height={300} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("0 rows")).toBeVisible();
  },
};
