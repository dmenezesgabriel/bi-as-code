import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Effect } from "effect";
import { FakeDuckDb } from "../data/fake-duckdb";
import type { Row } from "../data/types";
import { withQueryData } from "../../../.storybook/decorators";
import { SqlBlockPre } from "./sql-block";
import type { SqlBlock } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

function sqlFence(name: string, sql = ORDERS.sql) {
  return (
    <code className="language-sql" {...{ meta: name }}>
      {sql}
    </code>
  );
}

const meta: Meta<typeof SqlBlockPre> = {
  title: "Pages/SqlBlockPre",
  component: SqlBlockPre,
};

export default meta;

type Story = StoryObj<typeof SqlBlockPre>;

/** A named sql fence whose query succeeded — highlighted code on top, the
 * sortable result table underneath. */
export const Success: Story = {
  args: { children: sqlFence("orders") },
  decorators: [
    withQueryData(
      [ORDERS],
      (() => {
        const db = new FakeDuckDb();
        db.rows = [
          { region: "West", orders: 140 },
          { region: "North", orders: 120 },
        ];
        return db;
      })(),
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toBeVisible();
    await expect(
      canvas.getByRole("cell", { name: "West" }),
    ).toBeInTheDocument();

    // The fence result is the shared interactive table — headers sort.
    const header = canvas.getByRole("columnheader", { name: /orders/ });
    const sortButton = canvas.getByRole("button", { name: /orders/ });
    await expect(header).toHaveAttribute("aria-sort", "none");
    await userEvent.click(sortButton);
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await userEvent.click(sortButton);
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect(canvas.getAllByRole("row")[1]).toHaveTextContent("North");
  },
};

/** The query is still in flight — a skeleton stands in for the result. */
export const Loading: Story = {
  args: { children: sqlFence("orders") },
  decorators: [
    withQueryData(
      [ORDERS],
      (() => {
        const db = new FakeDuckDb();
        db.queryRows = () => Effect.promise(() => new Promise<Row[]>(() => {}));
        return db;
      })(),
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("status")).toBeVisible();
    await expect(canvas.queryByRole("table")).toBeNull();
  },
};

/** The query failed — the error names the block inline, under the code. */
export const QueryError: Story = {
  args: { children: sqlFence("orders") },
  decorators: [
    withQueryData(
      [ORDERS],
      (() => {
        const db = new FakeDuckDb();
        db.failWhen = () => "Catalog Error: Table orders does not exist";
        return db;
      })(),
    ),
  ],
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent("orders");
    await expect(alert).toHaveTextContent("Table orders does not exist");
  },
};

/** Zero rows is a success state of its own — "0 rows" under the code. */
export const Empty: Story = {
  args: { children: sqlFence("orders") },
  decorators: [
    withQueryData(
      [ORDERS],
      (() => {
        const db = new FakeDuckDb();
        db.rows = [];
        return db;
      })(),
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("0 rows")).toBeVisible();
    await expect(canvas.queryByRole("table")).toBeNull();
  },
};

/** An unnamed sql fence is code only — no registry lookup, no result. */
export const UnnamedFence: Story = {
  args: {
    children: <code className="language-sql">select 1</code>,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("table")).toBeNull();
  },
};
