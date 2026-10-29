import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import { usePageFilter } from "../../filters/use-page-filter";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import { renderWithRegistry } from "../value/registry-harness";
import { FIELD_LABEL_TEXT } from "./field-line";
import { Slider } from "./slider";
import type { SliderProps } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

const AMOUNTS: Row[] = [
  { amount: 12, region: "West" },
  { amount: 48, region: "North" },
  { amount: 30, region: "West" },
  { amount: null, region: "East" },
];

/**
 * A `filters=["amount"]` consumer probe — the slider's predicate reaches
 * this wrapped query when it contributes one.
 */
function AmountConsumer(): ReactElement | null {
  useFilteredQueryRows("orders", "amount");
  return null;
}

/**
 * A stand-in region input — "Pick West" sets the `region` filter the
 * slider's `filters` cascade consumes, "Clear region" unsets it.
 */
function RegionPicker(): ReactElement {
  const region = usePageFilter<string>("region");
  return (
    <>
      <button onClick={() => region && (region.value = "West")}>
        Pick West
      </button>
      <button onClick={() => region && (region.value = undefined)}>
        Clear region
      </button>
    </>
  );
}

interface MountOptions {
  readonly db?: FakeDuckDb;
  readonly blocks?: readonly SqlBlock[];
  readonly port?: FakeFilterUrlPort;
  readonly provider?: boolean;
  readonly consumer?: boolean;
  readonly regionPicker?: boolean;
}

/** Renders `<Slider id="amount">` bound to the `orders` fence, optionally with the consumer probe. */
function renderSlider(
  props: Partial<SliderProps> = {},
  {
    db,
    blocks,
    port,
    provider = true,
    consumer = false,
    regionPicker = false,
  }: MountOptions = {},
): FakeDuckDb {
  return renderWithRegistry(
    <>
      <Slider id="amount" data="orders" valueColumn="amount" {...props} />
      {consumer && <AmountConsumer />}
      {regionPicker && <RegionPicker />}
    </>,
    {
      db: db ?? FakeDuckDb.withRows(AMOUNTS),
      blocks: blocks ?? [ORDERS],
      port: provider ? (port ?? new FakeFilterUrlPort("")) : undefined,
    },
  );
}

/**
 * Asserts no wrapped `orders` query carries `fragment` — the slider
 * contributed no predicate. A beat of real time lets an in-flight wrapped
 * query land before the check.
 */
async function expectNoAmountPredicate(
  db: FakeDuckDb,
  fragment: string,
): Promise<void> {
  await waitFor(() => expect(db.queries.length).toBeGreaterThan(0));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(db.queries.filter(({ sql }) => sql.includes(fragment))).toHaveLength(
    0,
  );
}

/** The single-mode thumb's range input. */
function thumb(name = "Amount"): HTMLElement {
  return screen.getByRole("slider", { name });
}

function thumbs(): HTMLElement[] {
  return screen.getAllByRole("slider");
}

/**
 * Asserts the one-value face: the label, `value` stated once, the note, and
 * no slider role — nothing can be slid.
 */
async function expectPinnedReadout(value: string): Promise<void> {
  expect(await screen.findByText("only one value in range")).toBeVisible();
  expect(screen.getByText("Amount")).toBeVisible();
  expect(screen.getAllByText(value)).toHaveLength(1);
  expect(screen.queryByRole("slider")).toBeNull();
}

describe("Slider — field", () => {
  it("sets its label in the filter bar's label type", async () => {
    renderSlider();

    await screen.findByRole("slider", { name: "Amount" });
    expect(screen.getByText("Amount")).toHaveClass(FIELD_LABEL_TEXT);
  });

  it("keeps the label type when the domain pins to one value", async () => {
    renderSlider({ data: undefined, valueColumn: undefined, min: 40, max: 40 });

    await expectPinnedReadout("40");
    expect(screen.getByText("Amount")).toHaveClass(FIELD_LABEL_TEXT);
  });
});

