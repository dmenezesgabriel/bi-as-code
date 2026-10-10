import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ProseH1,
  ProseH2,
  ProseH3,
  ProseH4,
  ProseH5,
  ProseH6,
  ProseParagraph,
} from "./prose-elements";

const headings = [
  [1, ProseH1],
  [2, ProseH2],
  [3, ProseH3],
  [4, ProseH4],
  [5, ProseH5],
  [6, ProseH6],
] as const;

describe("prose headings", () => {
  it.each(headings)("renders a level-%i heading", (level, Heading) => {
    // Arrange / Act
    render(<Heading>Orders</Heading>);

    // Assert
    expect(
      screen.getByRole("heading", { level, name: "Orders" }),
    ).toBeVisible();
  });

  it("keeps an author id so the ToC can link to it", () => {
    render(<ProseH2 id="revenue">Revenue</ProseH2>);

    expect(screen.getByRole("heading", { level: 2 })).toHaveAttribute(
      "id",
      "revenue",
    );
  });

  it("gives each level a distinct type scale", () => {
    render(
      <>
        <ProseH1>One</ProseH1>
        <ProseH2>Two</ProseH2>
        <ProseH3>Three</ProseH3>
      </>,
    );

    const classes = screen
      .getAllByRole("heading")
      .map((heading) => heading.className);
    expect(new Set(classes).size).toBe(3);
  });
});

describe("prose paragraph", () => {
  it("renders a p that merges a caller class over its own", () => {
    const { container } = render(
      <ProseParagraph className="mb-0">Order volume.</ProseParagraph>,
    );

    const paragraph = container.querySelector("p");
    expect(paragraph).toHaveTextContent("Order volume.");
    expect(paragraph?.className.split(" ")).toContain("mb-0");
    expect(paragraph?.className).not.toContain("mb-[1.2em]");
  });
});
