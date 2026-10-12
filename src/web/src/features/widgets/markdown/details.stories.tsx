import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Details } from "./details";
import type { DetailsProps } from "./types";

const meta = {
  title: "Widgets/Details",
  component: Details,
  args: {
    title: "Metric definitions",
    children:
      "Sales includes all core products in all regions. Sales growth is the year-over-year delta of that figure.",
  },
} satisfies Meta<DetailsProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: a chevron-led trigger, panel collapsed until clicked. */
export const Closed: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Metric definitions" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByText(/Sales includes/)).toBeNull();
    // WCAG 2.2 SC 2.5.8: a stacked trigger needs a 24 px tall box.
    const { height } = trigger.getBoundingClientRect();
    await expect(height).toBeGreaterThanOrEqual(24);
  },
};

/** `open` starts the panel expanded. */
export const StartsOpen: Story = {
  args: { open: true },
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Metric definitions" });
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByText(/Sales includes/)).toBeInTheDocument();
  },
};

/** Click toggles the panel; the chevron follows `data-panel-open`. */
export const ToggleInteraction: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Metric definitions" });

    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toHaveAttribute("data-panel-open");
    await expect(canvas.getByText(/Sales includes/)).toBeInTheDocument();

    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).not.toHaveAttribute("data-panel-open");
  },
};

/** A missing `title` renders the family's inline alert — MDX props bypass
 * the type system, so the required-prop check runs at render time. */
export const MissingTitle: Story = {
  args: { title: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Details");
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** Under `.dark` the trigger repaints in the dark palette. */
export const Dark: Story = {
  globals: { theme: "dark" },
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Metric definitions" });
    await expect(trigger.className).toContain("dark:text-neutral-300");
  },
};