describe("Slider — bounds source", () => {
  it("derives min/max from the fence's valueColumn rows", async () => {
    renderSlider();
    const input = await waitFor(() => thumb());
    await waitFor(() => expect(input).toHaveAttribute("min", "12"));
    expect(input).toHaveAttribute("max", "48");
  });

  it("lets static min/max props override the queried bounds", async () => {
    renderSlider({ min: 0, max: 100 });
    const input = await waitFor(() => thumb());
    await waitFor(() => expect(input).toHaveAttribute("min", "0"));
    expect(input).toHaveAttribute("max", "100");
  });

  it("falls back to 0/100 with no data and no props", async () => {
    renderSlider({ data: undefined, valueColumn: undefined }, { blocks: [] });
    const input = await waitFor(() => thumb());
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "100");
  });

  it("narrows the bounds source through the filters prop", async () => {
    const db = new FakeDuckDb();
    db.rowsWhen = (sql) =>
      sql.includes("where region = ?") ? [{ amount: 99 }] : AMOUNTS;
    renderSlider(
      { filters: "region" },
      { db, port: new FakeFilterUrlPort("?region=West") },
    );

    // A single-row cascade collapses the bounds to a point — the slider
    // states the one value rather than erroring.
    await expectPinnedReadout("99");
    expect(db.queries).toContainEqual({
      sql: "select * from (select * from orders) where region = ?",
      params: ["West"],
    });
  });
});

describe("Slider — one-value domain", () => {
  let warn: MockInstance<typeof console.warn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it("renders a readout, not a slider, for author-pinned bounds", async () => {
    renderSlider({ data: undefined, valueColumn: undefined, min: 40, max: 40 });

    await expectPinnedReadout("40");
    expect(warn).not.toHaveBeenCalled();
  });

  it("states the value once in range mode", async () => {
    renderSlider({
      data: undefined,
      valueColumn: undefined,
      min: 40,
      max: 40,
      range: true,
    });

    await expectPinnedReadout("40");
    expect(warn).not.toHaveBeenCalled();
  });

  it("seeds the pinned value silently — no URL write, no predicate", async () => {
    const port = new FakeFilterUrlPort("");
    const db = renderSlider(
      { min: 40, max: 40, range: true },
      { port, consumer: true },
    );

    await expectPinnedReadout("40");
    await expectNoAmountPredicate(db, "where amount");
    expect(port.written).toHaveLength(0);
  });
});

