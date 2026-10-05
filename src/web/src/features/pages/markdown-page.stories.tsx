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
 * the fence renders its query result inline under the highlighted code. */
export const PageWithQuery: Story = {
  args: {
    page: pageModule({
      title: "With data",
      sqlBlocks: [{ name: "orders", sql: "select * from orders" }],
      default: ({ components }) => {
        const Pre = components?.pre ?? "pre";
        return (
          <Pre>
            <code className="language-sql" {...{ meta: "orders" }}>
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
