import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import { renderWithRegistry } from "../value/registry-harness";
import { ParamsBridge } from "./params-bridge";
import { lastWrittenParam } from "./select-harness";
import { Toggle } from "./toggle";
import type { ToggleProps } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

/** A `{{params.large_orders}}` consumer fence — re-runs whenever `?large_orders=` changes. */
const LARGE: SqlBlock = {
  name: "large",
  sql: "select * from orders where amount > 500 = {{params.large_orders}}",
};

interface MountOptions {
  readonly db?: FakeDuckDb;
  readonly blocks?: readonly SqlBlock[];
  readonly port?: FakeFilterUrlPort;
  readonly provider?: boolean;
  readonly consumer?: boolean;
  readonly bridge?: boolean;
}

/** A `filters=["large_orders"]` consumer probe — a `column: false` filter never reaches it. */
function LargeConsumer(): ReactElement | null {
  useFilteredQueryRows("orders", "large_orders");
  return null;
}

/** Renders `<Toggle id="large_orders" label="Large orders">`, optionally with the probes. */
function renderToggle(
  props: Partial<ToggleProps> = {},
  {
    db,
    blocks,
    port,
    provider = true,
    consumer = false,
    bridge = false,
  }: MountOptions = {},
): FakeDuckDb {
  const activePort = port ?? new FakeFilterUrlPort("");
  return renderWithRegistry(
    <>
      <Toggle id="large_orders" label="Large orders" {...props} />
      {consumer && <LargeConsumer />}
      {bridge && (
        <ParamsBridge id="large_orders" blocks={[LARGE]} port={activePort} />
      )}
    </>,
    {
      db: db ?? FakeDuckDb.withRows([]),
      blocks: blocks ?? [],
      port: provider ? activePort : undefined,
    },
  );
}

/** Mounts the widget with a fresh port at `search` and returns it for write assertions. */
function mountWithPort(
  props: Partial<ToggleProps> = {},
  search = "",
): FakeFilterUrlPort {
  const port = new FakeFilterUrlPort(search);
  renderToggle(props, { port });
  return port;
}

/** The rendered switch — `role="switch"`, named by its label. */
function switchEl(name = "Large orders"): HTMLElement {
  return screen.getByRole("switch", { name });
}

/** Waits for the `large_orders` param's last write to serialize as `expected`. */
async function expectParam(
  port: FakeFilterUrlPort,
  expected: string | null,
): Promise<void> {
  await waitFor(() =>
    expect(lastWrittenParam(port, "large_orders")).toBe(expected),
  );
}

describe("Toggle — rendering", () => {
  it("renders a switch named by label, unchecked by default", () => {
    renderToggle();
    expect(switchEl()).toHaveAttribute("aria-checked", "false");
  });

  it("labels itself titleCase(id) when label is absent", () => {
    renderToggle({ label: undefined });
    expect(switchEl("Large Orders")).toBeDefined();
  });
});

describe("Toggle — value lifecycle", () => {
  it("writes ?large_orders=true when flipped on", async () => {
    const port = mountWithPort();

    fireEvent.click(switchEl());

    await expectParam(port, "true");
    expect(switchEl()).toHaveAttribute("aria-checked", "true");
  });

  it("writes ?large_orders=false when flipped back off — never deleting the param", async () => {
    const port = mountWithPort({}, "?large_orders=true");
    expect(switchEl()).toHaveAttribute("aria-checked", "true");

    fireEvent.click(switchEl());

    await expectParam(port, "false");
    expect(switchEl()).toHaveAttribute("aria-checked", "false");
  });

  it("hydrates checked from ?large_orders=true", () => {
    mountWithPort({}, "?large_orders=true");
    expect(switchEl()).toHaveAttribute("aria-checked", "true");
  });

  it("reads a non-true param as unchecked", () => {
    mountWithPort({}, "?large_orders=yes");
    expect(switchEl()).toHaveAttribute("aria-checked", "false");
  });

  it("seeds the initialValue face without a URL write", () => {
    const port = mountWithPort({ initialValue: true });
    expect(switchEl()).toHaveAttribute("aria-checked", "true");
    expect(port.written).toHaveLength(0);
  });

  it("toggles from a click on the row's label too", async () => {
    const port = mountWithPort();

    fireEvent.click(screen.getByText("Large orders"));

    await expectParam(port, "true");
  });
});

describe("Toggle — invert", () => {
  it("shows the checked face for ?large_orders=false under invert", () => {
    mountWithPort({ invert: true }, "?large_orders=false");
    expect(switchEl()).toHaveAttribute("aria-checked", "true");
  });

  it("shows the unchecked face for ?large_orders=true under invert", () => {
    mountWithPort({ invert: true }, "?large_orders=true");
    expect(switchEl()).toHaveAttribute("aria-checked", "false");
  });

  it("flipping the checked face writes ?large_orders=true under invert", async () => {
    const port = mountWithPort({ invert: true });
    // face = held(false) XOR invert(true) → checked
    expect(switchEl()).toHaveAttribute("aria-checked", "true");

    fireEvent.click(switchEl());

    await expectParam(port, "true");
    expect(switchEl()).toHaveAttribute("aria-checked", "false");
  });
});

describe("Toggle — predicate", () => {
  it('contributes nothing to a filters=["large_orders"] consumer even with a value', async () => {
    const db = renderToggle(
      {},
      {
        port: new FakeFilterUrlPort("?large_orders=true"),
        consumer: true,
        blocks: [ORDERS],
      },
    );

    await waitFor(() => expect(db.queries.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      db.queries.filter(({ sql }) => sql.includes("where large_orders")),
    ).toHaveLength(0);
  });
});

describe("Toggle — params consumption", () => {
  it("re-queries a {{params.large_orders}} fence with the flipped boolean", async () => {
    const port = new FakeFilterUrlPort("");
    const db = renderToggle({}, { port, bridge: true });
    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select * from orders where amount > 500 = ?",
        params: [null],
      }),
    );

    fireEvent.click(switchEl());

    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select * from orders where amount > 500 = ?",
        params: [true],
      }),
    );
  });
});

describe("Toggle — degraded faces", () => {
  it("degrades to disabled without a FiltersProvider", () => {
    renderToggle({}, { provider: false });
    // A non-native `role="switch"` span reports aria-disabled, never the
    // HTML attribute.
    expect(switchEl()).toHaveAttribute("aria-disabled", "true");
  });
});
