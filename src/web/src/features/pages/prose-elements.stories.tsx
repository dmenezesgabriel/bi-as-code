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
  ProseImage,
  ProseLink,
  ProseParagraph,
  ProseTable,
  ProseTd,
  ProseTh,
  ProseUnorderedList,
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

/** Consecutive paragraphs sit one block gap (16px) apart, even outside the
 * page column; the last one ends flush so a callout or details body closes
 * on the widget's own padding. */
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
      last.getBoundingClientRect().top - first.getBoundingClientRect().bottom,
    ).toBe(16);
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

// A 1600 x 600 picture, wider than any column, so the story proves scaling.
const WIDE_PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600"><rect width="1600" height="600" fill="#cbd5e1"/></svg>',
)}`;

/** An image wider than its column scales down to the column and keeps its
 * aspect ratio, so a screenshot never scrolls the page sideways. */
export const WideImage: Story = {
  render: () => (
    <div data-testid="column" style={{ width: 320 }}>
      <ProseImage src={WIDE_PICTURE} alt="A wide picture" />
    </div>
  ),
  play: async ({ canvas }) => {
    const image = canvas.getByRole("img", { name: "A wide picture" });
    const column = canvas.getByTestId("column");

    await expect(image.getBoundingClientRect().width).toBe(
      column.getBoundingClientRect().width,
    );
    await expect(image.getBoundingClientRect().height).toBe(120);
  },
};

const CHANNELS = [
  ["Direct", "46%", "163"],
  ["Marketplace", "32%", "113"],
] as const;

/** A GFM table with right-aligned numeric columns: padded header cells
 * that no longer run together, and a rule under every row. */
export const Tables: Story = {
  render: () => (
    <ProseTable>
      <thead>
        <tr>
          <ProseTh>Channel</ProseTh>
          <ProseTh style={{ textAlign: "right" }}>Share</ProseTh>
          <ProseTh style={{ textAlign: "right" }}>Orders</ProseTh>
        </tr>
      </thead>
      <tbody>
        {CHANNELS.map(([channel, share, orders]) => (
          <tr key={channel}>
            <ProseTd>{channel}</ProseTd>
            <ProseTd style={{ textAlign: "right" }}>{share}</ProseTd>
            <ProseTd style={{ textAlign: "right" }}>{orders}</ProseTd>
          </tr>
        ))}
      </tbody>
    </ProseTable>
  ),
  play: async ({ canvas }) => {
    const share = canvas.getByRole("columnheader", { name: "Share" });
    const orders = canvas.getByRole("columnheader", { name: "Orders" });
    const cells = canvas.getAllByRole("cell");

    await expect(parseFloat(getComputedStyle(share).paddingRight)).toBe(16);
    // Right-aligned text hugs the cell's padding edge, so the gap between
    // the two header labels is at least that padding.
    await expect(
      textBox(orders).left - textBox(share).right,
    ).toBeGreaterThanOrEqual(16);
    for (const cell of cells) {
      await expect(getComputedStyle(cell).borderBottomWidth).toBe("1px");
    }
  },
};

/** A table whose code-span cells cannot wrap, in a phone-width column:
 * it scrolls sideways inside its own scroller, which takes keyboard focus,
 * and the column stays as wide as it was. */
export const WideTable: Story = {
  render: () => (
    <div data-testid="column" className="w-[20rem]">
      <ProseTable>
        <thead>
          <tr>
            <ProseTh>Field</ProseTh>
            <ProseTh>Flag</ProseTh>
          </tr>
        </thead>
        <tbody>
          <tr>
            <ProseTd>
              <code>linuxParameters.capabilities.drop</code>
            </ProseTd>
            <ProseTd>
              <code>--cap-drop ALL</code>
            </ProseTd>
          </tr>
        </tbody>
      </ProseTable>
    </div>
  ),
  play: async ({ canvas }) => {
    const column = canvas.getByTestId("column");
    const scroller = canvas.getByRole("table").parentElement!;

    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    await expect(column.scrollWidth).toBe(column.clientWidth);
    // An inline element that wraps returns one client rect per line.
    for (const cell of canvas.getAllByRole("cell")) {
      await expect(cell.firstElementChild!.getClientRects()).toHaveLength(1);
    }
    await userEvent.tab();
    await expect(scroller).toHaveFocus();
  },
};

/** In a column wider than the measure, a long paragraph, a heading and a
 * list stop at 640px (70ch at the body size) while a chart beside them keeps
 * the full column. */
export const ProseMeasure: Story = {
  render: () => (
    <div data-testid="column" className="w-[56rem]">
      <ProseH2>
        A heading that runs on long enough to reach past the measure
      </ProseH2>
      <ProseParagraph>
        Order volume rose in the West for the third week running, led by the
        marketplace channel, while the South held flat and returns stayed inside
        their normal band, so the lift reads as clean demand.
      </ProseParagraph>
      <ProseUnorderedList>
        <li>
          West growth is volume-led and concentrated in the top five accounts,
          which is worth watching before the quarter closes.
        </li>
      </ProseUnorderedList>
      <div role="figure" aria-label="Chart" className="h-40 border" />
    </div>
  ),
  play: async ({ canvas }) => {
    const width = (element: HTMLElement) =>
      element.getBoundingClientRect().width;
    const column = canvas.getByTestId("column");

    await expect(width(canvas.getByRole("heading"))).toBe(640);
    await expect(width(canvas.getByText(/^Order volume rose/))).toBe(640);
    await expect(width(canvas.getByRole("list"))).toBe(640);
    await expect(getComputedStyle(canvas.getByRole("list")).listStyleType).toBe(
      "disc",
    );
    await expect(width(canvas.getByRole("figure", { name: "Chart" }))).toBe(
      width(column),
    );
  },
};

function textBox(cell: HTMLElement): DOMRect {
  const range = document.createRange();
  range.selectNodeContents(cell);
  return range.getBoundingClientRect();
}
