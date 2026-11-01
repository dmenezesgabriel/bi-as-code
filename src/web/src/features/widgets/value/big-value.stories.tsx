import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { BigValue } from "./big-value";
import {
  dbWith,
  filteredDbWith,
  KPI,
  KPI_ROWS,
  WEEKLY,
  WEEKLY_ROWS,
  WEST_KPI_ROWS,
} from "./big-value.fixture";
import type { BigValueProps } from "./types";

const meta = {
  title: "Widgets/BigValue",
  component: BigValue,
  args: { data: "kpi" },
} satisfies Meta<BigValueProps>;

export default meta;
type Story = StoryObj<typeof meta>;

const withData = (db: FakeDuckDb = dbWith(KPI_ROWS)) =>
  withQueryData([KPI, WEEKLY], db);

/** Single-assertion play for the alert-state stories: the alert names the
 * offending prop value; the unit tests pin the full message. */
const alertPlay =
  (want: string): Story["play"] =>
  async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(want);
  };

/** The authored KPI shape: title, `$1.2M` scalar, `▲ +5.2%` delta and a
 * 13-point sparkline bound to a second named query. */
export const Full: Story = {
  args: {
    column: "revenue",
    title: "Quarter revenue",
    fmt: "usd",
    delta: "wow_pct",
    deltaFmt: "pct1",
    text: "last week vs. prior",
    sparkline: "weekly_revenue",
  },
  decorators: [withData()],
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText("Quarter revenue"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("$1.2M")).toBeInTheDocument();
    await expect(canvas.getByText("+5.2%")).toBeInTheDocument();
    await expect(canvas.getByRole("img")).toBeInTheDocument();
  },
};

/** A bare `<BigValue>` is a formatted scalar with an optional title. */
export const ValueOnly: Story = {
  args: { column: "revenue", fmt: "usd", title: "Quarter revenue" },
  decorators: [withData()],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("$1.2M")).toBeInTheDocument();
    await expect(canvas.queryByRole("img")).toBeNull();
  },
};

/** With only `data`, the first column of the first row is shown and the
 * column's name is the title. */
export const Headline: Story = {
  decorators: [withData()],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("revenue")).toBeInTheDocument();
    await expect(canvas.getByText("1.2M")).toBeInTheDocument();
  },
};

/** `column` picks the result column; the title follows it. */
export const PickColumn: Story = {
  args: { column: "orders" },
  decorators: [withData()],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("orders")).toBeInTheDocument();
    await expect(canvas.getByText("355")).toBeInTheDocument();
  },
};

/** `row` counts from 0, so `row={1}` reads the second row. */
export const PickRow: Story = {
  args: { column: "revenue", fmt: "usd", row: 1 },
  decorators: [
    withData(
      dbWith([
        { revenue: 1234567, wow_pct: 0.052, orders: 355 },
        { revenue: 500000, wow_pct: 0.01, orders: 120 },
      ]),
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("$500k")).toBeInTheDocument();
    await expect(canvas.queryByText("$1.2M")).toBeNull();
  },
};

/** `delta` names a column of the same row; `deltaFmt` formats it. */
export const WithDelta: Story = {
  args: {
    column: "revenue",
    fmt: "usd",
    delta: "wow_pct",
    deltaFmt: "pct1",
  },
  decorators: [withData()],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("+5.2%")).toBeInTheDocument();
  },
};

/** `text` adds a caption after the change. */
export const WithCaption: Story = {
  args: { ...WithDelta.args, text: "vs. last week" },
  decorators: [withData()],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("vs. last week")).toBeInTheDocument();
  },
};

/** `showSymbol={false}` hides the arrow and keeps the signed number. */
export const NoSymbol: Story = {
  args: { ...WithDelta.args, showSymbol: false },
  decorators: [withData()],
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText("+5.2%")).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-status] svg")).toBeNull();
  },
};

/** `symbolPosition="right"` moves the arrow after the number. */
export const SymbolRight: Story = {
  args: { ...WithDelta.args, symbolPosition: "right" },
  decorators: [withData()],
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByText("+5.2%");
    const html = canvasElement.querySelector("[data-status]")!.innerHTML;
    await expect(html.indexOf("+5.2%")).toBeLessThan(html.indexOf("<svg"));
  },
};

/** A change inside `neutralRange` reads neutral: no good or bad colour. */
export const NeutralRange: Story = {
  args: { ...WithDelta.args, neutralRange: [-0.1, 0.1] },
  decorators: [withData()],
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByText("5.2%");
    await expect(canvasElement.querySelector("[data-status]")).toHaveAttribute(
      "data-status",
      "neutral",
    );
  },
};

/** `sparkline` names a second fence drawn as a small line beside the value. */
export const WithSparkline: Story = {
  args: { column: "revenue", fmt: "usd", sparkline: "weekly_revenue" },
  decorators: [withData()],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("img")).toBeInTheDocument();
  },
};

