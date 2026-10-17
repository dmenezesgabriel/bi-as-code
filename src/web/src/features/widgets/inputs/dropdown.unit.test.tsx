import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import { Dropdown } from "./dropdown";
import { FIELD_CONTROL_HEIGHT, FIELD_LABEL_ROW } from "./field-line";
import {
  clearViaPopup,
  clickOption,
  comboboxField,
  expectMissingFenceAlert,
  mountSelectInput,
  openSelectPopup,
  searchInput,
  type SelectMountOptions,
} from "./select-harness";
import type { DropdownProps } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

const REGIONS: Row[] = [
  { region: "West", label: "West region" },
  { region: "West", label: "dup" },
  { region: "North", label: "North region" },
  { region: "East", label: "East region" },
  { region: null },
];

function fakeDb(rows: Row[] = REGIONS): FakeDuckDb {
  const db = new FakeDuckDb();
  db.rows = rows;
  return db;
}

/** Renders `<Dropdown>` bound to the `region` filter over the `orders` fence. */
function renderDropdown(
  props: Partial<DropdownProps> = {},
  opts: SelectMountOptions = {},
): FakeDuckDb {
  return mountSelectInput(
    <Dropdown id="region" data="orders" valueColumn="region" {...props} />,
    { db: fakeDb(), blocks: [ORDERS], ...opts },
  );
}

describe("Dropdown — field", () => {
  it("sits on the filter bar's label row and control height", () => {
    renderDropdown({ title: "Region" });

    expect(screen.getByText("Region")).toHaveClass(FIELD_LABEL_ROW);
    expect(comboboxField()).toHaveClass(FIELD_CONTROL_HEIGHT);
  });
});

describe("Dropdown — option source", () => {
  it("lists distinct valueColumn values in fence order", async () => {
    renderDropdown();
    await openSelectPopup();

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "West",
      "North",
      "East",
    ]);
  });

  it("shows labelColumn text in the list but the value in the URL", async () => {
    const port = new FakeFilterUrlPort("");
    renderDropdown({ labelColumn: "label" }, { port });
    await openSelectPopup();

    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toContain("West region");

    await clickOption("West region");
    await waitFor(() =>
      expect(port.written.at(-1)?.searchParams.get("region")).toBe("West"),
    );
  });

  it("renders the options prop when data is absent", async () => {
    renderDropdown(
      { data: undefined, valueColumn: undefined, options: ["West", "North"] },
      { blocks: [] },
    );
    await openSelectPopup();

    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["West", "North"]);
  });

  it("merges options prop ahead of row options, deduped by value", async () => {
    renderDropdown({ options: ["West", "All"] });
    await openSelectPopup();

    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["West", "All", "North", "East"]);
  });

  it("narrows the option source through the filters prop", async () => {
    const db = new FakeDuckDb();
    db.rowsWhen = (sql) =>
      sql.includes("where region = ?")
        ? [{ region: "West" }]
        : [{ region: "West" }, { region: "North" }];
    // A different filter id — consuming its own selection skips the options
    // query under cross-filtering, so the cascade is probed through another.
    renderDropdown(
      { id: "picked", filters: "region" },
      { db, port: new FakeFilterUrlPort("?region=West") },
    );

    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select * from (select * from orders) where region = ?",
        params: ["West"],
      }),
    );
  });

  it("keeps the option source unfiltered by its own pick", async () => {
    const db = fakeDb();
    renderDropdown(
      { filters: "region" },
      { db, port: new FakeFilterUrlPort("?region=West") },
    );

    // The own clause skips the owner client — options load unfiltered and
    // the wrapped query is never issued even after the popup settles.
    await openSelectPopup();
    await screen.findAllByRole("option");
    expect(db.queries).toEqual([{ sql: "select * from orders", params: [] }]);
  });
});

