import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { CardsProvider } from "../card/card-scope";
import { withCard } from "../card/with-card";
import { Accordion, AccordionItem } from "./accordion";
import { carrierChildrenEls } from "./carrier-children.fixture";
import type {
  AccordionItemProps,
  AccordionProps,
  AccordionVariant,
} from "./types";

const itemEls = (
  specs: ReadonlyArray<readonly [string, string, Partial<AccordionItemProps>?]>,
) => carrierChildrenEls(AccordionItem, specs);

const TWO_ITEMS = itemEls([
  ["Methodology", "methodology panel"],
  ["Data quality", "quality panel"],
]);

function renderAccordion(
  children: ReactNode = TWO_ITEMS,
  props: Partial<AccordionProps> = {},
) {
  return render(
    <Accordion {...(props as AccordionProps)}>{children}</Accordion>,
  );
}

const trigger = (name: string) => screen.getByRole("button", { name });
const panelOf = (text: string) =>
  screen.getByText(text).closest("[role=region]");

describe("Accordion", () => {
  it("renders one heading-wrapped trigger per item, all collapsed by default", () => {
    renderAccordion();

    expect(trigger("Methodology")).toHaveAttribute("aria-expanded", "false");
    expect(trigger("Data quality")).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("heading", { name: "Methodology" }),
    ).toBeInTheDocument();
  });

  it("keeps closed panels mounted for find-in-page (hidden=until-found)", () => {
    renderAccordion();

    expect(panelOf("methodology panel")).toHaveAttribute(
      "hidden",
      "until-found",
    );
  });

  it("toggles the panel on trigger click", () => {
    renderAccordion();
    const button = trigger("Methodology");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("data-panel-open");
    expect(panelOf("methodology panel")).not.toHaveAttribute("hidden");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("lets two items stay open at once by default", () => {
    renderAccordion();

    fireEvent.click(trigger("Methodology"));
    fireEvent.click(trigger("Data quality"));

    expect(trigger("Methodology")).toHaveAttribute("aria-expanded", "true");
    expect(trigger("Data quality")).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses the open item when another opens under single", () => {
    renderAccordion(TWO_ITEMS, { single: true });

    fireEvent.click(trigger("Methodology"));
    fireEvent.click(trigger("Data quality"));

    expect(trigger("Methodology")).toHaveAttribute("aria-expanded", "false");
    expect(trigger("Data quality")).toHaveAttribute("aria-expanded", "true");
  });

  it("starts every open item expanded by default", () => {
    renderAccordion(
      itemEls([
        ["One", "one", { open: true }],
        ["Two", "two", { open: true }],
      ]),
    );

    expect(trigger("One")).toHaveAttribute("aria-expanded", "true");
    expect(trigger("Two")).toHaveAttribute("aria-expanded", "true");
  });

  it("starts only the first open item expanded under single", () => {
    renderAccordion(
      itemEls([
        ["One", "one", { open: true }],
        ["Two", "two", { open: true }],
      ]),
      { single: true },
    );

    expect(trigger("One")).toHaveAttribute("aria-expanded", "true");
    expect(trigger("Two")).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the panel when find-in-page fires beforematch", () => {
    renderAccordion();
    const panel = panelOf("methodology panel");

    fireEvent(panel!, new Event("beforematch"));

    expect(trigger("Methodology")).toHaveAttribute("aria-expanded", "true");
  });

  it("wires the chevron to rotate when the panel opens", () => {
    renderAccordion();

    // The class string is static; `data-panel-open` on the trigger (asserted
    // in the toggle test) is what activates the `group-data-*` variant.
    const chevron = trigger("Methodology").querySelector("svg");
    expect(chevron?.getAttribute("class")).toContain(
      "group-data-panel-open:rotate-180",
    );
  });

  it("applies the well-variant root classes (inset tinted surface)", () => {
    const { container } = renderAccordion(TWO_ITEMS, { variant: "well" });

    const root = container.firstElementChild;
    expect(root?.className).toContain("rounded-lg");
    expect(root?.className).toContain("bg-accent");
  });

  it("applies the card-variant root classes (raised surface)", () => {
    const { container } = renderAccordion(TWO_ITEMS, { variant: "card" });

    const root = container.firstElementChild;
    expect(root?.className).toContain("bg-card");
    expect(root?.className).toContain("shadow-xs");
  });

  it("renders an inline alert for an unknown variant", () => {
    renderAccordion(TWO_ITEMS, { variant: "fancy" as AccordionVariant });

    expect(screen.getByRole("alert")).toHaveTextContent("variant");
    expect(screen.getByRole("alert")).toHaveTextContent("fancy");
  });

  it("renders an inline alert for a non-AccordionItem element child", () => {
    renderAccordion([
      <AccordionItem key="one" title="One">
        one
      </AccordionItem>,
      <p key="stray">stray paragraph</p>,
    ]);

    expect(screen.getByRole("alert")).toHaveTextContent("AccordionItem");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders an inline alert for a non-whitespace text child", () => {
    renderAccordion([
      "stray text",
      <AccordionItem key="one" title="One">
        one
      </AccordionItem>,
    ]);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("skips whitespace-only text children", () => {
    renderAccordion([
      " ",
      <AccordionItem key="one" title="One">
        one
      </AccordionItem>,
      "\n",
      <AccordionItem key="two" title="Two">
        two
      </AccordionItem>,
    ]);

    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("renders an inline alert when an item lacks a title", () => {
    // `title` is required in AccordionItemProps; the cast mirrors the
    // untyped MDX call.
    renderAccordion(
      <AccordionItem {...({ children: "orphan" } as AccordionItemProps)} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("title");
  });

  it("renders an inline alert when empty", () => {
    renderAccordion(null);

    expect(screen.getByRole("alert")).toHaveTextContent("Accordion");
  });
});

describe("Accordion on a carded page", () => {
  const CardedChart = withCard(({ label }: { label: string }) => (
    <p>{label}</p>
  ));

  it.each([
    ["default", 1],
    ["well", 0],
    ["card", 0],
  ] as const)(
    "a %s accordion's chart gets %i card",
    (variant: AccordionVariant, cards: number) => {
      // Arrange / Act
      const { container } = render(
        <CardsProvider cards>
          <Accordion variant={variant}>
            <AccordionItem title="Trend" open>
              <CardedChart label="chart" />
            </AccordionItem>
          </Accordion>
        </CardsProvider>,
      );

      // Assert — a boxed accordion is the card; a bare one is not.
      expect(container.querySelectorAll("[data-widget-card]")).toHaveLength(
        cards,
      );
    },
  );
});

describe("AccordionItem", () => {
  it("renders an inline alert outside <Accordion>", () => {
    render(<AccordionItem title="Alone">content</AccordionItem>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("AccordionItem");
    expect(alert).toHaveTextContent("Accordion");
    expect(screen.queryByText("content")).toBeNull();
  });
});
