import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Callout } from "./callout";
import { Note } from "./note";
import { Stack } from "./stack";
import type { StackAlign, StackProps } from "./types";

const meta = {
  title: "Widgets/Stack",
  component: Stack,
  args: {
    children: [
      <p key="one">First block</p>,
      <p key="two">Second block</p>,
      <p key="three">Third block</p>,
    ],
  },
} satisfies Meta<StackProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: children lay out vertically, stretched to the
 * container's width, separated by the regular gap. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const stack = canvas.getByText("First block").parentElement!;
    await expect(stack.className).toContain("flex-col");
    const first = canvas.getByText("First block").getBoundingClientRect();
    const second = canvas.getByText("Second block").getBoundingClientRect();
    expect(second.top).toBeGreaterThan(first.bottom);
    expect(first.width).toBeCloseTo(stack.getBoundingClientRect().width, 0);
  },
};

/** `align="center"` shrink-wraps children and centers them — the stack's
 * own width stays full while the item hugs the middle. */
export const AlignCenter: Story = {
  args: {
    align: "center",
    children: [<Note key="n">Centered footnote</Note>],
  },
  play: async ({ canvas }) => {
    const stack = canvas.getByText("Centered footnote").parentElement!;
    await expect(stack.className).toContain("items-center");
    const child = canvas.getByText("Centered footnote").getBoundingClientRect();
    const bounds = stack.getBoundingClientRect();
    const centerOffset = child.left + child.width / 2 - bounds.left;
    expect(centerOffset).toBeCloseTo(bounds.width / 2, 0);
  },
};

/** `align="right"` shrink-wraps children against the right edge. */
export const AlignRight: Story = {
  args: {
    align: "right",
    children: [<Note key="n">Right-aligned footnote</Note>],
  },
  play: async ({ canvas }) => {
    const stack = canvas.getByText("Right-aligned footnote").parentElement!;
    await expect(stack.className).toContain("items-end");
    const child = canvas
      .getByText("Right-aligned footnote")
      .getBoundingClientRect();
    const bounds = stack.getBoundingClientRect();
    expect(child.right).toBeCloseTo(bounds.right, 0);
  },
};

/** Stacks mix widgets and prose — a `<Callout>` over a `<Note>`, the
 * shape a `<Row>` cell carries in the demo page. */
export const ContentMix: Story = {
  args: {
    children: [
      <Callout key="callout" type="warning" title="Concentration risk">
        Top five accounts drove 38% of weekly revenue.
      </Callout>,
      <Note key="note">Source: orders data set.</Note>,
    ],
  },
  play: async ({ canvas }) => {
    const callout = canvas.getByRole("note");
    const note = canvas.getByText("Source: orders data set.");
    expect(note.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      callout.getBoundingClientRect().bottom,
    );
  },
};

/** An `align` outside the schema renders the family's inline alert —
 * MDX props bypass the type system. */
export const MisuseAlign: Story = {
  args: { align: "half" as StackAlign },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent('"half"');
  },
};
