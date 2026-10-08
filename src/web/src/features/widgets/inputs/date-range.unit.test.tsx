import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import { renderWithRegistry } from "../value/registry-harness";
import { lastWrittenParam } from "./select-harness";
import { DateRange } from "./date-range";
import type { DateRangeProps } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

/** A `filters=["ordered"]` consumer probe — the widget's predicate reaches it. */
function OrderedConsumer(): ReactElement | null {
  useFilteredQueryRows("orders", "ordered");
  return null;
}

interface MountOptions {
  readonly db?: FakeDuckDb;
  readonly port?: FakeFilterUrlPort;
  readonly provider?: boolean;
  readonly consumer?: boolean;
}

/** Renders `<DateRange id="ordered" title="Ordered">` with the optional probes. */
function renderDateRange(
  props: Partial<DateRangeProps> = {},
  { db, port, provider = true, consumer = false }: MountOptions = {},
): FakeDuckDb {
  return renderWithRegistry(
    <>
      <DateRange id="ordered" title="Ordered" {...props} />
      {consumer && <OrderedConsumer />}
    </>,
    {
      db: db ?? FakeDuckDb.withRows([]),
      blocks: [ORDERS],
      port: provider ? (port ?? new FakeFilterUrlPort("")) : undefined,
    },
  );
}

/** Mounts with a fresh port at `search` and returns it for write assertions. */
function mountWithPort(
  props: Partial<DateRangeProps> = {},
  search = "",
): FakeFilterUrlPort {
  const port = new FakeFilterUrlPort(search);
  renderDateRange(props, { port });
  return port;
}

/** The popover trigger — the only button carrying `aria-expanded`. */
function trigger(open = false): HTMLElement {
  return screen.getByRole("button", { expanded: open });
}

/** Opens the popover; queries run against `screen` since the popup portals. */
async function openPopup(): Promise<void> {
  fireEvent.click(trigger());
  await screen.findByLabelText("Start date");
}

describe("DateRange — rendering", () => {
  it("renders a labelled trigger showing the all-time face", () => {
    renderDateRange();
    expect(trigger()).toHaveTextContent("All Time");
  });

  it("labels itself titleCase(id) when title is absent", () => {
    renderDateRange({ title: undefined });
    expect(screen.getByText("Ordered")).toBeDefined();
  });

  it("renders an inline alert for an unrecognized initialValue", async () => {
    renderDateRange({ initialValue: "someday" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ordered");
    expect(alert).toHaveTextContent("someday");
  });
});

describe("DateRange — popover", () => {
  it("opens on the trigger to the preset list and the two date fields", async () => {
    renderDateRange();
    await openPopup();
    for (const label of [
      "Last 7 Days",
      "Last 30 Days",
      "Month to Date",
      "All Time",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeDefined();
    }
    expect(screen.getByLabelText("Start date")).toBeDefined();
    expect(screen.getByLabelText("End date")).toBeDefined();
  });

  it("writes the preset key and closes on a preset pick", async () => {
    const port = mountWithPort();
    await openPopup();
    fireEvent.click(screen.getByRole("button", { name: "Last 30 Days" }));
    await waitFor(() =>
      expect(lastWrittenParam(port, "ordered")).toBe("last 30 days"),
    );
    expect(trigger()).toHaveTextContent("Last 30 Days");
    await waitFor(() =>
      expect(screen.queryByLabelText("Start date")).toBeNull(),
    );
  });

  it("fills the fields with the held closed range's bounds", async () => {
    mountWithPort({}, "?ordered=2026-01-05 to 2026-02-10");
    await openPopup();
    expect(screen.getByLabelText("Start date")).toHaveValue("2026-01-05");
    expect(screen.getByLabelText("End date")).toHaveValue("2026-02-10");
  });
});

describe("DateRange — field commits", () => {
  it("writes 'X to Y' once both fields hold a date", async () => {
    const port = mountWithPort();
    await openPopup();
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-01-01" },
    });
    await waitFor(() =>
      expect(lastWrittenParam(port, "ordered")).toBe("from 2026-01-01"),
    );
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-01-31" },
    });
    await waitFor(() =>
      expect(lastWrittenParam(port, "ordered")).toBe(
        "2026-01-01 to 2026-01-31",
      ),
    );
    expect(trigger(true)).toHaveTextContent("2026-01-01 to 2026-01-31");
  });

  it("writes 'until Y' for an end-only pick", async () => {
    const port = mountWithPort();
    await openPopup();
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-01-31" },
    });
    await waitFor(() =>
      expect(lastWrittenParam(port, "ordered")).toBe("until 2026-01-31"),
    );
  });

  it("deletes the param when both fields clear", async () => {
    const port = mountWithPort({}, "?ordered=2026-01-01 to 2026-01-31");
    await openPopup();
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "" },
    });
    await waitFor(() =>
      expect(port.written.at(-1)?.searchParams.has("ordered")).toBe(false),
    );
    expect(trigger(true)).toHaveTextContent("All Time");
  });
});

describe("DateRange — value lifecycle", () => {
  it("hydrates the preset face from a seeded param", () => {
    mountWithPort({}, "?ordered=last%207%20days");
    expect(trigger()).toHaveTextContent("Last 7 Days");
  });

  it("hydrates a verbatim expression face from a seeded param", () => {
    mountWithPort({}, "?ordered=until%202026-01-31");
    expect(trigger()).toHaveTextContent("until 2026-01-31");
  });

  it("seeds initialValue without a URL write", async () => {
    const port = mountWithPort({ initialValue: "month to date" });
    expect(trigger()).toHaveTextContent("Month to Date");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(port.written).toHaveLength(0);
  });
});

describe("DateRange — predicate", () => {
  it("binds a closed range as `order_date BETWEEN ? AND ?`", async () => {
    const db = renderDateRange(
      { valueColumn: "order_date" },
      {
        port: new FakeFilterUrlPort("?ordered=2026-01-01 to 2026-01-31"),
        consumer: true,
      },
    );
    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select * from (select * from orders) where order_date BETWEEN ? AND ?",
        params: ["2026-01-01", "2026-01-31"],
      }),
    );
  });

  it("binds 'from X' as `order_date >= ?`", async () => {
    const db = renderDateRange(
      { valueColumn: "order_date" },
      {
        port: new FakeFilterUrlPort("?ordered=from 2026-01-01"),
        consumer: true,
      },
    );
    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select * from (select * from orders) where order_date >= ?",
        params: ["2026-01-01"],
      }),
    );
  });

  it("contributes no predicate for 'all time'", async () => {
    const db = renderDateRange(
      { valueColumn: "order_date" },
      { port: new FakeFilterUrlPort("?ordered=all%20time"), consumer: true },
    );
    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select * from orders",
        params: [],
      }),
    );
    expect(
      db.queries.filter(({ sql }) => sql.includes("order_date")),
    ).toHaveLength(0);
  });

  it("contributes nothing without a valueColumn — the value is params-only", async () => {
    const db = renderDateRange(
      {},
      {
        port: new FakeFilterUrlPort("?ordered=last%207%20days"),
        consumer: true,
      },
    );
    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select * from orders",
        params: [],
      }),
    );
    expect(
      db.queries.filter(({ sql }) => sql.includes("where ordered")),
    ).toHaveLength(0);
  });
});

describe("DateRange — degraded faces", () => {
  it("degrades to a disabled trigger without a FiltersProvider", () => {
    renderDateRange({}, { provider: false });
    expect(trigger()).toBeDisabled();
  });
});
