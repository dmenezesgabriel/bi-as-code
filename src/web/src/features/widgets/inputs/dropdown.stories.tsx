import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Effect } from "effect";
import type { Decorator } from "@storybook/react-vite";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import {
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { Table } from "../table/table";
import { Dropdown } from "./dropdown";
import { expectAlert } from "./input-stories.fixture";
import type { DropdownProps } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

const REGIONS: Row[] = [
  { region: "West" },
  { region: "North" },
  { region: "East" },
  { region: "South" },
  { region: "West" },
];

function fakeDb(rows: Row[] = REGIONS): FakeDuckDb {
  const db = new FakeDuckDb();
  db.rows = rows;
  return db;
}

/** A db whose queries never resolve — the loading face. */
function pendingDb(): FakeDuckDb {
  const db = new FakeDuckDb();
  db.queryRows = () => Effect.promise(() => new Promise<Row[]>(() => {}));
  return db;
}

/** A db whose queries all fail with `message`. */
function failingDb(message: string): FakeDuckDb {
  const db = new FakeDuckDb();
  db.failWhen = () => message;
  return db;
}

/** The query-backed decoration most stories share — fresh fakes per call. */
function regionDecorators(search?: string): Decorator[] {
  return [
    withQueryData([ORDERS], fakeDb()),
    withPageFilters(new FakeFilterUrlPort(search)),
  ];
}

type Canvas = ReturnType<typeof within>;

/**
 * Clicks the dropdown's trigger. The popup lives in a portal under
 * `document.body`, outside the story's canvas — queries against it go
 * through `within(document.body)`. The trigger stays inside the canvas, so
 * `canvas.getByRole("combobox")` names it unambiguously even while the
 * popup's search input shares the role.
 */
async function openDropdown(canvas: Canvas): Promise<void> {
  await userEvent.click(canvas.getByRole("combobox"));
}

function popup(): Canvas {
  return within(document.body);
}

const meta = {
  title: "Widgets/Dropdown",
  component: Dropdown,
  args: { id: "region", data: "orders", valueColumn: "region" },
} satisfies Meta<DropdownProps>;

export default meta;
type Story = StoryObj<typeof meta>;

const successPort = new FakeFilterUrlPort("");

/** The authored shape: `data` names a sql fence, picking an option writes
 * `?region=<value>` and the trigger shows the selection. */
export const Success: Story = {
  args: { title: "Region" },
  decorators: [withQueryData([ORDERS], fakeDb()), withPageFilters(successPort)],
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("combobox");
    await expect(trigger).toHaveTextContent("Select Region");
    await openDropdown(canvas);

    // A duplicated row collapses — four distinct values, fence order.
    await expect(
      await popup().findByRole("option", { name: "South" }),
    ).toBeVisible();
    await expect(popup().getAllByRole("option")).toHaveLength(4);
    await userEvent.click(popup().getByRole("option", { name: "West" }));

    await expect(trigger).toHaveTextContent("West");
    await expect(successPort.read()?.searchParams.get("region")).toBe("West");
  },
};

const REGION_ORDERS: Row[] = [
  { region: "West", orders: 140 },
  { region: "North", orders: 120 },
  { region: "East", orders: 90 },
];

const narrowsPort = new FakeFilterUrlPort("");

/** A widget naming the dropdown in `filters` re-queries on each pick: the
 * table keeps the picked region's rows, and the pick rides the URL. */
export const NarrowsATable: Story = {
  args: { title: "Region" },
  decorators: [
    withQueryData(
      [ORDERS],
      (() => {
        const db = new FakeDuckDb();
        db.rows = REGION_ORDERS;
        db.rowsWhen = (sql, params) =>
          sql.includes("where region = ?")
            ? REGION_ORDERS.filter((row) => row.region === params[0])
            : null;
        return db;
      })(),
    ),
    withPageFilters(narrowsPort),
  ],
  render: (args) => (
    <>
      <Dropdown {...args} />
      <Table data="orders" filters="region" />
    </>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findAllByRole("row")).toHaveLength(4);
    await openDropdown(canvas);
    await userEvent.click(
      await popup().findByRole("option", { name: "North" }),
    );

    await waitFor(() => expect(canvas.getAllByRole("row")).toHaveLength(2));
    await expect(canvas.getByRole("cell", { name: "North" })).toBeVisible();
    await expect(narrowsPort.read()?.searchParams.get("region")).toBe("North");
  },
};

