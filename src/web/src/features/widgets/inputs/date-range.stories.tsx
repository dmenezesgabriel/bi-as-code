import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import {
  withDataRuntime,
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { Table } from "../table/table";
import { DateRange } from "./date-range";
import { ParamsBridge } from "./params-bridge";
import type { DateRangeProps } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

const ALL_ROWS: Row[] = [
  { order_id: 1, order_date: "2026-01-05", amount: 40 },
  { order_id: 2, order_date: "2026-01-20", amount: 95 },
  { order_id: 3, order_date: "2026-02-11", amount: 60 },
];
const JANUARY_ROWS: Row[] = [
  { order_id: 1, order_date: "2026-01-05", amount: 40 },
  { order_id: 2, order_date: "2026-01-20", amount: 95 },
];

/** Serves the January rows once the `BETWEEN ? AND ?` predicate wraps the fence. */
function orderedDb(): FakeDuckDb {
  return FakeDuckDb.withRowsWhen(ALL_ROWS, (sql) =>
    sql.includes("order_date BETWEEN ? AND ?") ? JANUARY_ROWS : null,
  );
}

type Canvas = ReturnType<typeof within>;

/** The popover portals under `document.body`, outside the story canvas. */
function popup(): Canvas {
  return within(document.body);
}

/** The trigger is the only button carrying `aria-expanded`. */
function trigger(canvas: Canvas, open = false): HTMLElement {
  return canvas.getByRole("button", { expanded: open });
}

const meta = {
  title: "Widgets/DateRange",
  component: DateRange,
  args: { id: "ordered", title: "Ordered" },
} satisfies Meta<DateRangeProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: a calendar-iconed trigger reading "All Time"; opening
 * it shows the fixed preset list and the start/end date fields. */
export const Default: Story = {
  decorators: [withPageFilters(new FakeFilterUrlPort(""))],
  play: async ({ canvas }) => {
    await expect(trigger(canvas)).toHaveTextContent("All Time");
    await userEvent.click(trigger(canvas));
    for (const label of [
      "Last 7 Days",
      "Last 30 Days",
      "Month to Date",
      "All Time",
    ]) {
      await expect(
        await popup().findByRole("button", { name: label }),
      ).toBeVisible();
    }
    await expect(popup().getByLabelText("Start date")).toBeVisible();
    await expect(popup().getByLabelText("End date")).toBeVisible();
  },
};

const presetPort = new FakeFilterUrlPort("");

/** Picking "Last 30 Days" writes the range expression verbatim —
 * `?ordered=last 30 days` — so the window re-rolls from today on reload. */
export const PresetPick: Story = {
  decorators: [withPageFilters(presetPort)],
  play: async ({ canvas }) => {
    await userEvent.click(trigger(canvas));
    await userEvent.click(
      await popup().findByRole("button", { name: "Last 30 Days" }),
    );
    await waitFor(() =>
      expect(presetPort.read()?.searchParams.get("ordered")).toBe(
        "last 30 days",
      ),
    );
    await expect(trigger(canvas)).toHaveTextContent("Last 30 Days");
  },
};

const fieldPort = new FakeFilterUrlPort("");

/** The date fields commit an expression per change: a start alone writes
 * `from X`, adding an end rewrites to `'X to Y'` — the popover stays open. */
export const FieldRange: Story = {
  decorators: [withPageFilters(fieldPort)],
  play: async ({ canvas }) => {
    await userEvent.click(trigger(canvas));

    fireEvent.change(await popup().findByLabelText("Start date"), {
      target: { value: "2026-01-01" },
    });
    await waitFor(() =>
      expect(fieldPort.read()?.searchParams.get("ordered")).toBe(
        "from 2026-01-01",
      ),
    );

    fireEvent.change(popup().getByLabelText("End date"), {
      target: { value: "2026-01-31" },
    });
    await waitFor(() =>
      expect(fieldPort.read()?.searchParams.get("ordered")).toBe(
        "2026-01-01 to 2026-01-31",
      ),
    );
    await expect(trigger(canvas, true)).toHaveTextContent(
      "2026-01-01 to 2026-01-31",
    );
  },
};

/** A `?ordered=last 7 days` link restores the preset face on first render. */
export const UrlSeeded: Story = {
  decorators: [
    withPageFilters(new FakeFilterUrlPort("?ordered=last%207%20days")),
  ],
  play: async ({ canvas }) => {
    await expect(trigger(canvas)).toHaveTextContent("Last 7 Days");
  },
};

const initialPort = new FakeFilterUrlPort("");

/** `initialValue` seeds the face without writing the URL. */
export const InitialValue: Story = {
  args: { initialValue: "month to date" },
  decorators: [withPageFilters(initialPort)],
  play: async ({ canvas }) => {
    await expect(trigger(canvas)).toHaveTextContent("Month to Date");
    await expect(initialPort.read()?.searchParams.has("ordered")).toBe(false);
  },
};

const consumptionPort = new FakeFilterUrlPort("");
const consumptionDb = orderedDb();

/** With `valueColumn` set, a picked preset predicates a `filters=["ordered"]`
 * table — `order_date BETWEEN ? AND ?` binds the resolved ISO bounds. */
export const PredicateConsumption: Story = {
  args: { valueColumn: "order_date" },
  decorators: [
    withQueryData([ORDERS], consumptionDb),
    withPageFilters(consumptionPort),
  ],
  render: (args) => (
    <>
      <DateRange {...args} />
      <Table data="orders" filters="ordered" />
    </>
  ),
  play: async ({ canvas }) => {
    const table = await canvas.findByRole("table");
    await expect(table).toHaveTextContent("2026-02-11");

    await userEvent.click(trigger(canvas));
    fireEvent.change(await popup().findByLabelText("Start date"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(popup().getByLabelText("End date"), {
      target: { value: "2026-01-31" },
    });

    // The re-run resets the result to `loading` first — the table remounts,
    // so each poll must re-locate it rather than assert the stale node.
    await waitFor(() =>
      expect(canvas.getByRole("table")).not.toHaveTextContent("2026-02-11"),
    );
    await waitFor(() =>
      expect(consumptionDb.queries).toContainEqual({
        sql: "select * from (select * from orders) where order_date BETWEEN ? AND ?",
        params: ["2026-01-01", "2026-01-31"],
      }),
    );
  },
};

const wordsPort = new FakeFilterUrlPort("");
const WORDS: SqlBlock = {
  name: "words",
  sql: "select {{params.ordered}}::varchar as chosen_words",
};

/** A fence reads the pick itself as `{{params.ordered}}`: the words, with no `valueColumn` to narrow on. */
export const WordsConsumption: Story = {
  args: { initialValue: "last 30 days" },
  decorators: [
    withDataRuntime(FakeDuckDb.withRows([{ chosen_words: "last 30 days" }])),
    withPageFilters(wordsPort),
  ],
  render: (args) => (
    <>
      <DateRange {...args} />
      <ParamsBridge id="ordered" blocks={[WORDS]} port={wordsPort}>
        <Table data="words" />
      </ParamsBridge>
    </>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toHaveTextContent(
      "last 30 days",
    );
  },
};
