import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Note } from "./note";
import type { NoteProps } from "./types";

const meta = {
  title: "Widgets/Note",
  component: Note,
  args: {
    children: "Figures are trailing four-week averages from the orders set.",
  },
} satisfies Meta<NoteProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A muted `text-xs` footnote block under a figure. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const note = canvas.getByText(
      "Figures are trailing four-week averages from the orders set.",
    );
    await expect(note.className).toContain("text-xs");
    await expect(note.className).toContain("text-muted-foreground-faded");
  },
};

/** The muted palette dims further under `.dark`. */
export const Dark: Story = {
  globals: { theme: "dark" },
  play: async ({ canvas }) => {
    const note = canvas.getByText(
      "Figures are trailing four-week averages from the orders set.",
    );
    await expect(
      getComputedStyle(note).getPropertyValue("--muted-foreground-faded"),
    ).toBe("#a1a1a1");
  },
};