/** `labelColumn` drives display while the URL stores the raw value. */
export const Labels: Story = {
  args: { labelColumn: "label" },
  decorators: [
    withQueryData(
      [ORDERS],
      fakeDb([
        { region: "W", label: "West region" },
        { region: "N", label: "North region" },
      ]),
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    await openDropdown(canvas);
    const option = await popup().findByRole("option", {
      name: "West region",
    });
    await userEvent.click(option);
    await expect(canvas.getByRole("combobox")).toHaveTextContent("West region");
  },
};

/** Type-to-search narrows the list by case-insensitive substring over the
 * option's value or label — "no" leaves only North. */
export const Search: Story = {
  decorators: regionDecorators(),
  play: async ({ canvas }) => {
    await openDropdown(canvas);
    await userEvent.type(await popup().findByLabelText("Search"), "no");
    await waitFor(() => expect(popup().getAllByRole("option")).toHaveLength(1));
    await expect(popup().getByRole("option", { name: "North" })).toBeVisible();
  },
};

/** A dead-end search renders the empty face. */
export const SearchEmpty: Story = {
  decorators: regionDecorators(),
  play: async ({ canvas }) => {
    await openDropdown(canvas);
    await userEvent.type(await popup().findByLabelText("Search"), "zzz");
    await expect(await popup().findByText("No options found")).toBeVisible();
  },
};

/** `filters` cascades another page filter into the option query —
 * `?channel=web` narrows the region list to West alone. */
export const CascadedOptions: Story = {
  args: { filters: "channel" },
  decorators: [
    withQueryData(
      [ORDERS],
      (() => {
        const db = new FakeDuckDb();
        db.rowsWhen = (sql) =>
          sql.includes("where channel = ?")
            ? [{ region: "West" }]
            : [{ region: "West" }, { region: "North" }];
        return db;
      })(),
    ),
    withPageFilters(new FakeFilterUrlPort("?channel=web")),
  ],
  play: async ({ canvas }) => {
    await openDropdown(canvas);
    await expect(
      await popup().findByRole("option", { name: "West" }),
    ).toBeVisible();
    await expect(popup().queryByRole("option", { name: "North" })).toBeNull();
  },
};

/** `options` without `data` — static entries on a page with no sql
 * fences still render and select. */
export const StaticOptions: Story = {
  args: {
    data: undefined,
    valueColumn: undefined,
    options: ["West", "North"],
  },
  decorators: regionDecorators(),
  play: async ({ canvas }) => {
    await openDropdown(canvas);
    await expect(
      await popup().findByRole("option", { name: "North" }),
    ).toBeVisible();
    await userEvent.click(popup().getByRole("option", { name: "West" }));
    await expect(canvas.getByRole("combobox")).toHaveTextContent("West");
  },
};

/** A `?region=West` link restores the selection on first render — the
 * trigger shows it before the option query even resolves. */
export const UrlHydrated: Story = {
  decorators: regionDecorators("?region=West"),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox")).toHaveTextContent("West");
  },
};

const clearPort = new FakeFilterUrlPort("?region=West");

/** The footer Clear empties the selection and deletes the URL param. */
export const Clear: Story = {
  decorators: [withQueryData([ORDERS], fakeDb()), withPageFilters(clearPort)],
  play: async ({ canvas }) => {
    await openDropdown(canvas);
    await userEvent.click(
      await popup().findByRole("button", { name: "Clear" }),
    );
    await expect(clearPort.read()?.searchParams.has("region")).toBe(false);
    await expect(canvas.getByRole("combobox")).toHaveTextContent(
      "Select Region",
    );
  },
};

/** `selectFirst` seeds the first resolved option as a programmatic
 * default — selected, but the URL stays clean. */
export const SelectFirst: Story = {
  args: { selectFirst: true },
  decorators: regionDecorators(),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("West")).toBeVisible();
    await expect(canvas.getByRole("combobox")).toHaveTextContent("West");
  },
};

/** `search={false}` and `clear={false}` strip both affordances. */
export const WithoutSearchOrClear: Story = {
  args: { search: false, clear: false },
  decorators: regionDecorators("?region=West"),
  play: async ({ canvas }) => {
    await openDropdown(canvas);
    await expect(await popup().findAllByRole("option")).toHaveLength(4);
    await expect(popup().queryByLabelText("Search")).toBeNull();
    await expect(popup().queryByRole("button", { name: "Clear" })).toBeNull();
  },
};

/** While the option query is in flight the trigger is disabled and shows
 * the spinner — a URL-seeded value still displays. */
export const Loading: Story = {
  decorators: [
    withQueryData([ORDERS], pendingDb()),
    withPageFilters(new FakeFilterUrlPort("?region=West")),
  ],
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("combobox");
    await expect(trigger).toBeDisabled();
    await expect(trigger).toHaveTextContent("West");
  },
};

/** A `data` value no sql fence declares renders the named alert — the
 * page around it is untouched. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: regionDecorators(),
  play: async ({ canvas }) => {
    await expectAlert(canvas, "ghost", "no sql fence");
    await expect(canvas.queryByRole("combobox")).toBeNull();
  },
};

/** The query's own failure surfaces inline, naming the block. */
export const QueryError: Story = {
  decorators: [
    withQueryData(
      [ORDERS],
      failingDb("Catalog Error: Table orders does not exist"),
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    await expectAlert(canvas, "orders", "does not exist");
  },
};

/** `data` without `valueColumn` is an authoring error, surfaced inline. */
export const MissingValueColumn: Story = {
  args: { valueColumn: undefined },
  decorators: regionDecorators(),
  play: async ({ canvas }) => {
    await expectAlert(canvas, "valueColumn");
  },
};
