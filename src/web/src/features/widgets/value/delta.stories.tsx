import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import {
  withFilteredData,
  withQueryData,
} from "../../../../.storybook/decorators";
import type { SqlBlock } from "../../pages/types";
import { Delta } from "./delta";
import type { DeltaProps } from "./types";

const KPI: SqlBlock = {
  name: "kpi",
  sql: "select revenue, wow_pct from orders",
};

const ROWS: Row[] = [{ revenue: 1234567, wow_pct: 0.052 }];

const meta = {
  title: "Widgets/Delta",
  component: Delta,
  args: { data: "kpi", column: "wow_pct", fmt: "pct1" },
} satisfies Meta<DeltaProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The DeltaDisplay root — the only element carrying `data-status`. */
const root = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector("[data-status]")!;

/** The authored shape: a positive WoW column renders `+5.2%` in the
 * good-direction color with an up arrow. */
export const Positive: Story = {
  decorators: [withQueryData([KPI], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText("+5.2%")).toBeInTheDocument();
    const el = root(canvasElement);
    await expect(el).toHaveAttribute("data-status", "positive");
    await expect(el.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  },
};

/** A negative delta keeps the sign and reads down. */
export const Negative: Story = {
  decorators: [
    withQueryData(
      [KPI],
      FakeDuckDb.withRows([{ revenue: 0, wow_pct: -0.041 }]),
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText("-4.1%")).toBeInTheDocument();
    await expect(root(canvasElement)).toHaveAttribute(
      "data-status",
      "negative",
    );
  },
};

/** `chip` renders the delta as a tinted pill. */
export const Chip: Story = {
  args: { chip: true },
  decorators: [withQueryData([KPI], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByText("+5.2%");
    await expect(root(canvasElement).className).toContain("border");
  },
};

/** `downIsGood` inverts the palette — a negative delta is the good outcome
 * (cost, latency). */
export const DownIsGood: Story = {
  args: { downIsGood: true },
  decorators: [
    withQueryData(
      [KPI],
      FakeDuckDb.withRows([{ revenue: 0, wow_pct: -0.041 }]),
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByText("-4.1%");
    await expect(root(canvasElement).className).toContain("text-emerald-");
  },
};

/** `text` captions the delta — "WoW", "vs. prior week". */
export const WithCaption: Story = {
  args: { text: "WoW" },
  decorators: [withQueryData([KPI], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("WoW")).toBeInTheDocument();
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

/** A `column` absent from the row lists the ones the query returned. The
 * shared `data`/loading/query-error faces live in `states.tsx` and are
 * covered on `<Value>`'s stories — they render identically here. */
export const UnknownColumn: Story = {
  args: { column: "delta" },
  decorators: [withQueryData([KPI], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent('"delta"');
    await expect(alert).toHaveTextContent("revenue, wow_pct");
  },
};

/** An unsupported `fmt` code names itself in the alert — validated before
 * `DeltaDisplay` formats, so it surfaces instead of crashing the page. */
export const UnknownFmt: Story = {
  args: { fmt: "bogus" },
  decorators: [withQueryData([KPI], FakeDuckDb.withRows(ROWS))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      'fmt="bogus"',
    );
  },
};

/** `filters="region"` wraps the fence's sql with the page filter's bound
 * predicate — `?region=West` seeds the filter, the West-only delta shows. */
export const Filtered: Story = {
  args: { filters: "region" },
  decorators: [
    withFilteredData([KPI], ROWS, "region", "West", [
      { revenue: 0, wow_pct: 0.052 },
    ]),
  ],
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText("+5.2%")).toBeInTheDocument();
    await expect(root(canvasElement)).toHaveAttribute(
      "data-status",
      "positive",
    );
  },
};
