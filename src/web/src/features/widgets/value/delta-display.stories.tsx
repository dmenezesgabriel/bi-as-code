import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { DeltaDisplay } from "./delta-display";
import type { DeltaDisplayProps } from "./delta-display";

const meta = {
  title: "Widgets/DeltaDisplay",
  component: DeltaDisplay,
  args: { value: 0.052, fmt: "pct1" },
} satisfies Meta<DeltaDisplayProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The component root — the only element carrying `data-status`. */
const root = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector("[data-status]")!;

/** A positive WoW delta: `+` sign, up arrow, good-direction color. */
export const Positive: Story = {
  play: async ({ canvasElement }) => {
    const el = root(canvasElement);
    await expect(el).toHaveAttribute("data-status", "positive");
    await expect(el).toHaveTextContent("+5.2%");
    await expect(el.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  },
};

/** A negative delta keeps formatValue's own `-` and reads down. */
export const Negative: Story = {
  args: { value: -0.041 },
  play: async ({ canvasElement }) => {
    const el = root(canvasElement);
    await expect(el).toHaveAttribute("data-status", "negative");
    await expect(el).toHaveTextContent("-4.1%");
  },
};

/** Zero sits inside the default [0,0] neutral band — flat bar, gray. */
export const Neutral: Story = {
  args: { value: 0 },
  play: async ({ canvasElement }) => {
    await expect(root(canvasElement)).toHaveAttribute("data-status", "neutral");
  },
};

/** `chip` renders the delta as a tinted pill. */
export const Chip: Story = {
  args: { chip: true },
  play: async ({ canvasElement }) => {
    await expect(root(canvasElement).className).toContain("border");
  },
};

/** `downIsGood` inverts the palette: a negative delta is the good outcome
 * (think cost or latency). */
export const DownIsGood: Story = {
  args: { value: -0.041, downIsGood: true },
  play: async ({ canvasElement }) => {
    const el = root(canvasElement);
    await expect(el).toHaveAttribute("data-status", "negative");
    await expect(el.className).toContain("text-emerald-");
  },
};

/** `symbolPosition="left"` puts the arrow before the value — the layout
 * `<BigValue>` uses for its comparison row. */
export const SymbolLeft: Story = {
  args: { symbolPosition: "left" },
  play: async ({ canvasElement }) => {
    const html = root(canvasElement).innerHTML;
    await expect(html.indexOf("<svg")).toBeLessThan(html.indexOf("+5.2%"));
  },
};

/** The default `symbolPosition="right"` keeps the arrow after the value. */
export const SymbolRight: Story = {
  play: async ({ canvasElement }) => {
    const html = root(canvasElement).innerHTML;
    await expect(html.indexOf("+5.2%")).toBeLessThan(html.indexOf("<svg"));
  },
};

/** `showSymbol={false}` renders the signed value alone. */
export const WithoutSymbol: Story = {
  args: { showSymbol: false },
  play: async ({ canvasElement }) => {
    await expect(root(canvasElement).querySelector("svg")).toBeNull();
    await expect(root(canvasElement)).toHaveTextContent("+5.2%");
  },
};

/** A widened neutral band keeps small wobbles gray: ±2% reads neutral. */
export const CustomNeutralRange: Story = {
  args: { value: 0.02, neutralRange: [-0.05, 0.05] },
  play: async ({ canvasElement }) => {
    await expect(root(canvasElement)).toHaveAttribute("data-status", "neutral");
    await expect(root(canvasElement)).toHaveTextContent("2.0%");
  },
};

/** `text` captions the delta inline. */
export const WithCaption: Story = {
  args: { text: "vs. prior week" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("vs. prior week")).toBeInTheDocument();
  },
};
