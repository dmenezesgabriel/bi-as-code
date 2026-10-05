import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import * as icons from "./icons";

const meta: Meta = {
  title: "Components/Icons",
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Every wrapped icon at its default size, labelled — the wrap site keeps
 * lucide behind `components/`, so this grid is the catalog callers pick
 * from. */
export const Gallery: Story = {
  render: () => (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {Object.entries(icons).map(([name, Icon]) => (
        <li key={name} className="flex items-center gap-2 text-sm">
          <Icon />
          <code>{name}</code>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("listitem").length).toBeGreaterThan(0);
  },
};