/** `sparklineX`, `sparklineY` and `sparklineType` choose the columns and mark. */
export const SparklineColumns: Story = {
  args: {
    column: "revenue",
    fmt: "usd",
    sparkline: "weekly_revenue",
    sparklineX: "week",
    sparklineY: "revenue",
    sparklineType: "area",
  },
  decorators: [withData()],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("img")).toHaveAccessibleName(
      "revenue by week",
    );
  },
};

/** `sparklineColor` takes any CSS colour, including the theme's chart colours. */
export const SparklineColor: Story = {
  args: {
    column: "revenue",
    fmt: "usd",
    sparkline: "weekly_revenue",
    sparklineColor: "var(--chart-1)",
  },
  decorators: [withData()],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("img")).toBeInTheDocument();
  },
};

/** `downIsGood` flips the sign colors — a negative reads green. */
export const DownIsGood: Story = {
  args: {
    column: "revenue",
    fmt: "usd",
    delta: "wow_pct",
    deltaFmt: "pct1",
    downIsGood: true,
  },
  decorators: [
    withData(dbWith([{ revenue: 900000, wow_pct: -0.041, orders: 300 }])),
  ],
  play: async ({ canvas }) => {
    const delta = await canvas.findByText("-4.1%");
    await expect(delta.closest("[data-status]")).toHaveAttribute(
      "data-status",
      "negative",
    );
  },
};

/** `chip` renders the delta as a tinted pill. */
export const ChipDelta: Story = {
  args: {
    column: "revenue",
    fmt: "usd",
    delta: "wow_pct",
    deltaFmt: "pct1",
    chip: true,
  },
  decorators: [withData()],
  play: async ({ canvas }) => {
    const delta = await canvas.findByText("+5.2%");
    await expect(delta.closest("[data-status]")?.className).toContain("border");
  },
};

/** `sparklineType="bar"` draws bars instead of the default line. */
export const BarSparkline: Story = {
  args: {
    column: "revenue",
    fmt: "usd",
    sparkline: "weekly_revenue",
    sparklineType: "bar",
  },
  decorators: [withData()],
  play: async ({ canvas }) => {
    const img = await canvas.findByRole("img");
    await expect(img.querySelectorAll("rect")).toHaveLength(13);
  },
};

/** An empty `kpi` result keeps the title and shows `–`, hiding the delta
 * and sparkline — a param that filters everything out is not an error. */
export const Empty: Story = {
  args: {
    column: "revenue",
    title: "Quarter revenue",
    fmt: "usd",
    delta: "wow_pct",
    sparkline: "weekly_revenue",
  },
  decorators: [withData(dbWith([], []))],
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText("Quarter revenue"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("–")).toBeInTheDocument();
    await expect(canvas.queryByRole("img")).toBeNull();
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

/** A `data` value no ```sql fence declares renders the named alert. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: [withData()],
  play: alertPlay("ghost"),
};

/** A `column` absent from the row lists the ones the query returned. */
export const UnknownColumn: Story = {
  args: { column: "sales" },
  decorators: [withData()],
  play: alertPlay('"sales"'),
};

/** An unsupported `fmt` code names itself in the alert. */
export const UnknownFmt: Story = {
  args: { column: "revenue", fmt: "bogus" },
  decorators: [withData()],
  play: alertPlay('fmt="bogus"'),
};

/** A `sparkline` name no fence declares alerts inline, value intact. */
export const UnknownSparkline: Story = {
  args: { column: "revenue", fmt: "usd", sparkline: "ghost_series" },
  decorators: [withData()],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "ghost_series",
    );
    await expect(canvas.getByText("$1.2M")).toBeInTheDocument();
  },
};

/** While the query is in flight the pulse stands in for the KPI. */
export const Loading: Story = {
  args: { column: "revenue" },
  decorators: [withData(FakeDuckDb.pending())],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("status")).toBeVisible();
  },
};

/** The query's own failure surfaces inline, naming the block. */
export const QueryError: Story = {
  args: { column: "revenue" },
  decorators: [
    withData(FakeDuckDb.failing("Catalog Error: Table orders does not exist")),
  ],
  play: alertPlay("does not exist"),
};

/** `filters={["region"]}` wraps BOTH fences — the value's and the
 * sparkline's — with the page filter's bound predicate, so the KPI narrows
 * as a unit. */
export const Filtered: Story = {
  args: {
    column: "revenue",
    title: "Quarter revenue",
    fmt: "usd",
    sparkline: "weekly_revenue",
    filters: ["region"],
  },
  decorators: [
    withQueryData(
      [KPI, WEEKLY],
      filteredDbWith(WEST_KPI_ROWS, WEEKLY_ROWS.slice(0, 5)),
    ),
    withPageFilters(new FakeFilterUrlPort("?region=West")),
  ],
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText("Quarter revenue"),
    ).toBeInTheDocument();
    await expect(await canvas.findByText("$500")).toBeInTheDocument();
    await expect(canvas.queryByText("$1.2M")).toBeNull();
    await expect(await canvas.findByRole("img")).toBeInTheDocument();
  },
};
