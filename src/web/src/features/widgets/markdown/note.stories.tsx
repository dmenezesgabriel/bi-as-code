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

/** Links, emphasis and inline code work inside a note, as MDX compiles them. */
export const WithMarkdown: Story = {
  args: {
    children: (
      <>
        Counts include penguins with <em>missing</em> measurements; see{" "}
        <a href="/layout/callout">Callout</a> for <code>type</code> options.
      </>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Callout" })).toHaveAttribute(
      "href",
      "/layout/callout",
    );
    await expect(canvas.getByText("missing").tagName).toBe("EM");
    await expect(canvas.getByText("type").tagName).toBe("CODE");
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
