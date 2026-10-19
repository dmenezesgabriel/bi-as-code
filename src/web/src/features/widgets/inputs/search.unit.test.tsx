import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import type { SqlBlock } from "../../pages/types";
import { renderWithRegistry } from "../value/registry-harness";
import { Search } from "./search";
import { expectParamCleared, lastWrittenParam } from "./select-harness";
import type { SearchProps } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

const FILTERED = "select * from (select * from orders) where";

/** A `filters=["q"]` consumer probe — re-queries `orders` under the search's clause. */
function QConsumer(): ReactElement | null {
  useFilteredQueryRows("orders", "q");
  return null;
}

interface MountOptions {
  readonly port?: FakeFilterUrlPort;
  readonly provider?: boolean;
}

/** Renders `<Search id="q" column="region" title="Search regions">` beside a `q` consumer. */
function renderSearch(
  props: Partial<SearchProps> = {},
  { port = new FakeFilterUrlPort(""), provider = true }: MountOptions = {},
): FakeDuckDb {
  return renderWithRegistry(
    <>
      <Search id="q" column="region" title="Search regions" {...props} />
      <QConsumer />
    </>,
    {
      db: FakeDuckDb.withRows([]),
      blocks: [ORDERS],
      port: provider ? port : undefined,
    },
  );
}

/** The rendered field — `type="search"` gives it the `searchbox` role. */
function searchbox(name = "Search regions"): HTMLElement {
  return screen.getByRole("searchbox", { name });
}

function type(text: string): void {
  const input = searchbox();
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
}

describe("Search — field", () => {
  it("renders a searchbox named by title", () => {
    renderSearch();
    expect(searchbox()).toBeEnabled();
  });

  it("labels the field titleCase(id) when title is absent", () => {
    renderSearch({ title: undefined });
    expect(searchbox("Q")).toBeEnabled();
  });

  it("shows 'Search' as the default placeholder", () => {
    renderSearch();
    expect(searchbox()).toHaveAttribute("placeholder", "Search");
  });

  it("degrades to disabled without a FiltersProvider", () => {
    renderSearch({}, { provider: false });
    expect(searchbox()).toBeDisabled();
  });
});

describe("Search — predicate", () => {
  it("narrows a filters=['q'] consumer to rows whose column contains the text", async () => {
    const db = renderSearch();

    type("We");

    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: `${FILTERED} contains(lower(region), lower(?))`,
        params: ["We"],
      }),
    );
  });

  it("matches with the method prop", async () => {
    const db = renderSearch({ method: "prefix" });

    type("We");

    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: `${FILTERED} prefix(lower(region), lower(?))`,
        params: ["We"],
      }),
    );
  });

  it("applies a ?q= link's text on first render", async () => {
    const db = renderSearch({}, { port: new FakeFilterUrlPort("?q=west") });

    expect(searchbox()).toHaveValue("west");
    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: `${FILTERED} contains(lower(region), lower(?))`,
        params: ["west"],
      }),
    );
  });
});

describe("Search — URL", () => {
  it("writes the committed text to ?q=", () => {
    const port = new FakeFilterUrlPort("");
    renderSearch({}, { port });

    type("we");

    expect(lastWrittenParam(port, "q")).toBe("we");
  });

  it("deletes ?q= and the predicate when the field is cleared", async () => {
    const port = new FakeFilterUrlPort("?q=west");
    const db = renderSearch({}, { port });

    type("");

    await expectParamCleared(port, "q");
    await waitFor(() =>
      expect(db.queries.at(-1)).toEqual({
        sql: "select * from orders",
        params: [],
      }),
    );
  });

  it("seeds initialValue without a URL write", () => {
    const port = new FakeFilterUrlPort("");
    renderSearch({ initialValue: "west" }, { port });

    expect(searchbox()).toHaveValue("west");
    expect(port.written).toHaveLength(0);
  });
});
