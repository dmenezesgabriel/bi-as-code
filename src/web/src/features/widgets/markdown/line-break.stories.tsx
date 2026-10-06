import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { LineBreak } from "./line-break";
import type { LineBreakProps } from "./types";

const meta = {
  title: "Widgets/LineBreak",
  component: LineBreak,
  render: (args) => (
    <>
      <p>Section above</p>
      <LineBreak {...args} />
      <p>Section below</p>
    </>
  ),
} satisfies Meta<LineBreakProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `lines` unset inserts a single `<br/>` between sections. */
export const OneLine: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("br")).toHaveLength(1);
  },
};

/** `lines={3}` widens the gap to three line heights. */
export const ThreeLines: Story = {
  args: { lines: 3 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("br")).toHaveLength(3);
  },
};
