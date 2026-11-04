import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { withDataRuntime } from "../../../.storybook/decorators";
import { LanguageMenu } from "../chrome/language-menu";
import { FakeDuckDb } from "../data/fake-duckdb";
import type { Row } from "../data/types";
import { Table } from "../widgets/table/table";
import { QueryRegistryProvider } from "./query-registry";
import type { SqlBlock, TranslationMap } from "./types";

/** The page's `by_sex` fence: each sex's label is a bound translation. */
const BY_SEX: SqlBlock = {
  name: "by_sex",
  sql: `select
  case sex
    when 'female' then {{$translations.sex.female}}
    when 'male' then {{$translations.sex.male}}
  end as label,
  count(*) as penguins
from penguins
where sex is not null
group by sex
order by sex`,
};

/** The page's `weighed` fence, whose French label holds an apostrophe. */
const WEIGHED: SqlBlock = {
  name: "weighed",
  sql: "select {{$translations.weighed}} as label, count(body_mass_g) as penguins\nfrom penguins",
};

const ENGLISH: TranslationMap = {
  weighed: "Penguins that were weighed",
  sex: { female: "Female", male: "Male" },
};

const FRENCH: TranslationMap = {
  weighed: "Pingouins qu'on a pesés",
  sex: { female: "Femelle", male: "Mâle" },
};

const SEX_ROWS: Row[] = [
  { label: "Female", penguins: 165 },
  { label: "Male", penguins: 168 },
];

const meta = {
  title: "Pages/Translations",
  component: QueryRegistryProvider,
} satisfies Meta<typeof QueryRegistryProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The page's `<Table data=… />`, under the registry the story configures. */
const renderTable =
  (data: string): Story["render"] =>
  (args) => (
    <QueryRegistryProvider {...args}>
      <Table data={data} />
    </QueryRegistryProvider>
  );

const englishDb = FakeDuckDb.withRows(SEX_ROWS);

/** In English the fence binds `Female` and `Male`, in the order the tokens appear. */
export const SqlKeysInEnglish: Story = {
  args: {
    sqlBlocks: [BY_SEX],
    sqlTables: { penguins: "data/penguins.csv" },
    params: {},
    translations: ENGLISH,
    children: null,
  },
  decorators: [withDataRuntime(englishDb)],
  render: renderTable("by_sex"),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toHaveTextContent("Female");
    await expect(englishDb.queries.at(-1)?.params).toEqual(["Female", "Male"]);
  },
};

const frenchDb = FakeDuckDb.withRows(SEX_ROWS);

/** The same fence in French binds the French words; the SQL text is unchanged. */
export const SqlKeysInFrench: Story = {
  args: { ...SqlKeysInEnglish.args, translations: FRENCH },
  decorators: [withDataRuntime(frenchDb)],
  render: renderTable("by_sex"),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toBeVisible();
    await expect(frenchDb.queries.at(-1)?.params).toEqual(["Femelle", "Mâle"]);
    await expect(frenchDb.queries.at(-1)?.sql).not.toContain("Femelle");
  },
};

const apostropheDb = FakeDuckDb.withRows([{ label: "x", penguins: 342 }]);

/** An apostrophe in a translation is a bound value, so it cannot end the SQL string. */
export const ApostropheIsBound: Story = {
  args: {
    sqlBlocks: [WEIGHED],
    sqlTables: { penguins: "data/penguins.csv" },
    params: {},
    translations: FRENCH,
    children: null,
  },
  decorators: [withDataRuntime(apostropheDb)],
  render: renderTable("weighed"),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("table")).toBeVisible();
    await expect(apostropheDb.queries.at(-1)?.params).toEqual([
      "Pingouins qu'on a pesés",
    ]);
  },
};

/** A key the file does not have shows under the block and the query never runs. */
export const UnknownKeyInSql: Story = {
  args: {
    sqlBlocks: [
      { name: "nope", sql: "select {{$translations.nope}} as label" },
    ],
    sqlTables: {},
    params: {},
    translations: ENGLISH,
    children: null,
  },
  decorators: [withDataRuntime(new FakeDuckDb())],
  render: renderTable("nope"),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Undefined translation key {{$translations.nope}} — expected a key of translations.yaml whose value is text",
    );
  },
};

/** The header menu lists each declared language by its own name and reports the pick. */
export const MenuPicksALanguage: StoryObj<typeof LanguageMenu> = {
  render: (args) => <LanguageMenu {...args} />,
  args: { languages: ["en", "fr"], language: "en", onChoose: fn() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Language" }));
    // The popup is portalled to <body>, outside the story's canvas.
    const french = await within(document.body).findByRole("menuitemradio", {
      name: "Français",
    });
    await userEvent.click(french);
    await expect(args.onChoose).toHaveBeenCalledWith("fr");
  },
};
