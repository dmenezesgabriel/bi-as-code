import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Effect } from "effect";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import {
  withFilteredData,
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { Column } from "./column";
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

/** A DATE column arrives as UTC-midnight `Date`s: unformatted it reads
 * `yyyy-mm-dd`, under `fmt="longdate"` with the month spelled out — the same
 * day on every viewer's clock. */
export const Dates: Story = {
  args: {
    children: [
      <Column key="ordered" id="ordered" />,
      <Column key="shipped" id="shipped" fmt="longdate" />,
    ],
  },
  decorators: [
    withQueryData(
      [ORDERS],
      fakeDb([
        {
          ordered: new Date(Date.UTC(2015, 2, 15)),
          shipped: new Date(Date.UTC(2015, 2, 18)),
        },
      ]),
    ),
  ],
  play: async ({ canvas }) => {
    const table = await canvas.findByRole("table");
    await expect(table).toHaveTextContent("2015-03-15");
    await expect(table).toHaveTextContent("March 18, 2015");
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

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=West` seeds the filter, the table shows West only. */
export const Filtered: Story = {
  args: { data: "orders", filters: "region" },
  decorators: [
    withFilteredData(
      [ORDERS],
      [
        { region: "West", orders: 140 },
        { region: "North", orders: 120 },
      ],
      "region",
      "West",
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toBeVisible();
    await expect(canvas.getAllByRole("cell", { name: "West" })).toHaveLength(1);
    await expect(canvas.queryByRole("cell", { name: "North" })).toBeNull();
  },
};

const CHANNEL_ORDERS: Row[] = [
  { region: "West", channel: "web", orders: 140 },
  { region: "West", channel: "store", orders: 60 },
  { region: "North", channel: "web", orders: 120 },
];

/** A list in `filters` narrows by every filter at once: `?region=West` and
 * `?channel=web` keep only the row that matches both. */
export const FilteredByTwo: Story = {
  args: { data: "orders", filters: ["region", "channel"] },
  decorators: [
    withQueryData(
      [ORDERS],
      FakeDuckDb.withRowsWhen(CHANNEL_ORDERS, (sql) =>
        sql.includes("region = ?") && sql.includes("channel = ?")
          ? CHANNEL_ORDERS.slice(0, 1)
          : null,
      ),
    ),
    withPageFilters(new FakeFilterUrlPort("?region=West&channel=web")),
  ],
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("cell", { name: "140" }),
    ).toBeVisible();
    await expect(canvas.getAllByRole("row")).toHaveLength(2);
    await expect(canvas.queryByRole("cell", { name: "store" })).toBeNull();
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

const REVENUE: Row[] = [
  { region: "West", revenue: 6100, share: 0.394 },
  { region: "North", revenue: 4800, share: 0.31 },
  { region: "South", revenue: 3700, share: 0.296 },
];

/** `<Column>` children show only the listed columns, in listed order, each
 * with its `fmt` and `title` — the column `region` is left out. */
export const ColumnChildren: Story = {
  args: {
    children: [
      <Column key="share" id="share" fmt="pct1" title="Share" />,
      <Column key="revenue" id="revenue" fmt="usd" title="Revenue" />,
    ],
  },
  decorators: [withQueryData([ORDERS], fakeDb(REVENUE))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toBeVisible();
    const headers = canvas.getAllByRole("columnheader");
    await expect(headers.map((th) => th.textContent)).toEqual([
      "Share",
      "Revenue",
    ]);
    await expect(canvas.getByRole("cell", { name: "$6k" })).toBeVisible();
    await expect(canvas.queryByRole("cell", { name: "West" })).toBeNull();
  },
};

/** A `<Column id>` the result lacks renders one alert naming the columns
 * that do exist. */
export const UnknownColumn: Story = {
  args: { children: [<Column key="revnue" id="revnue" />] },
  decorators: [withQueryData([ORDERS], fakeDb(REVENUE))],
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent("available: region, revenue, share");
    await expect(canvas.queryByRole("table")).toBeNull();
  },
};

/** A `fmt` the column's values cannot take renders the format error inline. */
export const BadFormat: Story = {
  args: { children: [<Column key="region" id="region" fmt="usd" />] },
  decorators: [withQueryData([ORDERS], fakeDb(REVENUE))],
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent('fmt="usd"');
  },
};
