import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { TableEmpty, TableError, TableLoading } from "./states";

const meta: Meta = {
  title: "Widgets/TableStates",
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Skeleton pulse while a query is in flight. */
export const Loading: Story = {
  render: () => <TableLoading />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("status", { name: "Loading query result" }),
    ).toBeVisible();
  },
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
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("weekly_trend");
    await expect(alert).toHaveTextContent("does not exist");
  },
};

/** A successful query that returned no rows. */
export const Empty: Story = {
  render: () => <TableEmpty />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("0 rows")).toBeVisible();
  },
};