describe("Slider — value lifecycle", () => {
  it("seeds the min bound without writing the URL", async () => {
    const port = new FakeFilterUrlPort("");
    renderSlider({}, { port });

    await waitFor(() => expect(thumb()).toHaveAttribute("aria-valuenow", "12"));
    expect(port.written).toHaveLength(0);
  });

  it("seeds [min, max] in range mode without writing the URL", async () => {
    const port = new FakeFilterUrlPort("");
    renderSlider({ range: true }, { port });

    await waitFor(() => expect(thumbs()).toHaveLength(2));
    expect(port.written).toHaveLength(0);
  });

  it("writes ?amount=<n> on a keyboard step", async () => {
    const port = new FakeFilterUrlPort("?amount=30");
    renderSlider({ min: 0, max: 100 }, { port });

    const input = await waitFor(() => thumb());
    fireEvent.keyDown(input, { key: "ArrowRight" });

    await waitFor(() =>
      expect(port.written.at(-1)?.searchParams.get("amount")).toBe("31"),
    );
    expect(input).toHaveAttribute("aria-valuenow", "31");
  });

  it("writes ?amount=lo - hi on a range thumb step", async () => {
    const port = new FakeFilterUrlPort("?amount=10 - 40");
    renderSlider({ range: true, min: 0, max: 100 }, { port });

    const maxThumb = await waitFor(() =>
      screen.getByRole("slider", { name: "Maximum" }),
    );
    fireEvent.keyDown(maxThumb, { key: "ArrowLeft" });

    await waitFor(() =>
      expect(port.written.at(-1)?.searchParams.get("amount")).toBe("10 - 39"),
    );
  });

  it("pages by a tenth of the range in whole steps on Page Up and Shift+Arrow", async () => {
    const port = new FakeFilterUrlPort("?amount=2700");
    renderSlider({ min: 2500, max: 6500, step: 100 }, { port });

    const input = await waitFor(() => thumb());
    fireEvent.keyDown(input, { key: "PageUp" });
    await waitFor(() =>
      expect(port.written.at(-1)?.searchParams.get("amount")).toBe("3100"),
    );
    fireEvent.keyDown(input, { key: "ArrowRight", shiftKey: true });

    await waitFor(() =>
      expect(port.written.at(-1)?.searchParams.get("amount")).toBe("3500"),
    );
    expect(input).toHaveAttribute("aria-valuenow", "3500");
  });

  it("pages a range thumb down on Page Down", async () => {
    const port = new FakeFilterUrlPort("?amount=2500 - 6500");
    renderSlider({ range: true, min: 2500, max: 6500, step: 100 }, { port });

    const maxThumb = await waitFor(() =>
      screen.getByRole("slider", { name: "Maximum" }),
    );
    fireEvent.keyDown(maxThumb, { key: "PageDown" });

    await waitFor(() =>
      expect(port.written.at(-1)?.searchParams.get("amount")).toBe(
        "2500 - 6100",
      ),
    );
  });

  it("restores a URL-seeded value on first render", async () => {
    renderSlider({}, { port: new FakeFilterUrlPort("?amount=33") });
    await waitFor(() => expect(thumb()).toHaveAttribute("aria-valuenow", "33"));
  });

  it("clamps an out-of-bounds URL value and rewrites the param", async () => {
    const port = new FakeFilterUrlPort("?amount=500");
    renderSlider({}, { port });

    await waitFor(() =>
      expect(port.written.at(-1)?.searchParams.get("amount")).toBe("48"),
    );
    await waitFor(() => expect(thumb()).toHaveAttribute("aria-valuenow", "48"));
  });

  it("keeps an out-of-bounds URL value while bounds are pending", async () => {
    const port = new FakeFilterUrlPort("?amount=500");
    renderSlider({}, { db: FakeDuckDb.pending(), port });

    await waitFor(() => expect(thumb()).toBeDisabled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(port.written).toHaveLength(0);
  });

  it("re-seeds the full extent when a cascade-narrowed extent widens back", async () => {
    const db = new FakeDuckDb();
    db.rowsWhen = (sql) =>
      sql.includes("where region = ?")
        ? AMOUNTS.filter(({ region }) => region === "West")
        : AMOUNTS;
    renderSlider(
      { range: true, filters: "region" },
      { db, regionPicker: true },
    );
    const maxThumb = () => screen.getByRole("slider", { name: "Maximum" });
    await waitFor(() =>
      expect(maxThumb()).toHaveAttribute("aria-valuenow", "48"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Pick West" }));
    await waitFor(() =>
      expect(maxThumb()).toHaveAttribute("aria-valuenow", "30"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear region" }));

    // The narrowed pair was a silent display clamp, never an authored
    // selection — so the thumbs follow the bounds back out.
    await waitFor(() => expect(maxThumb()).toHaveAttribute("max", "48"));
    await waitFor(() =>
      expect(maxThumb()).toHaveAttribute("aria-valuenow", "48"),
    );
  });

  it("restores a clamped URL window, param included, when bounds widen back", async () => {
    const db = new FakeDuckDb();
    db.rowsWhen = (sql) =>
      sql.includes("where region = ?")
        ? AMOUNTS.filter(({ region }) => region === "West")
        : AMOUNTS;
    const port = new FakeFilterUrlPort("?amount=20 - 40");
    renderSlider(
      { range: true, filters: "region" },
      { db, port, regionPicker: true },
    );
    const amountParam = () => port.written.at(-1)?.searchParams.get("amount");

    fireEvent.click(await screen.findByRole("button", { name: "Pick West" }));
    await waitFor(() => expect(amountParam()).toBe("20 - 30"));
    fireEvent.click(screen.getByRole("button", { name: "Clear region" }));

    await waitFor(() => expect(amountParam()).toBe("20 - 40"));
  });

  it("keeps a reader-picked value that equals the seed when bounds move", async () => {
    const db = new FakeDuckDb();
    db.rowsWhen = (sql) =>
      sql.includes("where region = ?")
        ? [{ amount: 5 }, { amount: 48 }]
        : AMOUNTS;
    renderSlider({ filters: "region" }, { db, regionPicker: true });
    await waitFor(() => expect(thumb()).toHaveAttribute("aria-valuenow", "12"));

    fireEvent.keyDown(thumb(), { key: "ArrowRight" });
    fireEvent.keyDown(thumb(), { key: "ArrowLeft" });
    fireEvent.click(screen.getByRole("button", { name: "Pick West" }));

    // 12 is now the reader's pick, not the seed — a lower min must not
    // drag it down to 5.
    await waitFor(() => expect(thumb()).toHaveAttribute("min", "5"));
    expect(thumb()).toHaveAttribute("aria-valuenow", "12");
  });

  it("seeds initialValue when the URL holds nothing", async () => {
    const port = new FakeFilterUrlPort("");
    renderSlider({ min: 0, max: 100, initialValue: 30 }, { port });

    await waitFor(() => expect(thumb()).toHaveAttribute("aria-valuenow", "30"));
    expect(port.written).toHaveLength(0);
  });
});

describe("Slider — predicate", () => {
  it("emits `amount >= ?` for a single-mode value", async () => {
    const db = renderSlider(
      {},
      { port: new FakeFilterUrlPort("?amount=20"), consumer: true },
    );

    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select * from (select * from orders) where amount >= ?",
        params: [20],
      }),
    );
  });

  it("emits `amount BETWEEN ? AND ?` for a range-mode pair", async () => {
    const db = renderSlider(
      { range: true },
      { port: new FakeFilterUrlPort("?amount=10 - 40"), consumer: true },
    );

    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select * from (select * from orders) where amount BETWEEN ? AND ?",
        params: [10, 40],
      }),
    );
  });

  it("emits nothing for a range-shaped param in single mode", async () => {
    const db = renderSlider(
      {},
      { port: new FakeFilterUrlPort("?amount=10 - 40"), consumer: true },
    );

    await expectNoAmountPredicate(db, "BETWEEN");
  });

  it("emits nothing for the bounds seed — no authored selection yet", async () => {
    const db = renderSlider({ range: true }, { consumer: true });

    await waitFor(() => expect(thumbs()).toHaveLength(2));
    await expectNoAmountPredicate(db, "where amount");
  });

  it("emits nothing without a valueColumn even with a value", async () => {
    const db = renderSlider(
      { data: undefined, valueColumn: undefined, min: 0, max: 100 },
      { port: new FakeFilterUrlPort("?amount=42"), consumer: true },
    );

    await expectNoAmountPredicate(db, "where amount");
  });
});

describe("Slider — failure and loading faces", () => {
  it("shows an inline alert when data names no fence", async () => {
    renderSlider({ data: "ghost" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ghost");
    expect(alert).toHaveTextContent("no sql fence");
  });

  it("shows an inline alert when data is set without valueColumn", async () => {
    renderSlider({ valueColumn: undefined });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("valueColumn");
    expect(alert).toHaveTextContent("amount");
  });

  it("shows an inline alert naming the failing query", async () => {
    renderSlider({}, { db: FakeDuckDb.failing("Catalog Error: boom") });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("orders");
    expect(alert).toHaveTextContent("boom");
  });

  it("shows an inline alert when min exceeds max", async () => {
    renderSlider({ min: 100, max: 0 });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("amount");
  });

  it("disables the thumb while the bounds query is in flight", async () => {
    renderSlider({}, { db: FakeDuckDb.pending() });

    await waitFor(() => expect(thumb()).toBeDisabled());
  });

  it("degrades to disabled without a FiltersProvider", async () => {
    renderSlider({}, { provider: false });

    await waitFor(() => expect(thumb()).toBeDisabled());
  });
});
