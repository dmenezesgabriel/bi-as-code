import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { CardsProvider, NoCardScope } from "./card-scope";
import { withCard } from "./with-card";

function Chart({ label }: { label: string }) {
  return <p>{label}</p>;
}

const CardedChart = withCard(Chart);

function Panel({ children }: { children: ReactNode }) {
  return <section>{children}</section>;
}

const cardOf = (text: string) =>
  screen.getByText(text).closest("[data-widget-card]");

const cardCount = (container: HTMLElement) =>
  container.querySelectorAll("[data-widget-card]").length;

describe("withCard", () => {
  it("puts the widget on a card when cards are on", () => {
    // Arrange / Act
    render(
      <CardsProvider cards>
        <CardedChart label="revenue" />
      </CardsProvider>,
    );

    // Assert
    expect(cardOf("revenue")).not.toBeNull();
  });

  it.each([
    ["cards are off", false],
    ["no provider is mounted", undefined],
  ])("renders the widget bare when %s", (_case, cards) => {
    // Arrange / Act
    const chart = <CardedChart label="revenue" />;
    render(
      cards === undefined ? (
        chart
      ) : (
        <CardsProvider cards={cards}>{chart}</CardsProvider>
      ),
    );

    // Assert
    expect(screen.getByText("revenue")).toBeInTheDocument();
    expect(cardOf("revenue")).toBeNull();
  });

  it("gives a widget nested in a carded widget no second card", () => {
    // Arrange
    const CardedPanel = withCard(Panel);

    // Act
    const { container } = render(
      <CardsProvider cards>
        <CardedPanel>
          <CardedChart label="inner" />
        </CardedPanel>
      </CardsProvider>,
    );

    // Assert
    expect(cardCount(container)).toBe(1);
  });

  it("gives a widget inside a NoCardScope no card", () => {
    // Arrange / Act
    const { container } = render(
      <CardsProvider cards>
        <NoCardScope>
          <CardedChart label="boxed" />
        </NoCardScope>
      </CardsProvider>,
    );

    // Assert
    expect(cardCount(container)).toBe(0);
  });

  it("cards sibling widgets one each", () => {
    // Arrange / Act
    const { container } = render(
      <CardsProvider cards>
        <CardedChart label="a" />
        <CardedChart label="b" />
      </CardsProvider>,
    );

    // Assert
    expect(cardCount(container)).toBe(2);
  });

  it("names the wrapped widget for React devtools", () => {
    expect(CardedChart.displayName).toBe("withCard(Chart)");
  });
});
