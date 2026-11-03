import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  withDataRuntime,
  withPageFilters,
} from "../../../.storybook/decorators";
import { FakeDuckDb } from "../data/fake-duckdb";
import type { Row } from "../data/types";
import { FakeFilterUrlPort } from "../filters/fake-url-port";
import { MultiSelect } from "../widgets/inputs/multi-select";
import { ParamsBridge } from "../widgets/inputs/params-bridge";
import { TextInput } from "../widgets/inputs/text-input";
import { Table } from "../widgets/table/table";
import type { SqlBlock } from "./types";

/** The page's `islands_named` fence: `{{params.island_text}}` twice. */
const ISLANDS_NAMED: SqlBlock = {
  name: "islands_named",
  sql: `select island, count(*) as penguins
from penguins
where {{params.island_text}} is null
  or island ilike '%' || {{params.island_text}}::varchar || '%'
group by island
order by island`,
};

/** The page's list fence: a MultiSelect's picks as one list; null while nothing is picked. */
const ISLANDS_PICKED: SqlBlock = {
  name: "islands_picked",
  sql: `select island, count(distinct species) as species_count
from penguins
where {{params.island_picks}} is null
  or list_contains({{params.island_picks}}, island)
group by island
order by island`,
};

const TYPED_PROBE: SqlBlock = {
  name: "typed_probe",
  sql: "select coalesce({{params.island_text}}::varchar, 'nothing typed') as typed",
};

/** The page's composed fence: `{{islands_named}}` inlined as a subquery. */
const SPECIES_ON_NAMED_ISLANDS: SqlBlock = {
  name: "species_on_named_islands",
  sql: `select species, count(*) as penguins
from penguins
where island in (select island from {{islands_named}})
group by species
order by species`,
};

const ALL_ISLANDS: Row[] = [
  { island: "Biscoe", penguins: 168 },
  { island: "Dream", penguins: 124 },
  { island: "Torgersen", penguins: 52 },
];
const BISCOE_ONLY: Row[] = [{ island: "Biscoe", penguins: 168 }];

/** Answers by the first bound arg: "bis" narrows to Biscoe, anything else is every island. */
function islandsDb(): FakeDuckDb {
  const db = FakeDuckDb.withRows(ALL_ISLANDS);
  db.rowsWhen = (_sql, params) => (params[0] === "bis" ? BISCOE_ONLY : null);
  return db;
}

const meta = {
  title: "Pages/ParametersInQueries",
  component: ParamsBridge,
} satisfies Meta<typeof ParamsBridge>;

export default meta;
type Story = StoryObj<typeof meta>;

const valuePort = new FakeFilterUrlPort("");
const valueDb = islandsDb();

/** `{{params.island_text}}` becomes a `?` and the typed text travels as its
 * argument: typing `bis` reruns `islands_named` and leaves Biscoe. */
export const UseAValue: Story = {
  args: { id: "island_text", blocks: [ISLANDS_NAMED], port: valuePort },
  decorators: [withDataRuntime(valueDb), withPageFilters(valuePort)],
  render: (args) => (
    <>
      <TextInput id="island_text" title="Island name" />
      <ParamsBridge {...args}>
        <Table data="islands_named" />
      </ParamsBridge>
    </>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toHaveTextContent("Dream");

    await userEvent.type(
      canvas.getByRole("textbox", { name: "Island name" }),
      "bis",
    );
    await userEvent.tab();

    // The rerun remounts the table, so each poll re-locates it.
    await waitFor(() =>
      expect(canvas.getByRole("table")).not.toHaveTextContent("Dream"),
    );
    await expect(valueDb.queries.at(-1)?.params).toEqual(["bis", "bis"]);
  },
};

const listPort = new FakeFilterUrlPort("");
const listDb = FakeDuckDb.withRows(ALL_ISLANDS);

/** A MultiSelect writes `?island_picks=["Dream","Biscoe"]`, and the list
 * binds element by element: `[?, ?]` with one argument per pick. */
