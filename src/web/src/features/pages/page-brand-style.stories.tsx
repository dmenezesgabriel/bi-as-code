import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { withQueryData, withThemeMode } from "../../../.storybook/decorators";
import { BarChart } from "../widgets/charts/bar-chart";
import {
  ORDERS_REGIONAL,
  REGIONAL_ROWS,
  appliedOption,
  dbWith,
} from "../widgets/charts/series-chart.fixture";
import { PageBrandStyle } from "./page-brand-style";

/** A page body painted by the brand: a `bg-primary` surface and a chart. */
function BrandedBody() {
  return (
    <>
      <div className="bg-primary p-2 text-primary-foreground">
        primary surface
      </div>
      <BarChart data="orders" x="region" y="revenue" />
    </>
  );
}

const meta = {
  title: "Pages/PageBrandStyle",
  component: PageBrandStyle,
  args: { css: "", children: <BrandedBody /> },
  decorators: [withQueryData([ORDERS_REGIONAL], dbWith(REGIONAL_ROWS))],
} satisfies Meta<typeof PageBrandStyle>;

export default meta;
type Story = StoryObj<typeof meta>;

type PaletteOption = { color?: string[] };

/** A page without a front-matter brand keeps the project's colours. */
export const Unbranded: Story = {
  play: async ({ canvasElement }) => {
    const surface = await within(canvasElement).findByText("primary surface");
    expect(getComputedStyle(surface).backgroundColor).toBe("rgb(23, 23, 23)");
    const option = await appliedOption<PaletteOption>(canvasElement);
    expect(option.color?.[0]).toBe("#0072b2");
  },
};

/** The page's `brand.colors.primary` repaints every primary surface on the
 * page while it is shown. */
export const BrandedPrimary: Story = {
  args: { css: ":root,\n.light {\n  --primary: #154886;\n}\n" },
  play: async ({ canvasElement }) => {
    const surface = await within(canvasElement).findByText("primary surface");
    expect(getComputedStyle(surface).backgroundColor).toBe("rgb(21, 72, 134)");
  },
};

/** The page's `brand.palette` reaches a chart rendered with the page: the
 * stylesheet is in the document before the chart reads its tokens. */
export const BrandedPalette: Story = {
  args: { css: ":root,\n.light {\n  --chart-1: #1e40af;\n}\n" },
  play: async ({ canvasElement }) => {
    const option = await appliedOption<PaletteOption>(canvasElement);
    expect(option.color?.[0]).toBe("#1e40af");
    expect(option.color?.[1]).toBe("#d55e00");
  },
};

/** Each mode is independent: a dark-only palette entry paints the dark
 * canvas. */
export const BrandedPaletteDark: Story = {
  args: { css: ".dark {\n  --chart-1: #60a5fa;\n}\n" },
  decorators: [withThemeMode("dark")],
  play: async ({ canvasElement }) => {
    const option = await appliedOption<PaletteOption>(canvasElement);
    expect(option.color?.[0]).toBe("#60a5fa");
  },
};

/** The page's `brand.fonts` and `brand.radius` set the root font and radius
 * tokens for the page alone. */
export const BrandedFontsAndRadius: Story = {
  args: {
    css: ":root {\n  --heading-font: var(--font-stack-serif);\n  --radius: 1rem;\n}\n",
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("primary surface");
    const root = getComputedStyle(document.documentElement);
    expect(root.getPropertyValue("--radius").trim()).toBe("1rem");
    expect(root.getPropertyValue("--heading-font")).toBe(
      root.getPropertyValue("--font-stack-serif"),
    );
  },
};
