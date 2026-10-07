import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import {
  withFilteredData,
  withQueryData,
} from "../../../../.storybook/decorators";
import type { SqlBlock } from "../../pages/types";
import type { ValueProps } from "./types";
import { Value } from "./value";

const KPI: SqlBlock = {
  name: "kpi",
  sql: "select revenue, wow_pct, orders from orders",
};

const ROWS: Row[] = [{ revenue: 1234567, wow_pct: 0.052, orders: 355 }];

const meta = {
  title: "Widgets/Value",
  component: Value,
  args: { data: "kpi" },
} satisfies Meta<ValueProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: `data` names a sql fence, `column`/`fmt` dress the
 * bound cell — `$1.2M` is the auto-scaled usd preset. */
export const Success: Story = {
  args: { column: "revenue", fmt: "usd" },
  decorators: [withQueryData([KPI], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("$1.2M")).toBeInTheDocument();
  },
};

/** `column` unset picks the row's first key; `fmt` unset formats as `num`. */
export const DefaultColumnAndFmt: Story = {
  decorators: [withQueryData([KPI], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("1.2M")).toBeInTheDocument();
  },
};

/** `row` selects a different row on multi-row results. */
export const RowSelection: Story = {
  args: { column: "orders", fmt: "num0", row: 1 },
  decorators: [
    withQueryData(
      [KPI],
      FakeDuckDb.withRows([
        { revenue: 100, wow_pct: 0.01, orders: 10 },
        { revenue: 200, wow_pct: 0.02, orders: 25 },
      ]),
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("25")).toBeInTheDocument();
  },
};

/** `redNegatives` renders a negative scalar in the negative color. */
export const RedNegatives: Story = {
  args: { column: "wow_pct", fmt: "pct1", redNegatives: true },
  decorators: [
    withQueryData(
      [KPI],
      FakeDuckDb.withRows([{ revenue: 0, wow_pct: -0.041, orders: 0 }]),
    ),
  ],
  play: async ({ canvas }) => {
    const el = await canvas.findByText("-4.1%");
    await expect(el.className).toContain("text-red-");
  },
};

/** `color` styles the scalar with any CSS color. */
export const CustomColor: Story = {
  args: { column: "revenue", fmt: "usd", color: "#059669" },
  decorators: [withQueryData([KPI], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    const el = await canvas.findByText("$1.2M");
    await expect(el.style.color).toBe("rgb(5, 150, 105)");
  },
};

/** An empty result renders `–` — a param that filters everything out is not
 * an error. */
export const Empty: Story = {
  decorators: [withQueryData([KPI], FakeDuckDb.withRows([]))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("–")).toBeInTheDocument();
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

/** A `data` value no ```sql fence declares renders the named alert. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: [withQueryData([KPI], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent("ghost");
  },
};

/** A `column` absent from the row lists the ones the query returned. */
export const UnknownColumn: Story = {
  args: { column: "sales" },
  decorators: [withQueryData([KPI], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent('"sales"');
    await expect(alert).toHaveTextContent("revenue, wow_pct, orders");
  },
};

/** An unsupported `fmt` code names itself in the alert. */
export const UnknownFmt: Story = {
  args: { fmt: "bogus" },
  decorators: [withQueryData([KPI], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      'fmt="bogus"',
    );
  },
};

/** While the query is in flight the pulse stands in for the scalar. */
export const Loading: Story = {
  decorators: [withQueryData([KPI], FakeDuckDb.pending())],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("status")).toBeVisible();
  },
};

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=West` seeds the filter, the West-only cell shows. */
export const Filtered: Story = {
  args: { column: "revenue", fmt: "usd", filters: "region" },
  decorators: [
    withFilteredData([KPI], ROWS, "region", "West", [
      { revenue: 500, wow_pct: 0.052, orders: 100 },
    ]),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("$500")).toBeInTheDocument();
    await expect(canvas.queryByText("$1.2M")).toBeNull();
  },
};

/** The query's own failure surfaces inline, naming the block. */
export const QueryError: Story = {
  decorators: [
    withQueryData(
      [KPI],
      FakeDuckDb.failing("Catalog Error: Table orders does not exist"),
    ),
  ],
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent("kpi");
    await expect(alert).toHaveTextContent("does not exist");
  },
};
