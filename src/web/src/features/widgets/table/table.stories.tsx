import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Effect } from "effect";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { withQueryData } from "../../../../.storybook/decorators";
import { Table } from "./table";
import type { TableProps } from "./types";
import type { SqlBlock } from "../../pages/types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

/** Twenty rows so the default pageSize of 10 produces a two-page pager. */
function fakeDb(rows: Row[]): FakeDuckDb {
  const db = new FakeDuckDb();
  db.rows = rows;
  return db;
}

const meta = {
  title: "Widgets/Table",
  component: Table,
  args: { data: "orders" },
} satisfies Meta<TableProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: `data` names a sql fence, the registry result
 * renders sortable and paginated. */
export const Success: Story = {
  decorators: [
    withQueryData(
      [ORDERS],
      fakeDb(
        Array.from({ length: 20 }, (_, i) => ({
          region: `Region ${i + 1}`,
          orders: 200 - i * 7,
        })),
      ),
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toBeVisible();
    await expect(canvas.getByText("Page 1 of 2 · 20 rows")).toBeInTheDocument();
  },
};

/** A `data` value no ```sql fence declares renders the named alert —
 * the page around it is untouched. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: [withQueryData([ORDERS], fakeDb([{ n: 1 }]))],
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent("ghost");
    await expect(canvas.queryByRole("table")).toBeNull();
  },
};

/** While the query is in flight the skeleton stands in for the table. */
export const Loading: Story = {
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

/** The query's own failure surfaces inline, naming the block. */
export const QueryError: Story = {
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
    await expect(alert).toHaveTextContent("does not exist");
  },
};

/** `pageSize` is author-controlled: four rows a page over a 6-row result. */
export const SmallPageSize: Story = {
  args: { data: "orders", pageSize: 4 },
  decorators: [
    withQueryData(
      [ORDERS],
      fakeDb(Array.from({ length: 6 }, (_, i) => ({ n: i + 1 }))),
    ),
  ],
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText("Page 1 of 2 · 6 rows"),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await expect(canvas.getByText("Page 2 of 2 · 6 rows")).toBeVisible();
  },
};