export const UseAList: Story = {
  args: { id: "island_picks", blocks: [ISLANDS_PICKED], port: listPort },
  decorators: [withDataRuntime(listDb), withPageFilters(listPort)],
  render: (args) => (
    <>
      <MultiSelect
        id="island_picks"
        options={["Biscoe", "Dream", "Torgersen"]}
        valueColumn="island"
        title="Islands"
      />
      <ParamsBridge {...args}>
        <Table data="islands_picked" />
      </ParamsBridge>
    </>
  ),
  play: async ({ canvas }) => {
    const popup = within(document.body);
    await userEvent.click(canvas.getByRole("combobox"));
    await userEvent.click(await popup.findByRole("option", { name: "Dream" }));
    await userEvent.click(popup.getByRole("option", { name: "Biscoe" }));
    await userEvent.keyboard("{Escape}");

    // Nothing picked yet: the list is null, so the query keeps every island.
    // The token is written twice, so each pick is bound twice.
    await expect(listDb.queries[0]?.params).toEqual([null, null]);
    await waitFor(() =>
      expect(listDb.queries.at(-1)?.params).toEqual([
        "Dream",
        "Biscoe",
        "Dream",
        "Biscoe",
      ]),
    );
    await expect(listDb.queries.at(-1)?.sql).toContain(
      "list_contains([?, ?], island)",
    );
  },
};

const nullPort = new FakeFilterUrlPort("");
const nullDb = FakeDuckDb.withRows([{ typed: "nothing typed" }]);

/** No value yet: the argument is `null`, and the query reads it as no filter. */
export const BeforeAValue: Story = {
  args: { id: "island_text", blocks: [TYPED_PROBE], port: nullPort },
  decorators: [withDataRuntime(nullDb), withPageFilters(nullPort)],
  render: (args) => (
    <ParamsBridge {...args}>
      <Table data="typed_probe" />
    </ParamsBridge>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toHaveTextContent(
      "nothing typed",
    );
    await expect(nullDb.queries.at(-1)?.params).toEqual([null]);
  },
};

const composedPort = new FakeFilterUrlPort("");
const composedDb = FakeDuckDb.withRows([
  { species: "Adelie", penguins: 152 },
  { species: "Gentoo", penguins: 124 },
]);

/** `{{islands_named}}` is the other fence's SQL in parentheses, its own
 * `{{params.*}}` already `?`s: the database gets one query and both args. */
export const ComposedBlocks: Story = {
  args: {
    id: "island_text",
    blocks: [ISLANDS_NAMED, SPECIES_ON_NAMED_ISLANDS],
    port: composedPort,
  },
  decorators: [withDataRuntime(composedDb), withPageFilters(composedPort)],
  render: (args) => (
    <ParamsBridge {...args}>
      <Table data="species_on_named_islands" />
    </ParamsBridge>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toHaveTextContent("Adelie");

    const received = composedDb.queries.find(({ sql }) =>
      sql.startsWith("select species"),
    );
    await expect(received?.sql).toContain(
      "where island in (select island from (select island, count(*) as penguins",
    );
    await expect(received?.params).toEqual([null, null]);
  },
};

const unknownDb = new FakeDuckDb();

/** A token that names nothing: the query is never run and the block shows why. */
export const UnknownToken: Story = {
  args: {
    id: "island_text",
    blocks: [{ name: "broken", sql: "select {{nope}}" }],
    port: new FakeFilterUrlPort(""),
  },
  decorators: [
    withDataRuntime(unknownDb),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  render: (args) => (
    <ParamsBridge {...args}>
      <Table data="broken" />
    </ParamsBridge>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Unknown token {{nope}}",
    );
    await expect(unknownDb.queries).toEqual([]);
  },
};

const circularDb = new FakeDuckDb();

/** Two fences that reach each other never finish expanding: the query is never run. */
export const CircularReference: Story = {
  args: {
    id: "island_text",
    blocks: [
      { name: "first_pass", sql: "select * from {{second_pass}}" },
      { name: "second_pass", sql: "select * from {{first_pass}}" },
    ],
    port: new FakeFilterUrlPort(""),
  },
  decorators: [
    withDataRuntime(circularDb),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  render: (args) => (
    <ParamsBridge {...args}>
      <Table data="first_pass" />
    </ParamsBridge>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Circular query reference: {{first_pass}}",
    );
    await expect(circularDb.queries).toEqual([]);
  },
};
