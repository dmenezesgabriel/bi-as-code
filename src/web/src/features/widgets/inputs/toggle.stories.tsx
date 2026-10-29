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
import { Toggle } from "./toggle";
import type { ToggleProps } from "./types";

/** A `{{params.large_orders}}` consumer fence — re-runs whenever `?large_orders=` changes. */
const LARGE: SqlBlock = {
  name: "large",
  sql: "select * from orders where large = {{params.large_orders}}",
};

const ALL_ORDERS: Row[] = [{ name: "small" }, { name: "large" }];
const LARGE_ORDERS: Row[] = [{ name: "large" }];

/** Serves `large`-only rows once the `?` arg binds `true` — the flip narrows the table live. */
function largeDb(): FakeDuckDb {
  const db = new FakeDuckDb();
  db.holdWhen = (_sql, params) =>
    Promise.resolve(params[0] === true ? LARGE_ORDERS : ALL_ORDERS);
  return db;
}

const meta = {
  title: "Widgets/Toggle",
  component: Toggle,
  args: { id: "large_orders", label: "Large orders" },
} satisfies Meta<ToggleProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: a labelled switch row, unchecked by default. */
export const Default: Story = {
  decorators: [withPageFilters(new FakeFilterUrlPort(""))],
  play: async ({ canvas }) => {
    const toggle = await canvas.findByRole("switch", {
      name: "Large orders",
    });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  },
};

const flipPort = new FakeFilterUrlPort("");

/** Clicking the row writes `?large_orders=true`; clicking again writes `false` — the param never deletes. */
export const FlipWritesParam: Story = {
  decorators: [withPageFilters(flipPort)],
  play: async ({ canvas }) => {
    const toggle = await canvas.findByRole("switch", {
      name: "Large orders",
    });
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(flipPort.read()?.searchParams.get("large_orders")).toBe("true"),
    );
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await userEvent.click(toggle);
    await waitFor(() =>
      expect(flipPort.read()?.searchParams.get("large_orders")).toBe("false"),
    );
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  },
};

const spacePort = new FakeFilterUrlPort("");

/** Space on the focused switch flips it — the keyboard click still toggles exactly once. */
export const KeyboardFlip: Story = {
  decorators: [withPageFilters(spacePort)],
  play: async ({ canvas }) => {
    const toggle = await canvas.findByRole("switch", {
      name: "Large orders",
    });
    toggle.focus();
    await userEvent.keyboard(" ");
    await waitFor(() =>
      expect(spacePort.read()?.searchParams.get("large_orders")).toBe("true"),
    );
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(spacePort.written).toHaveLength(1);
  },
};

/** A `?large_orders=true` link restores the checked face on first render. */
export const UrlSeeded: Story = {
  decorators: [withPageFilters(new FakeFilterUrlPort("?large_orders=true"))],
  play: async ({ canvas }) => {
    const toggle = await canvas.findByRole("switch", {
      name: "Large orders",
    });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
  },
};

const invertPort = new FakeFilterUrlPort("?large_orders=false");

/** `invert` flips the stored value: `?large_orders=false` shows the checked
 * face, and flipping it off writes `?large_orders=true`. */
export const Invert: Story = {
  args: { invert: true },
  decorators: [withPageFilters(invertPort)],
  play: async ({ canvas }) => {
    const toggle = await canvas.findByRole("switch", {
      name: "Large orders",
    });
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await userEvent.click(toggle);
    await waitFor(() =>
      expect(invertPort.read()?.searchParams.get("large_orders")).toBe("true"),
    );
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  },
};

const seedPort = new FakeFilterUrlPort("");

/** `initialValue` seeds the checked face without writing the URL. */
export const InitialValue: Story = {
  args: { initialValue: true },
  decorators: [withPageFilters(seedPort)],
  play: async ({ canvas }) => {
    const toggle = await canvas.findByRole("switch", {
      name: "Large orders",
    });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(seedPort.read()?.searchParams.has("large_orders")).toBe(false);
  },
};

const consumptionPort = new FakeFilterUrlPort("");
const consumptionDb = largeDb();

/** Flipping writes `?large_orders=true`, which a `{{params.large_orders}}`
 * fence binds as a boolean `?` arg — the table narrows live. */
export const ParamsConsumption: Story = {
  decorators: [
    withDataRuntime(consumptionDb),
    withPageFilters(consumptionPort),
  ],
  render: (args) => (
    <>
      <Toggle {...args} />
      <ParamsBridge id="large_orders" blocks={[LARGE]} port={consumptionPort}>
        <Table data="large" />
      </ParamsBridge>
    </>
  ),
  play: async ({ canvas }) => {
    const table = await canvas.findByRole("table");
    await expect(table).toHaveTextContent("small");

    const toggle = canvas.getByRole("switch", { name: "Large orders" });
    await userEvent.click(toggle);

    // The re-run resets the result to `loading` first — the table remounts,
    // so each poll must re-locate it rather than assert the stale node.
    await waitFor(() =>
      expect(canvas.getByRole("table")).not.toHaveTextContent("small"),
    );
    await waitFor(() =>
      expect(consumptionDb.queries).toContainEqual({
        sql: "select * from orders where large = ?",
        params: [true],
      }),
    );
  },
};

const seededConsumptionPort = new FakeFilterUrlPort("");

/** An `initialValue` binds the `{{params.large_orders}}` fence before any
 * flip, with no URL param — the table opens narrowed. */
export const InitialValueConsumption: Story = {
  args: { initialValue: true },
  decorators: [
    withDataRuntime(largeDb()),
    withPageFilters(seededConsumptionPort),
  ],
  render: (args) => (
    <>
      <Toggle {...args} />
      <ParamsBridge
        id="large_orders"
        blocks={[LARGE]}
        port={seededConsumptionPort}
      >
        <Table data="large" />
      </ParamsBridge>
    </>
  ),
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole("table")).not.toHaveTextContent("small"),
    );
    await expect(
      seededConsumptionPort.read()?.searchParams.has("large_orders"),
    ).toBe(false);
  },
};
