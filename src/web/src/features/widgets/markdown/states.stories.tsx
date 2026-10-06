import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { WidgetError } from "./states";

const meta: Meta = {
  title: "Widgets/MarkdownStates",
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Author misuse — an out-of-contract prop or a tag outside its parent —
 * renders inline as `role=alert` instead of taking the page down. */
export const Misuse: Story = {
  render: () => (
    <WidgetError name="Tab" message="must be a direct child of <Tabs>" />
  ),
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("Tab");
    await expect(alert).toHaveTextContent("must be a direct child of <Tabs>");
  },
};
