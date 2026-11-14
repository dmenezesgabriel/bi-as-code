import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { FakeDuckDb } from "../data/fake-duckdb";
import { withQueryData } from "../../../.storybook/decorators";
import { SqlBlockPre } from "./sql-block";
import type { SqlBlock } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

type FenceFlags = { echo?: boolean; display?: boolean };

/** A named sql fence's code child as compile-page emits it: each flag that
 * is on arrives as an empty-string prop, an off flag is absent. */
function sqlFence(
  name: string,
  { echo = true, display = true }: FenceFlags = {},
) {
  const flags = { ...(echo && { echo: "" }), ...(display && { display: "" }) };
  return (
    <code className="language-sql" {...{ meta: name, ...flags }}>
      {ORDERS.sql}
    </code>
  );
}

const ordersDb = () =>
  FakeDuckDb.withRows([
    { region: "West", orders: 140 },
    { region: "North", orders: 120 },
  ]);

const meta: Meta<typeof SqlBlockPre> = {
  title: "Pages/SqlBlockPre",
  component: SqlBlockPre,
};

export default meta;

type Story = StoryObj<typeof SqlBlockPre>;

/** ` ```sql orders echo display ` whose query succeeded — highlighted code
 * on top, the sortable result table underneath. */
export const EchoAndDisplay: Story = {
  args: { children: sqlFence("orders") },
  decorators: [withQueryData([ORDERS], ordersDb())],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toBeVisible();
    await expect(
      canvas.getByRole("cell", { name: "West" }),
    ).toBeInTheDocument();

    // The fence result is the shared interactive table — headers sort.
    const header = canvas.getByRole("columnheader", { name: "Orders" });
    const sortButton = canvas.getByRole("button", { name: "Orders" });
    await expect(header).toHaveAttribute("aria-sort", "none");
    await userEvent.click(sortButton);
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await userEvent.click(sortButton);
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect(canvas.getAllByRole("row")[1]).toHaveTextContent("North");

    // ...and a download button under it saves the same rows.
    await expect(
      canvas.getByRole("button", { name: "Download CSV" }),
    ).toBeVisible();
  },
};

/** The query is still in flight — a skeleton stands in for the result. */
export const Loading: Story = {
  args: { children: sqlFence("orders") },
  decorators: [withQueryData([ORDERS], FakeDuckDb.pending())],
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
      FakeDuckDb.failing("Catalog Error: Table orders does not exist"),
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

/** ` ```sql orders ` with no flags — the query runs for its widgets, the
 * fence itself renders nothing. */
export const Hidden: Story = {
  args: { children: sqlFence("orders", { echo: false, display: false }) },
  decorators: [withQueryData([ORDERS], ordersDb())],
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("pre")).toBeNull();
    await expect(canvas.queryByRole("table")).toBeNull();
    await expect(canvas.queryByRole("status")).toBeNull();
  },
};

/** ` ```sql orders echo ` — the code shows, the result table does not. */
export const EchoOnly: Story = {
  args: { children: sqlFence("orders", { display: false }) },
  decorators: [withQueryData([ORDERS], ordersDb())],
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("pre")).toHaveTextContent(
      ORDERS.sql,
    );
    await expect(canvas.queryByRole("table")).toBeNull();
  },
};

/** ` ```sql orders display ` — the result table shows, the code does not. */
export const DisplayOnly: Story = {
  args: { children: sqlFence("orders", { echo: false }) },
  decorators: [withQueryData([ORDERS], ordersDb())],
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole("table")).toBeVisible();
    await expect(canvasElement.querySelector("pre")).toBeNull();
  },
};

/** A hidden fence whose query failed still shows its inline error — hiding
 * a block never hides a failure. */
export const HiddenError: Story = {
  args: { children: sqlFence("orders", { echo: false, display: false }) },
  decorators: [
    withQueryData(
      [ORDERS],
      FakeDuckDb.failing("Catalog Error: Table orders does not exist"),
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent("Table orders does not exist");
    await expect(canvasElement.querySelector("pre")).toBeNull();
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
