import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import {
  withFilteredData,
  withQueryData,
} from "../../../../.storybook/decorators";
import type { SqlBlock } from "../../pages/types";
import { Sparkline } from "./sparkline-widget";
import type { SparklineProps } from "./types";

const TREND: SqlBlock = {
  name: "weekly_revenue",
  sql: "select week, revenue from orders group by week order by week",
};

/** Thirteen weeks of revenue — the demo series shape. */
const ROWS: Row[] = [
  980, 1024, 1108, 1051, 1180, 1220, 1175, 1261, 1309, 1288, 1342, 1410, 1488,
].map((revenue, i) => ({ week: i + 1, revenue }));

const meta = {
  title: "Widgets/Sparkline",
  component: Sparkline,
  args: { data: "weekly_revenue" },
} satisfies Meta<SparklineProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: `data` names a sql fence whose rows are the series —
 * x/y default to the first two columns. */
export const Line: Story = {
  decorators: [withQueryData([TREND], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    const svg = await canvas.findByRole("img");
    await expect(svg).toHaveAttribute("aria-label", "weekly_revenue");
    const d = svg.querySelector("path")!.getAttribute("d")!;
    await expect(d.split("L")).toHaveLength(ROWS.length);
  },
};

/** `type="bar"` draws one rect per row anchored at the baseline. */
export const Bar: Story = {
  args: { type: "bar" },
  decorators: [withQueryData([TREND], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    const svg = await canvas.findByRole("img");
    await expect(svg.querySelectorAll("rect")).toHaveLength(ROWS.length);
  },
};

/** `type="area"` shades to the baseline under the same line. */
export const Area: Story = {
  args: { type: "area" },
  decorators: [withQueryData([TREND], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    const svg = await canvas.findByRole("img");
    await expect(svg.querySelectorAll("path")).toHaveLength(2);
  },
};

/** Named `x`/`y` columns land in the aria-label as "{y} by {x}". */
export const NamedAxes: Story = {
  args: { x: "week", y: "revenue" },
  decorators: [withQueryData([TREND], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    const svg = await canvas.findByRole("img");
    await expect(svg).toHaveAttribute("aria-label", "revenue by week");
  },
};

/** `color` overrides the muted default — any CSS color works. */
export const CustomColor: Story = {
  args: { color: "#059669" },
  decorators: [withQueryData([TREND], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    const svg = await canvas.findByRole("img");
    const span = svg.parentElement as HTMLElement;
    await expect(span.style.color).toBe("rgb(5, 150, 105)");
  },
};

/** An empty result renders `–` — a param that filters everything out is not
 * an error. */
export const Empty: Story = {
  decorators: [withQueryData([TREND], FakeDuckDb.withRows([]))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("–")).toBeInTheDocument();
    await expect(canvas.queryByRole("img")).toBeNull();
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

/** An `x`/`y` absent from the rows lists the ones the query returned. The
 * shared `data`/loading/query-error faces live in `states.tsx` and are
 * covered on `<Value>`'s stories — they render identically here. */
export const UnknownColumn: Story = {
  args: { y: "sales" },
  decorators: [withQueryData([TREND], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent('"sales"');
    await expect(alert).toHaveTextContent("week, revenue");
  },
};

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=West` seeds the filter, the series narrows to the
 * West-only weeks. */
export const Filtered: Story = {
  args: { filters: "region" },
  decorators: [
    withFilteredData([TREND], ROWS, "region", "West", ROWS.slice(0, 5)),
  ],
  play: async ({ canvas }) => {
    const svg = await canvas.findByRole("img");
    const d = svg.querySelector("path")!.getAttribute("d")!;
    await expect(d.split("L")).toHaveLength(5);
  },
};
