import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { ThemeToggle } from "./theme-toggle";

const meta: Meta<typeof ThemeToggle> = {
  title: "Chrome/ThemeToggle",
  component: ThemeToggle,
  args: { mode: "light", onToggle: fn() },
};

export default meta;

type Story = StoryObj<typeof ThemeToggle>;

/** Light mode shows the moon — the mode a click switches to. */
export const Light: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeVisible();
  },
};

/** Dark mode shows the sun instead. */
export const Dark: Story = {
  args: { mode: "dark" },
  globals: { theme: "dark" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Switch to light mode" }),
    ).toBeVisible();
  },
};

/** The component is controlled — a click reports intent and nothing more;
 * `useTheme` in the shell owns resolution and storage. */
export const ClickReportsToggle: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Switch to dark mode" }),
    );
    await expect(args.onToggle).toHaveBeenCalledTimes(1);
  },
};
