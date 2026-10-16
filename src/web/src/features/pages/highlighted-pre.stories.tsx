import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { HighlightedPre } from "./highlighted-pre";

const meta: Meta<typeof HighlightedPre> = {
  title: "Pages/HighlightedPre",
  component: HighlightedPre,
};

export default meta;

type Story = StoryObj<typeof HighlightedPre>;

interface FenceLook {
  pre: HTMLElement;
  muted: string;
  background: string;
  fontSize: string;
  paddingRight: number;
}

/** Waits for shiki's `pre` and returns its computed look beside the
 * `--muted` token it should be painted with. */
async function fenceLook(canvasElement: HTMLElement): Promise<FenceLook> {
  await waitFor(
    () => expect(canvasElement.querySelector("pre.shiki")).not.toBeNull(),
    { timeout: 4_000 },
  );
  const pre = canvasElement.querySelector<HTMLElement>("pre.shiki")!;
  const probe = document.createElement("div");
  probe.style.background = "var(--muted)";
  pre.parentElement!.append(probe);
  const muted = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const style = getComputedStyle(pre);
  return {
    pre,
    muted,
    background: style.backgroundColor,
    fontSize: style.fontSize,
    paddingRight: parseFloat(style.paddingRight),
  };
}

/** A sql fence resolves through shiki into a themed `pre.shiki` tree —
 * async, so the play waits for the swap rather than asserting on the
 * pre-highlight children — on the muted surface in small type. */
export const SqlFence: Story = {
  args: {
    children: (
      <code className="language-sql">
        select region, count(*) as orders from orders
      </code>
    ),
  },
  play: async ({ canvasElement }) => {
    const look = await fenceLook(canvasElement);
    await expect(look.pre).toHaveTextContent("select region");
    await expect(look.background).toBe(look.muted);
    await expect(look.fontSize).toBe("14px");
  },
};

/** In dark mode the fence takes the page's dark `--muted`, not shiki's
 * own blue-black theme background. */
export const DarkFence: Story = {
  args: {
    children: (
      <code className="language-sql">
        {"-- revenue by region\nselect region, sum(amount) from orders"}
      </code>
    ),
  },
  globals: { theme: "dark" },
  play: async ({ canvasElement }) => {
    const look = await fenceLook(canvasElement);
    await expect(look.background).toBe(look.muted);
    await expect(look.background).not.toBe("rgb(13, 17, 23)");
  },
};

/** A fence wider than its column scrolls inside itself — the page never
 * scrolls sideways — keeps its background and right gutter across the
 * whole scroll, and `Tab` reaches it so a keyboard can scroll it too. */
export const WideFence: Story = {
  args: {
    children: (
      <code className="language-sql">
        select region, sum(amount) as revenue, count(*) as orders, avg(amount)
        as average_order from orders group by region order by revenue desc
      </code>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const { pre, paddingRight } = await fenceLook(canvasElement);
    const scroller = pre.parentElement!;
    await expect(paddingRight).toBeGreaterThan(0);
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    await expect(pre.offsetWidth).toBe(scroller.scrollWidth);
    await userEvent.tab();
    await expect(scroller).toHaveFocus();
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
