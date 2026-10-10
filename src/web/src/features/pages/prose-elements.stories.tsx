import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { withMemoryRouter } from "../../../.storybook/decorators";
import {
  ProseH1,
  ProseH2,
  ProseH3,
  ProseH4,
  ProseH5,
  ProseH6,
  ProseLink,
  ProseParagraph,
} from "./prose-elements";

const meta: Meta<typeof ProseH1> = {
  title: "Pages/ProseElements",
  component: ProseH1,
};

export default meta;

type Story = StoryObj<typeof ProseH1>;

function fontSizeOf(element: Element): number {
  return parseFloat(getComputedStyle(element).fontSize);
}

/** Every heading level above body text: sizes step down h1 → h4, and
 * each level is bolder than a paragraph. */
export const HeadingScale: Story = {
  render: () => (
    <>
      <ProseH1>Quarterly results</ProseH1>
      <ProseH2>Orders</ProseH2>
      <ProseH3>By region</ProseH3>
      <ProseH4>West</ProseH4>
      <ProseH5>Returns</ProseH5>
      <ProseH6>Footnotes</ProseH6>
      <ProseParagraph>Body text for comparison.</ProseParagraph>
    </>
  ),
  play: async ({ canvas }) => {
    const headings = canvas.getAllByRole("heading");
    const sizes = headings.slice(0, 4).map(fontSizeOf);
    const body = fontSizeOf(canvas.getByText("Body text for comparison."));

    await expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    await expect(new Set(sizes).size).toBe(4);
    await expect(sizes[3]).toBeGreaterThan(body);
    for (const heading of headings) {
      await expect(
        Number(getComputedStyle(heading).fontWeight),
      ).toBeGreaterThanOrEqual(600);
    }
  },
};

/** Consecutive paragraphs leave a gap; the last one ends flush so a
 * callout or details body closes on the widget's own padding. */
export const Paragraphs: Story = {
  render: () => (
    <div>
      <ProseParagraph>Order volume rose in the West.</ProseParagraph>
      <ProseParagraph>Returns held steady.</ProseParagraph>
    </div>
  ),
  play: async ({ canvas }) => {
    const first = canvas.getByText("Order volume rose in the West.");
    const last = canvas.getByText("Returns held steady.");

    await expect(
      parseFloat(getComputedStyle(first).marginBottom),
    ).toBeGreaterThan(0);
    await expect(getComputedStyle(last).marginBottom).toBe("0px");
  },
};

/** An internal (client-routed) and an external link read apart from the
 * paragraph: underlined, colored, and outlined when tabbed to. */
export const Links: Story = {
  decorators: [withMemoryRouter(["/", "/nested/page"], "/")],
  render: () => (
    <ProseParagraph>
      See the <ProseLink href="/nested/page">region detail</ProseLink> or the{" "}
      <ProseLink href="https://duckdb.org/docs/">DuckDB docs</ProseLink>.
    </ProseParagraph>
  ),
  play: async ({ canvas }) => {
    const paragraph = canvas.getByText(/See the/);
    const links = canvas.getAllByRole("link");

    for (const link of links) {
      await expect(getComputedStyle(link).textDecorationLine).toBe("underline");
      await expect(getComputedStyle(link).color).not.toBe(
        getComputedStyle(paragraph).color,
      );
    }
    const internal = canvas.getByRole("link", { name: "region detail" });
    await userEvent.tab();
    await expect(internal).toHaveFocus();
    await expect(getComputedStyle(internal).outlineStyle).toBe("solid");
  },
};