describe("Dropdown — selection lifecycle", () => {
  it("writes ?region=<value> on pick", async () => {
    const port = new FakeFilterUrlPort("");
    renderDropdown({}, { port });
    await openSelectPopup();
    await clickOption("West");

    await waitFor(() =>
      expect(port.written.at(-1)?.searchParams.get("region")).toBe("West"),
    );
  });

  it("shows the URL-seeded value's label on first render", async () => {
    renderDropdown(
      { labelColumn: "label" },
      { port: new FakeFilterUrlPort("?region=West") },
    );

    await waitFor(() =>
      expect(comboboxField()).toHaveTextContent("West region"),
    );
  });

  it("removes the param on Clear", async () => {
    const port = new FakeFilterUrlPort("?region=West");
    renderDropdown({}, { port });

    await clearViaPopup(port, "region");
  });

  it("hides the clear affordance on clear={false}", async () => {
    renderDropdown(
      { clear: false },
      { port: new FakeFilterUrlPort("?region=West") },
    );
    await openSelectPopup();
    await screen.findAllByRole("option");

    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});

describe("Dropdown — search", () => {
  it("narrows options by substring over the value", async () => {
    renderDropdown();
    await openSelectPopup();
    fireEvent.change(await searchInput(), { target: { value: "no" } });

    await waitFor(() =>
      expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
        "North",
      ]),
    );
  });

  it("matches the label, not only the value", async () => {
    renderDropdown({ labelColumn: "label" });
    await openSelectPopup();
    fireEvent.change(await searchInput(), { target: { value: "region" } });

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
  });

  it("shows the empty state when nothing matches", async () => {
    renderDropdown();
    await openSelectPopup();
    fireEvent.change(await searchInput(), { target: { value: "zzz" } });

    expect(await screen.findByText("No options found")).toBeVisible();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("hides the search field on search={false}", async () => {
    renderDropdown({ search: false });
    await openSelectPopup();

    expect(await screen.findAllByRole("option")).toHaveLength(3);
    expect(screen.queryByLabelText("Search")).toBeNull();
  });
});

describe("Dropdown — defaults", () => {
  it("selectFirst seeds the first option without a URL write", async () => {
    const port = new FakeFilterUrlPort("");
    renderDropdown({ selectFirst: true }, { port });

    await waitFor(() => expect(comboboxField()).toHaveTextContent("West"));
    expect(port.written).toHaveLength(0);
  });

  it("never re-seeds after the reader clears", async () => {
    const port = new FakeFilterUrlPort("");
    renderDropdown({ selectFirst: true }, { port });
    await waitFor(() => expect(comboboxField()).toHaveTextContent("West"));

    await clearViaPopup(port, "region");
    // The popup stays open after clear — assert the trigger by its
    // placeholder name while the search input shares the combobox role.
    expect(comboboxField()).not.toHaveTextContent("West");
  });

  it("seeds initialValue when the URL holds nothing", async () => {
    const port = new FakeFilterUrlPort("");
    renderDropdown({ initialValue: "North" }, { port });

    await waitFor(() => expect(comboboxField()).toHaveTextContent("North"));
    expect(port.written).toHaveLength(0);
  });
});

describe("Dropdown — stale-value clearing", () => {
  it("clears a URL value missing from the loaded option set", async () => {
    const port = new FakeFilterUrlPort("?region=Atlantis");
    renderDropdown({}, { port });

    await waitFor(() =>
      expect(port.written.at(-1)?.searchParams.has("region")).toBe(false),
    );
  });

  it("keeps the URL value while the options query is pending", async () => {
    const db = new FakeDuckDb();
    db.queryRows = () => Effect.promise(() => new Promise<Row[]>(() => {}));
    const port = new FakeFilterUrlPort("?region=West");
    renderDropdown({}, { db, port });

    await waitFor(() => expect(comboboxField()).toHaveTextContent("West"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(port.written).toHaveLength(0);
  });

  it("keeps the URL value when options load empty", async () => {
    const port = new FakeFilterUrlPort("?region=West");
    renderDropdown({}, { db: fakeDb([]), port });

    await waitFor(() => expect(comboboxField()).toHaveTextContent("West"));
    expect(port.written).toHaveLength(0);
  });
});

describe("Dropdown — failure and loading faces", () => {
  it("shows an inline alert when data names no fence", async () => {
    renderDropdown({ data: "ghost" });

    await expectMissingFenceAlert("ghost");
  });

  it("shows an inline alert naming the failing query", async () => {
    const db = new FakeDuckDb();
    db.failWhen = () => "Catalog Error: boom";
    renderDropdown({}, { db });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("orders");
    expect(alert).toHaveTextContent("boom");
  });

  it("shows an inline alert when data is set without valueColumn", async () => {
    renderDropdown({ valueColumn: undefined });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("valueColumn");
    expect(alert).toHaveTextContent("region");
  });

  it("disables the trigger while the option query is in flight", async () => {
    const db = new FakeDuckDb();
    db.queryRows = () => Effect.promise(() => new Promise<Row[]>(() => {}));
    renderDropdown({}, { db });

    await waitFor(() => expect(comboboxField()).toBeDisabled());
  });

  it("degrades to disabled without a FiltersProvider", async () => {
    renderDropdown({}, { filters: false });

    await waitFor(() => expect(comboboxField()).toBeDisabled());
  });
});
