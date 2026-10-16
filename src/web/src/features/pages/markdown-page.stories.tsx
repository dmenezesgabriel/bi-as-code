import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
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
