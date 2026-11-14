import type { Meta, StoryObj } from "@storybook/react-vite";
import { ValueError, ValueLoading } from "./states";
import { expectLoadingStatus, expectErrorAlert } from "../state-plays.fixture";

const meta: Meta = {
  title: "Widgets/ValueStates",
};

export default meta;

type Story = StoryObj<typeof meta>;

/** A text-sized pulse while a query is in flight — a KPI's loading face is
 * one line tall, so the table's three-bar skeleton would be the wrong shape. */
export const Loading: Story = {
  render: () => <ValueLoading />,
  play: expectLoadingStatus,
};

/** An inline failure naming the query — a bad `data`/`column`/`fmt` ref or a
 * query error must not take down the prose around it. */
export const QueryError: Story = {
  render: () => (
    <ValueError
      name="weekly_revenue"
      message="Catalog Error: Table orders does not exist"
    />
  ),
  play: expectErrorAlert("weekly_revenue", "does not exist"),
};
