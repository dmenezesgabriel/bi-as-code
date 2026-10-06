import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Callout } from "./callout";
import type { CalloutProps, CalloutType } from "./types";

const meta = {
  title: "Widgets/Callout",
  component: Callout,
  args: {
    children:
      "Growth this week concentrated in the West, where one wholesale account contributed nearly a third of the lift.",
  },
} satisfies Meta<CalloutProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: `type` picks the tint, `title` leads the panel. */
export const Info: Story = {
  args: { type: "info", title: "Report info" },
  play: async ({ canvas }) => {
    const note = canvas.getByRole("note");
    await expect(note.className).toContain("bg-blue-50");
    await expect(
      canvas.getByRole("heading", { name: "Report info" }),
    ).toBeInTheDocument();
  },
};

/** `success` tints green — emerald stands in for evidence's `fern`. */
export const Success: Story = {
  args: { type: "success", title: "All systems normal" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("note").className).toContain("bg-emerald-50");
  },
};

/** `warning` tints amber. */
export const Warning: Story = {
  args: { type: "warning", title: "Concentration risk" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("note").className).toContain("bg-yellow-50");
  },
};

/** `error` tints red. */
export const ErrorVariant: Story = {
  args: { type: "error", title: "Data quality" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("note").className).toContain("bg-red-50");
  },
};

/** `title` unset renders body text with no heading. */
export const Untitled: Story = {
  args: { type: "info" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("note")).toBeInTheDocument();
    await expect(canvas.queryByRole("heading")).toBeNull();
  },
};

/** Under `.dark` the solid washes become alpha tints. */
export const Dark: Story = {
  args: { type: "warning", title: "Concentration risk" },
  globals: { theme: "dark" },
  play: async ({ canvas }) => {
    const note = canvas.getByRole("note");
    await expect(note.className).toContain("dark:bg-yellow-500/10");
    await expect(note.className).toContain("dark:text-yellow-200");
  },
};

/** A `type` outside the schema renders a named inline alert — MDX props
 * bypass the type system, so the check runs at render time. */
export const InvalidType: Story = {
  args: { type: "tip" as CalloutType, title: "ignored" },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent('"tip"');
    await expect(canvas.queryByRole("note")).toBeNull();
  },
};
