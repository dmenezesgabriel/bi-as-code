import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ValueError, ValueLoading } from "./states";

const meta: Meta = {
  title: "Widgets/ValueStates",
};

export default meta;

type Story = StoryObj<typeof meta>;

/** A text-sized pulse while a query is in flight — a KPI's loading face is
 * one line tall, so the table's three-bar skeleton would be the wrong shape. */
export const Loading: Story = {
  render: () => <ValueLoading />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("status", { name: "Loading query result" }),
    ).toBeVisible();
  },
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
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("weekly_revenue");
    await expect(alert).toHaveTextContent("does not exist");
  },
};
