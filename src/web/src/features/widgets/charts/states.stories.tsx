import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartEmpty, ChartError, ChartLoading } from "./states";
import {
  expectLoadingStatus,
  expectErrorAlert,
  expectZeroRows,
} from "../state-plays.fixture";

const meta: Meta = {
  title: "Widgets/ChartStates",
};

export default meta;

type Story = StoryObj<typeof meta>;

/** A chart-sized pulse while a query is in flight — the box reserves the
 * pixels the canvas will claim, so the page doesn't jump when data lands. */
export const Loading: Story = {
  render: () => <ChartLoading height={300} />,
  play: expectLoadingStatus,
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
  play: expectErrorAlert("weekly_trend", "orders"),
};

/** A filtered-empty fence — the success path that found zero rows keeps the
 * chart's height so the page layout holds. */
export const Empty: Story = {
  render: () => <ChartEmpty height={300} />,
  play: expectZeroRows,
};
