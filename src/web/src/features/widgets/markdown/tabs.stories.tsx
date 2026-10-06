import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { EChart } from "../charts/echart";
import { carrierChildrenEls } from "./carrier-children.fixture";
import { Tab, Tabs } from "./tabs";
import type { TabProps, TabsProps } from "./types";

const tabEls = (
  specs: ReadonlyArray<readonly [string, string, Partial<TabProps>?]>,
) => carrierChildrenEls(Tab, specs);

const BAR_OPTION = {
  xAxis: { type: "category" as const, data: ["North", "South", "West"] },
  yAxis: {},
  series: [{ type: "bar" as const, data: [4800, 3700, 6100] }],
};

const meta = {
  title: "Widgets/Tabs",
  component: Tabs,
  args: {
    children: tabEls([
      ["Chart", "Orders and revenue track together across the quarter."],
      ["Table", "A row per region with orders, revenue and WoW change."],
      ["Notes", "Figures come from the orders data set."],
    ]),
  },
} satisfies Meta<TabsProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: an underline list, first tab selected; clicking
 * another tab swaps the visible panel. */
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("tab", { name: "Chart" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(canvas.getByText(/Orders and revenue/)).toBeVisible();

    await userEvent.click(canvas.getByRole("tab", { name: "Table" }));
    await expect(canvas.getByRole("tab", { name: "Table" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(canvas.getByText(/row per region/)).toBeVisible();
  },
};

/** `variant="well"` — the list becomes a fitted pill track. */
export const WellVariant: Story = {
  args: { variant: "well" },
  play: async ({ canvas }) => {
    const list = canvas.getByRole("tablist");
    await expect(list.className).toContain("rounded-lg");
    await userEvent.click(canvas.getByRole("tab", { name: "Notes" }));
    await expect(canvas.getByRole("tab", { name: "Notes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  },
};

/** `fullWidth` spreads the triggers evenly across the container. */
export const FullWidth: Story = {
  args: { fullWidth: true },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("tab", { name: "Chart" }).className,
    ).toContain("flex-1");
    await expect(canvas.getByRole("tablist").className).toContain(
      "justify-center",
    );
  },
};

/** `default` on a `<Tab>` selects it on load instead of the first. */
export const DefaultTab: Story = {
  args: {
    children: tabEls([
      ["Chart", "chart panel"],
      ["Table", "table panel", { default: true }],
    ]),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("tab", { name: "Table" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  },
};

/** Arrow keys move between tabs and select on focus (activateOnFocus). */
export const KeyboardNav: Story = {
  play: async ({ canvas }) => {
    canvas.getByRole("tab", { name: "Chart" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("tab", { name: "Table" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  },
};

/** Panels stay mounted while hidden: form state inside a tab survives
 * switching away and back. */
export const KeepsPanelState: Story = {
  args: {
    children: [
      <Tab key="form" title="Filter">
        <input aria-label="Region filter" placeholder="e.g. West" />
      </Tab>,
      <Tab key="other" title="Summary">
        summary panel
      </Tab>,
    ],
  },
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText("Region filter");
    await userEvent.type(input, "West");
    await userEvent.click(canvas.getByRole("tab", { name: "Summary" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Filter" }));
    await expect(input).toHaveValue("West");
  },
};

/** A chart inside an initially hidden panel mounts at zero width; the
 * ResizeObserver in EChart must repaint it at real size on reveal —
 * this is what keepMounted relies on. */
export const ChartInHiddenPanel: Story = {
  args: {
    children: [
      <Tab key="notes" title="Notes">
        prose first
      </Tab>,
      <Tab key="chart" title="Chart">
        <EChart option={BAR_OPTION} height={240} />
      </Tab>,
    ],
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Chart" }));
    const host = canvasElement.querySelector("[data-echarts-theme]");
    await waitFor(() => expect(host).toHaveAttribute("data-echarts-ready", ""));
    const chartCanvas = host?.querySelector("canvas");
    expect(chartCanvas?.getBoundingClientRect().width).toBeGreaterThan(0);
  },
};

/** More tabs than fit the container — the list scrolls horizontally
 * instead of overflowing the page. */
export const OverflowScrolls: Story = {
  args: {
    children: tabEls([
      ["Quarterly revenue by region", "q1"],
      ["Order volume by channel", "q2"],
      ["Returns and cancellations", "q3"],
      ["Average order value trend", "q4"],
      ["Top accounts concentration", "q5"],
    ]),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const listWrap = canvasElement.querySelector(".overflow-x-auto");
    expect(listWrap?.scrollWidth).toBeGreaterThan(listWrap?.clientWidth ?? 0);
  },
};

/** A non-Tab child renders the family's inline alert — MDX children
 * bypass the type system, so the contract runs at render time. */
export const MisuseStrayChild: Story = {
  args: {
    children: [
      <Tab key="one" title="One">
        one
      </Tab>,
      <p key="stray">A stray paragraph</p>,
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Tab");
    await expect(canvas.queryByRole("tablist")).toBeNull();
  },
};

/** A `<Tab>` without `title` renders the inline alert. */
export const MisuseMissingTitle: Story = {
  args: {
    children: [<Tab key="one" {...({ children: "orphan" } as TabProps)} />],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("title");
  },
};

/** Two `default` tabs render the inline alert. */
export const MisuseTwoDefaults: Story = {
  args: {
    children: tabEls([
      ["One", "one", { default: true }],
      ["Two", "two", { default: true }],
    ]),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("default");
  },
};

/** `<Tab>` rendered outside `<Tabs>` reports the misuse inline. */
export const TabAlone: Story = {
  render: () => <Tab title="Orphan">orphan panel</Tab>,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("<Tabs>");
    await expect(canvas.queryByText("orphan panel")).toBeNull();
  },
};

/** Under `.dark` the list and triggers repaint in the dark palette. */
export const Dark: Story = {
  globals: { theme: "dark" },
  args: { variant: "well" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("tablist").className).toContain(
      "dark:bg-neutral-800",
    );
  },
};
