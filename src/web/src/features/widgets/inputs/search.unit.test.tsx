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

const REGION_ROWS = [
  { region: "West" },
  { region: "North" },
  { region: "East" },
];

/** Serves every region to the fence and `match_count` to a count re-query. */
function countingDb(matches: number): FakeDuckDb {
  return FakeDuckDb.withRowsWhen(REGION_ROWS, (sql) =>
    sql.includes("count(*)") ? [{ match_count: matches }] : null,
  );
}

/** Renders `<Search data="orders">` alone — its count is the only consumer. */
function renderCountedSearch(
  db: FakeDuckDb,
  props: Partial<SearchProps> = {},
  port = new FakeFilterUrlPort(""),
): FakeDuckDb {
  return renderWithRegistry(
    <Search
      id="q"
      column="region"
      title="Search regions"
      data="orders"
      {...props}
    />,
    { db, blocks: [ORDERS], port },
  );
}

describe("Search — match count", () => {
  it("renders no count without data", () => {
    renderSearch();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("counts the fence's rows while nothing is typed", async () => {
    renderCountedSearch(countingDb(1));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("3 matches"),
    );
  });

  it("counts under the search's own clause once text is held", async () => {
    const db = renderCountedSearch(countingDb(1));

    type("we");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("1 match"),
    );
    expect(db.queries).toContainEqual({
      sql: "select count(*) as match_count from (select * from orders) where contains(lower(region), lower(?))",
      params: ["we"],
    });
  });

  it("reads 'No matches' when nothing matches", async () => {
    renderCountedSearch(countingDb(0), {}, new FakeFilterUrlPort("?q=zzz"));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("No matches"),
    );
  });

  it("counts under the other filters it names", async () => {
    const port = new FakeFilterUrlPort("?q=we&channel=web");
    const db = renderWithRegistry(
      <>
        <Search id="channel" column="channel" />
        <Search id="q" column="region" data="orders" filters={["channel"]} />
      </>,
      { db: countingDb(1), blocks: [ORDERS], port },
    );
    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select count(*) as match_count from (select * from orders) where (contains(lower(channel), lower(?))) AND (contains(lower(region), lower(?)))",
        params: ["web", "we"],
      }),
    );
  });

  it("replaces the field with an alert when no fence declares data", () => {
    renderCountedSearch(countingDb(1), { data: "missing" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "no sql fence on this page declares this name",
    );
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("replaces the field with an alert when the fence fails", async () => {
    renderCountedSearch(FakeDuckDb.failing("Catalog Error: no orders"));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Catalog Error"),
    );
  });
});
