import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import {
  withDataRuntime,
  withPageFilters,
} from "../../../../.storybook/decorators";
import { Table } from "../table/table";
import { ParamsBridge } from "./params-bridge";
import { TextInput } from "./text-input";
import type { TextInputProps } from "./types";

/** A `{{params.q}}` consumer fence — re-runs whenever `?q=` changes. */
const HITS: SqlBlock = {
  name: "hits",
  sql: "select * from orders where name ilike {{params.q}}",
};

const ALL_ORDERS: Row[] = [{ name: "north" }, { name: "south" }];
const NORTH_ORDERS: Row[] = [{ name: "north" }];

/** Serves `north`-only rows once the `?` arg binds `"north"` — the param narrows the table live. */
function hitsDb(): FakeDuckDb {
  const db = new FakeDuckDb();
  db.holdWhen = (_sql, params) =>
    Promise.resolve(params[0] === "north" ? NORTH_ORDERS : ALL_ORDERS);
  return db;
}

const meta = {
  title: "Widgets/TextInput",
  component: TextInput,
  args: { id: "q", title: "Search" },
} satisfies Meta<TextInputProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: a titled field with the default placeholder. */
export const Default: Story = {
  decorators: [withPageFilters(new FakeFilterUrlPort(""))],
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("textbox", { name: "Search" });
    await expect(input).toHaveAttribute("placeholder", "Enter text...");
    await expect(input).toHaveValue("");
  },
};

const commitPort = new FakeFilterUrlPort("");

/** Typing writes `?q=` only after the debounce settles — one write, not one per keystroke. */
export const DebouncedCommit: Story = {
  decorators: [withPageFilters(commitPort)],
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("textbox", { name: "Search" });
    await userEvent.type(input, "north");
    await waitFor(() =>
      expect(commitPort.read()?.searchParams.get("q")).toBe("north"),
    );
  },
};

const clearPort = new FakeFilterUrlPort("?q=north");

/** Clearing the field commits `undefined` — the param is deleted, not parked empty. */
export const ClearDeletesParam: Story = {
  decorators: [withPageFilters(clearPort)],
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("textbox", { name: "Search" });
    await expect(input).toHaveValue("north");
    await userEvent.clear(input);
    await waitFor(() =>
      expect(clearPort.read()?.searchParams.has("q")).toBe(false),
    );
  },
};

/** A `?q=` link restores the field on first render. */
export const UrlSeeded: Story = {
  decorators: [withPageFilters(new FakeFilterUrlPort("?q=north%20wind"))],
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("textbox", { name: "Search" });
    await expect(input).toHaveValue("north wind");
  },
};

const seedPort = new FakeFilterUrlPort("");

/** `initialValue` seeds the field without writing the URL. */
export const InitialValue: Story = {
  args: { initialValue: "north" },
  decorators: [withPageFilters(seedPort)],
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("textbox", { name: "Search" });
    await expect(input).toHaveValue("north");
    await expect(seedPort.read()?.searchParams.has("q")).toBe(false);
  },
};

const consumptionPort = new FakeFilterUrlPort("");
const consumptionDb = hitsDb();

/** The committed `?q=` re-queries a `{{params.q}}` fence — the input's only
 * consumer surface — narrowing the table to the matching row. */
export const ParamsConsumption: Story = {
  decorators: [
    withDataRuntime(consumptionDb),
    withPageFilters(consumptionPort),
  ],
  render: (args) => (
    <>
      <TextInput {...args} />
      <ParamsBridge id="q" blocks={[HITS]} port={consumptionPort}>
        <Table data="hits" />
      </ParamsBridge>
    </>
  ),
  play: async ({ canvas }) => {
    const table = await canvas.findByRole("table");
    await expect(table).toHaveTextContent("south");

    const input = canvas.getByRole("textbox", { name: "Search" });
    await userEvent.type(input, "north");
    await userEvent.tab();

    // The re-run resets the result to `loading` first — the table remounts,
    // so each poll must re-locate it rather than assert the stale node.
    await waitFor(() =>
      expect(canvas.getByRole("table")).not.toHaveTextContent("south"),
    );
    await waitFor(() =>
      expect(consumptionDb.queries).toContainEqual({
        sql: "select * from orders where name ilike ?",
        params: ["north"],
      }),
    );
  },
};

const seededConsumptionPort = new FakeFilterUrlPort("");

/** An `initialValue` binds the `{{params.q}}` fence before the reader
 * types, with no URL param — the table opens on the matching row. */
export const InitialValueConsumption: Story = {
  args: { initialValue: "north" },
  decorators: [
    withDataRuntime(hitsDb()),
    withPageFilters(seededConsumptionPort),
  ],
  render: (args) => (
    <>
      <TextInput {...args} />
      <ParamsBridge id="q" blocks={[HITS]} port={seededConsumptionPort}>
        <Table data="hits" />
      </ParamsBridge>
    </>
  ),
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole("table")).toHaveTextContent("north"),
    );
    await expect(canvas.getByRole("table")).not.toHaveTextContent("south");
    await expect(seededConsumptionPort.read()?.searchParams.has("q")).toBe(
      false,
    );
  },
};

/** `placeholder` replaces the default hint the empty field shows. */
export const CustomPlaceholder: Story = {
  args: { placeholder: "e.g. Biscoe" },
  decorators: [withPageFilters(new FakeFilterUrlPort(""))],
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("textbox", { name: "Search" });
    await expect(input).toHaveAttribute("placeholder", "e.g. Biscoe");
  },
};
