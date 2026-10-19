import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { FakeDuckDb } from "../data/fake-duckdb";
import type { Row } from "../data/types";
import {
  withDataRuntime,
  withMemoryRouter,
} from "../../../.storybook/decorators";
import { MarkdownPage } from "./markdown-page";
import type { CompiledPageModule } from "./types";

/** A page module shaped exactly like the compiled output — `default` is
 * the MDX component receiving `components`, `sqlBlocks` feeds the registry
 * mount decision. */
function pageModule(partial: Partial<CompiledPageModule>): CompiledPageModule {
  return {
    default: () => null,
    frontmatter: {},
    title: null,
    sqlBlocks: [],
    sqlTables: {},
    layout: {},
    brandCss: "",
    ...partial,
  };
}

const meta: Meta<typeof MarkdownPage> = {
  title: "Pages/MarkdownPage",
  component: MarkdownPage,
  args: { siteTitle: "biac" },
};

export default meta;

type Story = StoryObj<typeof MarkdownPage>;

/** A plain page: markdown content under the article landmark, plus the
 * right-rail "On this page" ToC once headings exist. */
export const PlainPage: Story = {
  args: {
    page: pageModule({
      title: "Quarterly results",
      default: () => (
        <>
          <h1>Quarterly results</h1>
          <h2>Orders</h2>
          <p>Order volume.</p>
          <h2>Revenue</h2>
          <p>Revenue.</p>
        </>
      ),
    }),
  },
  decorators: [withMemoryRouter(["/"], "/")],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Quarterly results" }),
    ).toBeVisible();
    await expect(document.title).toBe("Quarterly results");
  },
};

/** A page whose module declares a named sql block mounts the registry —
 * the fence (` ```sql orders echo display `) renders its query result
 * inline under the highlighted code. */
export const PageWithQuery: Story = {
  args: {
    page: pageModule({
      title: "With data",
      sqlBlocks: [{ name: "orders", sql: "select * from orders" }],
      default: ({ components }) => {
        const Pre = components?.pre ?? "pre";
        return (
          <Pre>
            <code
              className="language-sql"
              {...{ meta: "orders", echo: "", display: "" }}
            >
              select * from orders
            </code>
          </Pre>
        );
      },
    }),
  },
  decorators: [
    withMemoryRouter(["/"], "/"),
    withDataRuntime(
      (() => {
        const db = new FakeDuckDb();
        db.rows = [
          { region: "West", orders: 140 },
          { region: "North", orders: 120 },
        ] satisfies Row[];
        return db;
      })(),
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toBeVisible();
    await expect(canvas.getByRole("cell", { name: "West" })).toBeVisible();
  },
};

/** Consecutive blocks sit one block gap (16px) apart: widget roots carry
 * no margin of their own, so the gap comes from the page column alone. */
export const BlockRhythm: Story = {
  args: {
    page: pageModule({
      title: "Rhythm",
      default: () => (
        <>
          <div role="figure" aria-label="KPI row" className="h-16 border" />
          <div role="figure" aria-label="Chart" className="h-40 border" />
          <p>Order volume rose in the West.</p>
          <div role="figure" aria-label="Table" className="h-24 border" />
        </>
      ),
    }),
  },
  decorators: [withMemoryRouter(["/"], "/")],
  play: async ({ canvas }) => {
    const kpis = canvas.getByRole("figure", { name: "KPI row" });
    const chart = canvas.getByRole("figure", { name: "Chart" });
    const text = canvas.getByText("Order volume rose in the West.");
    const table = canvas.getByRole("figure", { name: "Table" });
    const gap = (above: HTMLElement, below: HTMLElement) =>
      below.getBoundingClientRect().top - above.getBoundingClientRect().bottom;
    const gaps = [gap(kpis, chart), gap(chart, text), gap(text, table)];

    await expect(gaps).toEqual([16, 16, 16]);
  },
};

/** Front-matter `page_width: full`: no reading-column cap, so the article
 * fills its container up to the container's 24px side padding. */
export const FullWidth: Story = {
  args: {
    page: pageModule({
      title: "Dashboard",
      layout: { page_width: "full" },
      default: () => (
        <div role="figure" aria-label="Chart" className="h-40 border" />
      ),
    }),
  },
  decorators: [withMemoryRouter(["/"], "/")],
  play: async ({ canvas }) => {
    const main = canvas.getByRole("main");
    const container = main.parentElement as HTMLElement;

    await expect(main.getBoundingClientRect().width).toBe(
      container.clientWidth - 48,
    );
  },
};

function OrdersAndRevenue() {
  return (
    <>
      <h2>Orders</h2>
      <p>Order volume.</p>
      <h2>Revenue</h2>
      <p>Revenue.</p>
    </>
  );
}

/** `table_of_contents: false` — from the page's front-matter or the
 * project's `layout` — drops the right rail even with headings to list. */
export const WithoutTableOfContents: Story = {
  args: {
    page: pageModule({
      title: "Quarterly results",
      layout: { table_of_contents: false },
      default: OrdersAndRevenue,
    }),
  },
  decorators: [withMemoryRouter(["/"], "/")],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Revenue" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("navigation", { name: "On this page" }),
    ).toBeNull();
  },
};

/** `table_of_contents_label` — from the page's front-matter or the
 * project's `layout` — heads the rail and names its `nav` landmark. The
 * rail is in the DOM at any width; it shows from a 59rem container up. */
export const LabelledTableOfContents: Story = {
  args: {
    page: pageModule({
      title: "Quarterly results",
      layout: { table_of_contents_label: "Contents" },
      default: OrdersAndRevenue,
    }),
  },
  decorators: [withMemoryRouter(["/"], "/")],
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelector('nav[aria-label="Contents"]'),
      ).not.toBeNull(),
    );
    await expect(
      canvasElement.querySelector('nav[aria-label="Contents"] p'),
    ).toHaveTextContent("Contents");
  },
};

/** Front-matter `cards: true`: the big value sits on a card over the
 * tinted page; the callout beside it stays prose chrome. */
export const Cards: Story = {
  args: {
    page: pageModule({
      title: "Dashboard",
      layout: { cards: true },
      sqlBlocks: [{ name: "kpi", sql: "select 1280 as revenue" }],
      default: ({ components }) => {
        const BigValue = components?.BigValue ?? "div";
        const Callout = components?.Callout ?? "div";
        return (
          <>
            <BigValue data="kpi" title="Revenue" />
            <Callout>Figures are weekly.</Callout>
          </>
        );
      },
    }),
  },
  decorators: [
    withMemoryRouter(["/"], "/"),
    withDataRuntime(
      (() => {
        const db = new FakeDuckDb();
        db.rows = [{ revenue: 1280 }] satisfies Row[];
        return db;
      })(),
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText("Revenue")).toBeVisible();
    await expect(
      canvasElement.querySelectorAll("[data-widget-card]"),
    ).toHaveLength(1);
    await expect(
      canvas.getByText("Figures are weekly.").closest("[data-widget-card]"),
    ).toBeNull();
    await expect(
      getComputedStyle(
        canvasElement.querySelector("[data-cards]") as HTMLElement,
      ).backgroundColor,
    ).toBe("rgb(250, 250, 250)");
  },
};
