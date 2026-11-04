import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import {
  withDataRuntime,
  withPageFilters,
} from "../../../.storybook/decorators";
import { FakeDuckDb } from "../data/fake-duckdb";
import type { Row } from "../data/types";
import { FakeFilterUrlPort } from "../filters/fake-url-port";
import { ParamsBridge } from "../widgets/inputs/params-bridge";
import { TextInput } from "../widgets/inputs/text-input";
import { Table } from "../widgets/table/table";
import type { SqlBlock } from "./types";

/** `queries/island_counts.sql`, named by the path the engine gives a page's block. */
const ISLAND_COUNTS: SqlBlock = {
  name: "/queries/island_counts",
  sql: `-- Penguins per island, the largest colony first.
select island, count(*) as penguins
from penguins
group by island
order by penguins desc
`,
};

/** `queries/penguins/island_search.sql`: builds on island_counts and reads a parameter. */
const ISLAND_SEARCH: SqlBlock = {
  name: "/queries/penguins/island_search",
  sql: `select island, penguins
from {{/queries/island_counts}}
where {{params.island_text}} is null
  or island ilike '%' || {{params.island_text}}::varchar || '%'
`,
};

/** The page's `big_islands` fence: a file placed in a subquery. */
const BIG_ISLANDS: SqlBlock = {
  name: "big_islands",
  sql: `select island
from {{/queries/island_counts}}
where penguins > 100
order by island`,
};

const ALL_ISLANDS: Row[] = [
  { island: "Biscoe", penguins: 168 },
  { island: "Dream", penguins: 124 },
  { island: "Torgersen", penguins: 52 },
];

const meta = {
  title: "Pages/QueryFiles",
  component: ParamsBridge,
} satisfies Meta<typeof ParamsBridge>;

export default meta;
type Story = StoryObj<typeof meta>;

const fileDb = FakeDuckDb.withRows(ALL_ISLANDS);
const filePort = new FakeFilterUrlPort("");

/** `data="/queries/island_counts"` runs the file's SQL as written. */
export const DataFromAFile: Story = {
  args: { id: "island_text", blocks: [ISLAND_COUNTS], port: filePort },
  decorators: [withDataRuntime(fileDb), withPageFilters(filePort)],
  render: (args) => (
    <ParamsBridge {...args}>
      <Table data="/queries/island_counts" />
    </ParamsBridge>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toHaveTextContent("Biscoe");
    await expect(fileDb.queries.at(-1)?.sql).toBe(ISLAND_COUNTS.sql);
    await expect(fileDb.queries.at(-1)?.params).toEqual([]);
  },
};

const fenceDb = FakeDuckDb.withRows([
  { island: "Biscoe" },
  { island: "Dream" },
]);
const fencePort = new FakeFilterUrlPort("");

/** `{{/queries/island_counts}}` is the file's SQL in parentheses, where the token stands. */
export const InsideAFence: Story = {
  args: {
    id: "island_text",
    blocks: [ISLAND_COUNTS, BIG_ISLANDS],
    port: fencePort,
  },
  decorators: [withDataRuntime(fenceDb), withPageFilters(fencePort)],
  render: (args) => (
    <ParamsBridge {...args}>
      <Table data="big_islands" />
    </ParamsBridge>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toHaveTextContent("Dream");
    await expect(fenceDb.queries.at(-1)?.sql).toContain(
      "from (-- Penguins per island, the largest colony first.\nselect island, count(*) as penguins",
    );
  },
};

const BISCOE_ONLY: Row[] = [{ island: "Biscoe", penguins: 168 }];
const searchPort = new FakeFilterUrlPort("");
const searchDb = FakeDuckDb.withRows(ALL_ISLANDS);
// "bis" narrows to Biscoe, anything else is every island.
searchDb.rowsWhen = (_sql, params) =>
  params[0] === "bis" ? BISCOE_ONLY : null;

/** The file nests another file and binds a parameter: both reach the database as one query. */
export const FilesThatBuildOnFiles: Story = {
  args: {
    id: "island_text",
    blocks: [ISLAND_COUNTS, ISLAND_SEARCH],
    port: searchPort,
  },
  decorators: [withDataRuntime(searchDb), withPageFilters(searchPort)],
  render: (args) => (
    <>
      <TextInput id="island_text" title="Island name" />
      <ParamsBridge {...args}>
        <Table data="/queries/penguins/island_search" />
      </ParamsBridge>
    </>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toHaveTextContent("Dream");
    // Every block runs on its own too; the search is the one that nests the file.
    const search = searchDb.queries.find(({ sql }) =>
      sql.startsWith("select island, penguins"),
    );
    await expect(search?.sql).toContain(
      "from (-- Penguins per island, the largest colony first.",
    );

    await userEvent.type(
      canvas.getByRole("textbox", { name: "Island name" }),
      "bis",
    );
    await userEvent.tab();

    await waitFor(() =>
      expect(canvas.getByRole("table")).not.toHaveTextContent("Dream"),
    );
    await expect(searchDb.queries.at(-1)?.params).toEqual(["bis", "bis"]);
  },
};

const circularDb = new FakeDuckDb();
const circularPort = new FakeFilterUrlPort("");

/** Two files that reach each other never finish expanding: the query is never run. */
export const CircularFiles: Story = {
  args: {
    id: "island_text",
    blocks: [
      {
        name: "/queries/first_pass",
        sql: "select * from {{/queries/second_pass}}",
      },
      {
        name: "/queries/second_pass",
        sql: "select * from {{/queries/first_pass}}",
      },
    ],
    port: circularPort,
  },
  decorators: [withDataRuntime(circularDb), withPageFilters(circularPort)],
  render: (args) => (
    <ParamsBridge {...args}>
      <Table data="/queries/first_pass" />
    </ParamsBridge>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Circular query reference: {{/queries/first_pass}}",
    );
    await expect(circularDb.queries).toEqual([]);
  },
};
