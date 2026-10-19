import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { PageIcon } from "./page-icon";
import { PAGE_ICONS } from "./page-icon-catalog";

const meta: Meta<typeof PageIcon> = {
  title: "Components/PageIcon",
  component: PageIcon,
};

export default meta;

type Story = StoryObj<typeof PageIcon>;

/** Every name a page's front-matter `icon` accepts, with its glyph — the
 * catalog an author picks from. */
export const Catalog: Story = {
  render: () => (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Object.keys(PAGE_ICONS).map((name) => (
        <li key={name} className="flex items-center gap-2 text-sm">
          <PageIcon name={name} />
          <code>{name}</code>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const glyphs = canvasElement.querySelectorAll("li > svg");
    await expect(glyphs).toHaveLength(56);
    for (const glyph of glyphs) {
      await expect(glyph).toHaveAttribute("aria-hidden", "true");
    }
  },
};

/** One glyph; it takes the surrounding text colour. */
export const Single: Story = {
  args: { name: "chart-line" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg")).toHaveClass(
      "lucide-chart-line",
    );
  },
};

/** A name outside the catalog draws nothing — the engine reports it. */
export const UnknownName: Story = {
  args: { name: "calender" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg")).toBeNull();
  },
};
