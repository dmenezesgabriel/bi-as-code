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
