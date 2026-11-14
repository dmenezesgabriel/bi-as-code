import type { Meta, StoryObj } from "@storybook/react-vite";
import { TableEmpty, TableError, TableLoading } from "./states";
import {
  expectLoadingStatus,
  expectErrorAlert,
  expectZeroRows,
} from "../state-plays.fixture";

const meta: Meta = {
  title: "Widgets/TableStates",
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Skeleton pulse while a query is in flight. */
export const Loading: Story = {
  render: () => <TableLoading />,
  play: expectLoadingStatus,
};

/** An inline failure naming the query — a bad `data` ref or a query error
 * must not take down the page around it. */
export const QueryError: Story = {
  render: () => (
    <TableError
      name="weekly_trend"
      message="Catalog Error: Table orders does not exist"
    />
  ),
  play: expectErrorAlert("weekly_trend", "does not exist"),
};

/** A successful query that returned no rows. */
export const Empty: Story = {
  render: () => <TableEmpty />,
  play: expectZeroRows,
};
