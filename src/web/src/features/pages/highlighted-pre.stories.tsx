import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { HighlightedPre } from "./highlighted-pre";

const meta: Meta<typeof HighlightedPre> = {
  title: "Pages/HighlightedPre",
  component: HighlightedPre,
};

export default meta;

type Story = StoryObj<typeof HighlightedPre>;

/** A sql fence resolves through shiki into a themed `pre.shiki` tree —
 * async, so the play waits for the swap rather than asserting on the
 * pre-highlight children. */
export const SqlFence: Story = {
  args: {
    children: (
      <code className="language-sql">
        select region, count(*) as orders from orders
      </code>
    ),
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => expect(canvasElement.querySelector("pre.shiki")).not.toBeNull(),
      { timeout: 4_000 },
    );
    await expect(canvasElement.querySelector("pre.shiki")).toHaveTextContent(
      "select region",
    );
  },
};

/** An inline `code` with no language class never reaches shiki — the
 * original `pre` renders through unchanged. */
export const NoLanguage: Story = {
  args: { children: <code>not a fenced language</code> },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("pre.shiki")).toBeNull();
    await expect(canvasElement.querySelector("pre")).toHaveTextContent(
      "not a fenced language",
    );
  },
};
