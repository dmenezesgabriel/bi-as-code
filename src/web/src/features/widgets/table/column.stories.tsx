import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Column } from "./column";

const meta = {
  title: "Widgets/Column",
  component: Column,
  args: { id: "revenue" },
} satisfies Meta<typeof Column>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Outside `<Table>` the carrier reports its misuse instead of vanishing. */
export const Orphan: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "must be a direct child of <Table>",
    );
  },
};
