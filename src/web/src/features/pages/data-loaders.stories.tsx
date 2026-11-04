import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { withDataRuntime } from "../../../.storybook/decorators";
import { FakeDuckDb } from "../data/fake-duckdb";
import type { Row } from "../data/types";
import { Table } from "../widgets/table/table";
import { QueryRegistryProvider } from "./query-registry";
import type { SqlBlock } from "./types";

/** The page's `islands` fence over the table `data/island-summary.csv` registers. */
const ISLANDS: SqlBlock = {
  name: "islands",
  sql: `select island, penguins, mean_body_mass_g
from island_summary
order by island`,
};

/** What `data/island-summary.csv.js` prints for `data/penguins.csv`. */
const ISLAND_SUMMARY: Row[] = [
  { island: "Biscoe", penguins: 168, mean_body_mass_g: 4716 },
  { island: "Dream", penguins: 124, mean_body_mass_g: 3713 },
  { island: "Torgersen", penguins: 52, mean_body_mass_g: 3706 },
];

const meta = {
  title: "Pages/DataLoaders",
  component: QueryRegistryProvider,
} satisfies Meta<typeof QueryRegistryProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The page's `<Table data="islands" />`, under the registry the story configures. */
const renderIslands: Story["render"] = (args) => (
  <QueryRegistryProvider {...args}>
    <Table data="islands" />
  </QueryRegistryProvider>
);

const outputDb = FakeDuckDb.withRows(ISLAND_SUMMARY);

/** The page registers the loader's output, `data/island-summary.csv`, never the loader. */
export const LoaderOutputAsATable: Story = {
  args: {
    sqlBlocks: [ISLANDS],
    sqlTables: { island_summary: "data/island-summary.csv" },
    params: {},
    children: null,
  },
  decorators: [withDataRuntime(outputDb)],
  render: renderIslands,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toHaveTextContent(
      "Torgersen",
    );
    await expect(outputDb.registered).toEqual([
      { name: "island_summary", source: "data/island-summary.csv" },
    ]);
  },
};

const FAILED_LOADER =
  "fetch http://localhost:5173/data/island-summary.csv → HTTP 500: data loader data/island-summary.csv.js exited with code 3, expected 0; stderr: upstream timed out";
const failingDb = new FakeDuckDb();
failingDb.registerCause = new Error(FAILED_LOADER);

/** A loader that exits with a code other than 0: the dev server's own message reaches the page. */
export const LoaderThatFails: Story = {
  args: {
    sqlBlocks: [ISLANDS],
    sqlTables: { island_summary: "data/island-summary.csv" },
    params: {},
    children: null,
  },
  decorators: [withDataRuntime(failingDb)],
  render: renderIslands,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "islands: registerTable failed (island_summary ← data/island-summary.csv): Error: fetch",
    );
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "data loader data/island-summary.csv.js exited with code 3, expected 0",
    );
  },
};
