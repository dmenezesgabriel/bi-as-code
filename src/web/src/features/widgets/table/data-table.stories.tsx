import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import type { Row } from "../../data/types";
import { DataTable } from "./data-table";
import { resolveTableColumns } from "./table-columns";

const ROWS: Row[] = Array.from({ length: 39 }, (_, i) => ({
  week: `w${i + 1}`,
  region: ["West", "North", "South"][i % 3],
  orders: 100 - i,
}));

const meta: Meta<typeof DataTable> = {
  title: "Widgets/DataTable",
  component: DataTable,
  args: { rows: ROWS, pageSize: 10 },
};

export default meta;

type Story = StoryObj<typeof DataTable>;

/** Over `pageSize` rows: first page shows 10, the pager reports position. */
export const Paginated: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("row")).toHaveLength(11);
    await expect(canvas.getByText("Page 1 of 4 · 39 rows")).toBeVisible();
    // WCAG 2.2 SC 2.5.8: each adjacent pager button needs a 24×24 box.
    const pagerButtons = canvas.getAllByRole("button", { name: /page$/ });
    await expect(pagerButtons).toHaveLength(4);
    for (const button of pagerButtons) {
      const { width, height } = button.getBoundingClientRect();
      await expect({ width, height }).toEqual({ width: 24, height: 24 });
    }
  },
};

/** Header clicks cycle none → desc → asc → none with `aria-sort` tracking. */
export const SortCycle: Story = {
  play: async ({ canvas }) => {
    const header = canvas.getByRole("columnheader", { name: "Orders" });
    const button = canvas.getByRole("button", { name: "Orders" });
    await expect(header).toHaveAttribute("aria-sort", "none");

    await userEvent.click(button);
    await expect(header).toHaveAttribute("aria-sort", "descending");

    await userEvent.click(button);
    await expect(header).toHaveAttribute("aria-sort", "ascending");

    await userEvent.click(button);
    await expect(header).toHaveAttribute("aria-sort", "none");
  },
};

/** The pager steps through pages and clamps at the bounds. */
export const PagerNavigation: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Last page" }));
    await expect(canvas.getByText("Page 4 of 4 · 39 rows")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Next page" }),
    ).toBeDisabled();
    await expect(canvas.getAllByRole("row")).toHaveLength(10);
  },
};

/** One page of rows hides the pager entirely. */
export const SinglePage: Story = {
  args: { rows: ROWS.slice(0, 3) },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/Page \d+ of \d+/)).toBeNull();
  },
};

/** An empty result is a state of its own, not a table with no rows. */
export const Empty: Story = {
  args: { rows: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("0 rows")).toBeVisible();
    await expect(canvas.queryByRole("table")).toBeNull();
  },
};

const REVENUE: Row[] = [
  { region: "West", revenue: 6100, share: 0.394, note: null },
  { region: "North", revenue: 4800, share: 0.31, note: "flat" },
  { region: "South", revenue: 3700, share: 0.296, note: null },
];

/** Without `columns`, numbers render `num0` — grouped, no decimals — and
 * nulls render empty. */
export const FormattedNumbers: Story = {
  args: { rows: REVENUE },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("cell", { name: "6,100" })).toBeVisible();
    await expect(canvas.getAllByRole("cell", { name: "0" })).toHaveLength(3);
  },
};

/** `columns` picks, orders, titles and formats; `usd` scales against the
 * column's range so every cell reads in thousands. */
export const ChosenColumns: Story = {
  args: {
    rows: REVENUE,
    columns: resolveTableColumns(REVENUE, [
      { id: "revenue", fmt: "usd", title: "Revenue" },
      { id: "share", fmt: "pct1", title: "Share" },
      { id: "region", title: "Region" },
    ]),
  },
  play: async ({ canvas }) => {
    const headers = canvas.getAllByRole("columnheader");
    await expect(headers.map((th) => th.textContent)).toEqual([
      "Revenue",
      "Share",
      "Region",
    ]);
    await expect(canvas.getByRole("cell", { name: "$4k" })).toBeVisible();
    await expect(canvas.getByRole("cell", { name: "39.4%" })).toBeVisible();
  },
};

/** Without `columns`, snake_case result names read as title-cased words
 * (`id` upper-cased), and a capitalized SQL alias is kept as written. The
 * sort button is named by the same text. */
export const HumanizedHeaders: Story = {
  args: {
    rows: [
      {
        order_id: 1,
        order_date: "2026-07-06",
        pct_of_total: 0.4,
        "Revenue (USD)": 40,
      },
    ],
  },
  play: async ({ canvas }) => {
    const headers = canvas.getAllByRole("columnheader");
    await expect(headers.map((th) => th.textContent)).toEqual([
      "Order ID",
      "Order Date",
      "Pct of Total",
      "Revenue (USD)",
    ]);
    await userEvent.click(canvas.getByRole("button", { name: "Order ID" }));
    await expect(
      canvas.getByRole("columnheader", { name: "Order ID" }),
    ).toHaveAttribute("aria-sort", "descending");
  },
};
