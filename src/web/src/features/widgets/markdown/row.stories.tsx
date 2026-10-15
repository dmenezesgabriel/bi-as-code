import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { withQueryData } from "../../../../.storybook/decorators";
import { BigValue } from "../value/big-value";
import { dbWith, KPI, KPI_ROWS, WEEKLY } from "../value/big-value.fixture";
import { Callout } from "./callout";
import { Note } from "./note";
import { Row } from "./row";
import type { RowAlign, RowProps } from "./types";

const box = (label: string, height?: number) => (
  <div
    key={label}
    className="rounded border border-card-border p-4"
    style={height === undefined ? undefined : { height }}
  >
    {label}
  </div>
);

const meta = {
  title: "Widgets/Row",
  component: Row,
  args: {
    children: [box("Revenue"), box("Orders"), box("Accounts")],
  },
} satisfies Meta<RowProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: children share the line equally and wrap as a
 * unit below the per-child basis. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const cells = ["Revenue", "Orders", "Accounts"].map((t) =>
      canvas.getByText(t),
    );
    const row = cells[0]!.parentElement!;
    await expect(row.className).toContain("flex-wrap");
    const tops = new Set(cells.map((c) => c.getBoundingClientRect().top));
    const widths = new Set(
      cells.map((c) => Math.round(c.getBoundingClientRect().width)),
    );
    expect(tops.size).toBe(1);
    expect(widths.size).toBe(1);
  },
};

/** `align="top"` pins unequal children to the line's top edge instead of
 * stretching them to the tallest. */
export const AlignTop: Story = {
  args: {
    align: "top",
    children: [box("short"), box("tall", 160)],
  },
  play: async ({ canvas }) => {
    const row = canvas.getByText("short").parentElement!;
    await expect(row.className).toContain("items-start");
    const short = canvas.getByText("short").getBoundingClientRect();
    const tall = canvas.getByText("tall").getBoundingClientRect();
    expect(short.top).toBe(tall.top);
    expect(short.height).toBeLessThan(tall.height);
  },
};

/** `align="center"` centers children vertically on the line. */
export const AlignCenter: Story = {
  args: {
    align: "center",
    children: [box("short"), box("tall", 160)],
  },
  play: async ({ canvas }) => {
    const row = canvas.getByText("short").parentElement!;
    await expect(row.className).toContain("items-center");
    const short = canvas.getByText("short").getBoundingClientRect();
    const tall = canvas.getByText("tall").getBoundingClientRect();
    expect(short.top).toBeGreaterThan(tall.top);
  },
};

/** A container narrower than two `basis-48` children wraps the second to
 * its own full-width line. */
export const NarrowWraps: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    children: [box("first"), box("second")],
  },
  play: async ({ canvas }) => {
    const first = canvas.getByText("first").getBoundingClientRect();
    const second = canvas.getByText("second").getBoundingClientRect();
    expect(second.top).toBeGreaterThan(first.bottom);
    expect(second.width).toBeGreaterThan(340);
  },
};

/** Real widgets share the row: three `<BigValue>`s bound to a fake
 * registry render as equal thirds — the demo-page composition. */
export const Widgets: Story = {
  args: {
    children: [
      <BigValue
        key="revenue"
        data="kpi"
        column="revenue"
        title="Quarter revenue"
        fmt="usd"
      />,
      <BigValue
        key="orders"
        data="kpi"
        column="orders"
        title="Orders"
        fmt="num"
      />,
      <BigValue
        key="wow"
        data="kpi"
        column="wow_pct"
        title="WoW change"
        fmt="pct1"
      />,
    ],
  },
  decorators: [withQueryData([KPI, WEEKLY], dbWith(KPI_ROWS))],
  play: async ({ canvas }) => {
    const revenue = await canvas.findByText("$1.2M");
    const orders = await canvas.findByText("Quarter revenue");
    await expect(orders).toBeInTheDocument();
    await expect(revenue).toBeInTheDocument();
    const cells = ["Quarter revenue", "Orders", "WoW change"].map((t) =>
      canvas.getByText(t).getBoundingClientRect(),
    );
    expect(new Set(cells.map((c) => c.top)).size).toBe(1);
  },
};

/** Rows nest other markdown widgets — a `<Callout>` beside a `<Note>`. */
export const ContentMix: Story = {
  args: {
    children: [
      <Callout key="callout" type="info" title="Heads up">
        Coverage dipped below target in the South.
      </Callout>,
      <Note key="note">Trailing four-week average.</Note>,
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("note")).toBeInTheDocument();
    await expect(
      canvas.getByText("Trailing four-week average."),
    ).toBeInTheDocument();
  },
};

/** An `align` outside the schema renders the family's inline alert —
 * MDX props bypass the type system. */
export const MisuseAlign: Story = {
  args: { align: "middle" as RowAlign },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent('"middle"');
  },
};
