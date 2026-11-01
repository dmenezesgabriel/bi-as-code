import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import {
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { Table } from "../table/table";
import { expectAlert, type StoryCanvas } from "./input-stories.fixture";
import { Search } from "./search";
import type { SearchProps } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

const ALL_ORDERS: Row[] = [
  { region: "West", amount: 44 },
  { region: "North", amount: 40 },
];

/** Serves only the `West` row once a `contains` clause on `region` applies. */
function regionDb(): FakeDuckDb {
  return FakeDuckDb.withRowsWhen(ALL_ORDERS, (sql) =>
    sql.includes("contains(lower(region), lower(?))") ? [ALL_ORDERS[0]!] : null,
  );
}

/** The authored box every story labels "Search regions". */
function regionsBox(canvas: StoryCanvas): Promise<HTMLElement> {
  return canvas.findByRole("searchbox", { name: "Search regions" });
}

const meta = {
  title: "Widgets/Search",
  component: Search,
  args: { id: "q", column: "region", title: "Search regions" },
} satisfies Meta<SearchProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: an empty search box with the default placeholder. */
export const Empty: Story = {
  decorators: [withPageFilters(new FakeFilterUrlPort(""))],
  play: async ({ canvas }) => {
    const input = await regionsBox(canvas);
    await expect(input).toHaveAttribute("placeholder", "Search");
    await expect(input).toHaveValue("");
  },
};

/** A `?q=` link restores the held text on first render. */
export const Held: Story = {
  decorators: [withPageFilters(new FakeFilterUrlPort("?q=west"))],
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("searchbox", {
      name: "Search regions",
    });
    await expect(input).toHaveValue("west");
  },
};

/** Outside a page's filters the box renders, disabled. */
export const Disabled: Story = {
  play: async ({ canvas }) => {
    const input = await canvas.findByRole("searchbox", {
      name: "Search regions",
    });
    await expect(input).toBeDisabled();
  },
};

const renderFilteredOrders: Story["render"] = (args) => (
  <>
    <Search {...args} />
    <Table data="orders" filters={["q"]} />
  </>
);

const narrowPort = new FakeFilterUrlPort("");
const narrowDb = regionDb();

/** Typing narrows a `filters={["q"]}` table through the match clause —
 * no fence names the search text. */
export const NarrowsFilteredTable: Story = {
  decorators: [withQueryData([ORDERS], narrowDb), withPageFilters(narrowPort)],
  render: renderFilteredOrders,
  play: async ({ canvas }) => {
    const table = await canvas.findByRole("table");
    await expect(table).toHaveTextContent("North");

    const input = canvas.getByRole("searchbox", { name: "Search regions" });
    await userEvent.type(input, "we");
    await userEvent.tab();

    // The re-run resets the result to `loading` first — the table remounts,
    // so each poll must re-locate it rather than assert the stale node.
    await waitFor(() =>
      expect(canvas.getByRole("table")).not.toHaveTextContent("North"),
    );
    await expect(narrowPort.read()?.searchParams.get("q")).toBe("we");
  },
};

/** Serves every order to the fence and `matches` as a count re-query's row. */
function countDb(matches: number): FakeDuckDb {
  return FakeDuckDb.withRowsWhen(ALL_ORDERS, (sql) =>
    sql.includes("count(*)") ? [{ match_count: matches }] : null,
  );
}

/** While the fence is still loading the count line stays empty. */
export const CountLoading: Story = {
  args: { data: "orders" },
  decorators: [
    withQueryData([ORDERS], FakeDuckDb.pending()),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    const count = await canvas.findByRole("status");
    await expect(count).toHaveTextContent("");
  },
};

/** With nothing typed every row of the fence counts; typing narrows the
 * count through the search's own clause. */
export const Counted: Story = {
  args: { data: "orders" },
  decorators: [
    withQueryData([ORDERS], countDb(1)),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    const count = await canvas.findByRole("status");
    await waitFor(() => expect(count).toHaveTextContent("2 matches"));

    const input = canvas.getByRole("searchbox", { name: "Search regions" });
    await userEvent.type(input, "we");
    await userEvent.tab();

    await waitFor(() => expect(count).toHaveTextContent("1 match"));
    await expect(count).toHaveAttribute("aria-live", "polite");
  },
};

/** A held text no row contains reads "No matches". */
export const NoMatches: Story = {
  args: { data: "orders" },
  decorators: [
    withQueryData([ORDERS], countDb(0)),
    withPageFilters(new FakeFilterUrlPort("?q=zzz")),
  ],
  play: async ({ canvas }) => {
    const count = await canvas.findByRole("status");
    await waitFor(() => expect(count).toHaveTextContent("No matches"));
  },
};

/** A `data` value no sql fence declares replaces the box with the named alert. */
export const UnknownSource: Story = {
  args: { data: "ghost" },
  decorators: [
    withQueryData([ORDERS], countDb(1)),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    await expectAlert(canvas, "ghost", "no sql fence");
    await expect(canvas.queryByRole("searchbox")).toBeNull();
  },
};

/** The counted fence's own failure surfaces inline, naming the block. */
export const CountQueryError: Story = {
  args: { data: "orders" },
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

/** `placeholder` replaces the default hint the empty box shows. */
export const CustomPlaceholder: Story = {
  args: { placeholder: "e.g. West" },
  decorators: [withPageFilters(new FakeFilterUrlPort(""))],
  play: async ({ canvas }) => {
    const input = await regionsBox(canvas);
    await expect(input).toHaveAttribute("placeholder", "e.g. West");
  },
};

/** `method="prefix"` matches the text at the start of the column. */
export const PrefixMethod: Story = {
  args: { method: "prefix" },
  decorators: [
    withQueryData(
      [ORDERS],
      FakeDuckDb.withRowsWhen(ALL_ORDERS, (sql) =>
        sql.includes("prefix(lower(region), lower(?))")
          ? [ALL_ORDERS[0]!]
          : null,
      ),
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  render: renderFilteredOrders,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toHaveTextContent("North");
    const input = canvas.getByRole("searchbox", { name: "Search regions" });
    await userEvent.type(input, "we");
    await userEvent.tab();
    await waitFor(() =>
      expect(canvas.getByRole("table")).not.toHaveTextContent("North"),
    );
  },
};
