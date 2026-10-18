import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect } from "storybook/test";
import { Accordion, AccordionItem } from "../markdown/accordion";
import { Tab, Tabs } from "../markdown/tabs";
import { CardsProvider } from "./card-scope";
import { withCard } from "./with-card";

/** A stand-in for a chart: carding never looks inside the widget. */
function ChartPlaceholder({ label }: { label: string }) {
  return (
    <div role="figure" aria-label={label} className="h-32 text-sm">
      {label}
    </div>
  );
}

const CardedChart = withCard(ChartPlaceholder);

/** The page column a carded page renders: tinted, one block gap apart. */
function CardedPage({
  cards,
  children,
}: {
  cards: boolean;
  children: ReactNode;
}) {
  return (
    <CardsProvider cards={cards}>
      <div className="space-y-block-gap bg-card-mode-background p-6">
        {children}
      </div>
    </CardsProvider>
  );
}

const meta = {
  title: "Widgets/Card",
  component: CardedPage,
  args: {
    cards: true,
    children: (
      <>
        <CardedChart label="Revenue" />
        <CardedChart label="Orders" />
      </>
    ),
  },
} satisfies Meta<typeof CardedPage>;

export default meta;
type Story = StoryObj<typeof meta>;

const cardCount = (root: HTMLElement) =>
  root.querySelectorAll("[data-widget-card]").length;

/** `cards: true`: each widget sits on its own bordered card. */
export const Carded: Story = {
  play: async ({ canvasElement, canvas }) => {
    await expect(cardCount(canvasElement)).toBe(2);
    const card = canvas
      .getByRole("figure", { name: "Revenue" })
      .closest("[data-widget-card]") as HTMLElement;
    await expect(getComputedStyle(card).backgroundColor).toBe(
      "rgb(255, 255, 255)",
    );
  },
};

/** `cards` off: the same widgets render bare. */
export const Uncarded: Story = {
  args: { cards: false },
  play: async ({ canvasElement }) => {
    await expect(cardCount(canvasElement)).toBe(0);
  },
};

/** A chart inside a tab panel gets exactly one card — tabs draw no box. */
export const InsideTabs: Story = {
  args: {
    children: (
      <Tabs>
        <Tab title="Trend">
          <CardedChart label="Trend" />
        </Tab>
        <Tab title="Mix">
          <CardedChart label="Mix" />
        </Tab>
      </Tabs>
    ),
  },
  play: async ({ canvas }) => {
    const chart = canvas.getByRole("figure", { name: "Trend" });
    await expect(chart.closest("[data-widget-card]")).not.toBeNull();
    await expect(
      chart.closest("[role=tabpanel]")?.querySelectorAll("[data-widget-card]"),
    ).toHaveLength(1);
  },
};

/** A `card` accordion is the card: its chart gets none of its own. */
export const InsideCardAccordion: Story = {
  args: {
    children: (
      <Accordion variant="card">
        <AccordionItem title="Breakdown" open>
          <CardedChart label="Breakdown" />
        </AccordionItem>
      </Accordion>
    ),
  },
  play: async ({ canvasElement, canvas }) => {
    await expect(
      canvas.getByRole("figure", { name: "Breakdown" }),
    ).toBeVisible();
    await expect(cardCount(canvasElement)).toBe(0);
  },
};

/** Dark: the card stays lighter than the page, which takes no tint. */
export const Dark: Story = {
  globals: { theme: "dark" },
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector(
      "[data-widget-card]",
    ) as HTMLElement;
    await expect(getComputedStyle(card).backgroundColor).toBe(
      "rgb(23, 23, 23)",
    );
    await expect(
      getComputedStyle(card.parentElement as HTMLElement).backgroundColor,
    ).toBe("rgb(10, 10, 10)");
  },
};
