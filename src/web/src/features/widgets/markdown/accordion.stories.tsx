import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Accordion, AccordionItem } from "./accordion";
import { carrierChildrenEls } from "./carrier-children.fixture";
import type { AccordionItemProps, AccordionProps } from "./types";

const itemEls = (
  specs: ReadonlyArray<readonly [string, string, Partial<AccordionItemProps>?]>,
) => carrierChildrenEls(AccordionItem, specs);

// The play `canvas` is storybook's bound query surface — not publicly
// exported — so helpers derive its type from `within`.
type PlayCanvas = ReturnType<typeof within>;

const clickItem = (canvas: PlayCanvas, name: string) =>
  userEvent.click(canvas.getByRole("button", { name }));

const expectExpanded = (canvas: PlayCanvas, name: string, open: boolean) =>
  expect(canvas.getByRole("button", { name })).toHaveAttribute(
    "aria-expanded",
    String(open),
  );

const meta = {
  title: "Widgets/Accordion",
  component: Accordion,
  args: {
    children: itemEls([
      ["Methodology", "Weekly figures come from the orders data set."],
      ["Data quality", "Two regions report partial coverage this week."],
      ["Definitions", "Orders count carts, not completed payments."],
    ]),
  },
} satisfies Meta<AccordionProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: a stack of titled triggers, all collapsed;
 * clicking one reveals its panel. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Methodology" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByText(/orders data set/)).toBeVisible();
  },
};

/** Default multi-open: two items stay expanded at the same time. */
export const MultiOpen: Story = {
  play: async ({ canvas }) => {
    await clickItem(canvas, "Methodology");
    await clickItem(canvas, "Data quality");
    await expectExpanded(canvas, "Methodology", true);
    await expectExpanded(canvas, "Data quality", true);
  },
};

/** `single` limits expansion to one item — opening another closes it. */
export const SingleMode: Story = {
  args: { single: true },
  play: async ({ canvas }) => {
    await clickItem(canvas, "Methodology");
    await clickItem(canvas, "Data quality");
    await expectExpanded(canvas, "Data quality", true);
    await expect(canvas.getByText(/partial coverage/)).toBeVisible();
    await expectExpanded(canvas, "Methodology", false);
  },
};

/** `open` on an item starts it expanded; under `single` only the first
 * `open` item wins. */
export const ItemOpen: Story = {
  args: {
    children: itemEls([
      ["Methodology", "methodology body"],
      ["Data quality", "quality body", { open: true }],
    ]),
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Data quality" }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByRole("button", { name: "Methodology" }),
    ).toHaveAttribute("aria-expanded", "false");
  },
};

/** `variant="well"` — the accordion sits on a tinted inset surface. */
export const WellVariant: Story = {
  args: { variant: "well" },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-slot="accordion-root"]');
    await expect(root?.className).toContain("bg-neutral-100");
    await expect(root?.className).toContain("rounded-lg");
  },
};

/** `variant="card"` — the accordion reads as a raised bordered card. */
export const CardVariant: Story = {
  args: { variant: "card" },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-slot="accordion-root"]');
    await expect(root?.className).toContain("bg-white");
    await expect(root?.className).toContain("shadow-xs");
  },
};

/** Closed panels keep `hidden="until-found"`: browser Ctrl+F reaches
 * their content and base-ui's `beforematch` handler opens the item. */
export const FindablePanel: Story = {
  play: async ({ canvas, canvasElement }) => {
    const region = canvasElement.querySelector('[role="region"]');
    await expect(region).toHaveAttribute("hidden", "until-found");

    // The DOM listener's React update lands outside act() — poll for it.
    region?.dispatchEvent(new Event("beforematch"));
    await waitFor(() => expectExpanded(canvas, "Methodology", true));
  },
};

/** A non-AccordionItem child renders the family's inline alert — MDX
 * children bypass the type system, so the contract runs at render time. */
export const MisuseStrayChild: Story = {
  args: {
    children: [
      <AccordionItem key="one" title="One">
        one
      </AccordionItem>,
      <p key="stray">A stray paragraph</p>,
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("AccordionItem");
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** An `<AccordionItem>` without `title` renders the inline alert. */
export const MisuseMissingTitle: Story = {
  args: {
    children: [
      <AccordionItem
        key="one"
        {...({ children: "orphan" } as AccordionItemProps)}
      />,
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("title");
  },
};

/** `<AccordionItem>` rendered outside `<Accordion>` reports the misuse
 * inline. */
export const AccordionItemAlone: Story = {
  render: () => <AccordionItem title="Orphan">orphan panel</AccordionItem>,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("<Accordion>");
    await expect(canvas.queryByText("orphan panel")).toBeNull();
  },
};

/** Under `.dark` the well surface and chevron repaint in the dark
 * palette. */
export const Dark: Story = {
  globals: { theme: "dark" },
  args: { variant: "well" },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-slot="accordion-root"]');
    await expect(root?.className).toContain("dark:bg-neutral-800");
  },
};
