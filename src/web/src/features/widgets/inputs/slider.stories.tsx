import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import {
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { expectAlert, type StoryCanvas } from "./input-stories.fixture";
import { Slider } from "./slider";
import type { SliderProps } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

const AMOUNTS: Row[] = [
  { amount: 12 },
  { amount: 48 },
  { amount: 30 },
  { amount: null },
];

/** The query-backed decoration most stories share — fresh fakes per call. */
function amountDecorators(search?: string): Decorator[] {
  return [
    withQueryData([ORDERS], FakeDuckDb.withRows(AMOUNTS)),
    withPageFilters(new FakeFilterUrlPort(search)),
  ];
}

/** The one-value face: the value and its note, and no slider role. */
async function expectPinnedReadout(
  canvas: StoryCanvas,
  value: string,
): Promise<void> {
  await expect(
    await canvas.findByText("only one value in range"),
  ).toBeVisible();
  await expect(canvas.getByText(value)).toBeVisible();
  await expect(canvas.queryByRole("slider")).toBeNull();
}

const meta = {
  title: "Widgets/Slider",
  component: Slider,
  args: { id: "amount", data: "orders", valueColumn: "amount" },
} satisfies Meta<SliderProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: `data` names a sql fence, the bounds derive from its
 * `amount` column, and the thumb seeds at the min without touching the URL. */
export const Success: Story = {
  args: { title: "Amount" },
  decorators: amountDecorators(),
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("slider", { name: "Amount" });
    await expect(input).toHaveAttribute("min", "12");
    await expect(input).toHaveAttribute("max", "48");
    await expect(input).toHaveAttribute("aria-valuenow", "12");
  },
};

const stepPort = new FakeFilterUrlPort("?amount=30");

/** ArrowRight steps the URL-seeded value and writes `?amount=<n>` live. */
export const KeyboardStep: Story = {
  args: { title: "Amount" },
  decorators: [
    withQueryData([ORDERS], FakeDuckDb.withRows(AMOUNTS)),
    withPageFilters(stepPort),
  ],
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("slider", { name: "Amount" });
    await expect(input).toHaveAttribute("aria-valuenow", "30");
    input.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(input).toHaveAttribute("aria-valuenow", "31");
    await expect(stepPort.read()?.searchParams.get("amount")).toBe("31");
  },
};

const pagePort = new FakeFilterUrlPort("?amount=2700");

/** Page Up and Shift+ArrowRight jump a tenth of the range in whole steps —
 * 400 on a 2500–6500 slider with a step of 100. */
export const KeyboardPage: Story = {
  args: {
    title: "Amount",
    data: undefined,
    valueColumn: undefined,
    min: 2500,
    max: 6500,
    step: 100,
  },
  decorators: [withPageFilters(pagePort)],
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("slider", { name: "Amount" });
    await expect(input).toHaveAttribute("aria-valuenow", "2700");
    input.focus();
    await userEvent.keyboard("{PageUp}");
    await expect(input).toHaveAttribute("aria-valuenow", "3100");
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    await expect(input).toHaveAttribute("aria-valuenow", "3500");
    await expect(pagePort.read()?.searchParams.get("amount")).toBe("3500");
  },
};

const rangePort = new FakeFilterUrlPort("?amount=10 - 40");

/** `range` mounts a two-thumb `lo - hi` selection; stepping the Maximum
 * thumb rewrites the pair param. */
export const Range: Story = {
  args: { title: "Amount", range: true, min: 0, max: 100 },
  decorators: [
    withQueryData([ORDERS], FakeDuckDb.withRows(AMOUNTS)),
    withPageFilters(rangePort),
  ],
  play: async ({ canvas }) => {
    const min = await canvas.findByRole("slider", { name: "Minimum" });
    const max = canvas.getByRole("slider", { name: "Maximum" });
    await expect(min).toHaveAttribute("aria-valuenow", "10");
    await expect(max).toHaveAttribute("aria-valuenow", "40");
    max.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(rangePort.read()?.searchParams.get("amount")).toBe("10 - 39");
  },
};

/** `min`/`max`/`step` without `data` — static bounds, no fence needed. */
export const StaticBounds: Story = {
  args: {
    data: undefined,
    valueColumn: undefined,
    min: 0,
    max: 1000,
    step: 10,
  },
  decorators: amountDecorators(),
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("slider");
    await expect(input).toHaveAttribute("min", "0");
    await expect(input).toHaveAttribute("max", "1000");
    await expect(input).toHaveAttribute("step", "10");
  },
};

/** A `?amount=500` link clamps into the loaded bounds and the param rewrites. */
export const ClampedUrlValue: Story = {
  decorators: amountDecorators("?amount=500"),
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("slider");
    await expect(input).toHaveAttribute("aria-valuenow", "48");
  },
};

/** `filters` cascades another page filter into the bounds source — a
 * `?channel=web` param narrows the rows to one, collapsing the bounds to a
 * point the input states as text instead of a slider. */
export const CascadedBounds: Story = {
  args: { filters: "channel" },
  decorators: [
    withQueryData(
      [ORDERS],
      FakeDuckDb.withRowsWhen(AMOUNTS, (sql) =>
        sql.includes("where channel = ?") ? [{ amount: 20 }] : null,
      ),
    ),
    withPageFilters(new FakeFilterUrlPort("?channel=web")),
  ],
  play: async ({ canvas }) => {
    await expectPinnedReadout(canvas, "20");
  },
};

/** Author-pinned `min={40} max={40}` — equal bounds take the same readout
 * whatever produced them. */
export const PinnedByProps: Story = {
  args: { data: undefined, valueColumn: undefined, min: 40, max: 40 },
  decorators: amountDecorators(),
  play: async ({ canvas }) => {
    await expectPinnedReadout(canvas, "40");
  },
};

/** While the bounds query is in flight the thumb is disabled. */
export const Loading: Story = {
  decorators: [
    withQueryData([ORDERS], FakeDuckDb.pending()),
    withPageFilters(new FakeFilterUrlPort("?amount=30")),
  ],
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("slider");
    await expect(input).toBeDisabled();
  },
};

/** A `data` value no sql fence declares renders the named alert — the page
 * around it is untouched. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: amountDecorators(),
  play: async ({ canvas }) => {
    await expectAlert(canvas, "ghost", "no sql fence");
    await expect(canvas.queryByRole("slider")).toBeNull();
  },
};

/** The query's own failure surfaces inline, naming the block. */
export const QueryError: Story = {
  decorators: [
    withQueryData(
      [ORDERS],
      FakeDuckDb.failing("Catalog Error: Table orders does not exist"),
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    await expectAlert(canvas, "orders", "does not exist");
  },
};

/** `data` without `valueColumn` is an authoring error, surfaced inline. */
export const MissingValueColumn: Story = {
  args: { valueColumn: undefined },
  decorators: amountDecorators(),
  play: async ({ canvas }) => {
    await expectAlert(canvas, "valueColumn");
  },
};
