import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ProseBlockquote,
  ProseH1,
  ProseH2,
  ProseH3,
  ProseH4,
  ProseH5,
  ProseH6,
  ProseLink,
  ProseOrderedList,
  ProseParagraph,
  ProseTable,
  ProseTd,
  ProseTh,
  ProseUnorderedList,
} from "./prose-elements";
import { renderWithRouter } from "../chrome/router-harness";

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

describe("prose link", () => {
  it("routes an absolute-path href through the client router", async () => {
    // Arrange / Act
    await renderWithRouter(
      <ProseLink href="/nested/page">region detail</ProseLink>,
      ["/", "/nested/page"],
      "/",
    );

    // Assert
    expect(screen.getByRole("link", { name: "region detail" })).toHaveAttribute(
      "href",
      "/nested/page",
    );
  });

  it("renders an external href as a plain anchor", () => {
    render(<ProseLink href="https://example.com">docs</ProseLink>);

    expect(screen.getByRole("link", { name: "docs" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
  });

  it("styles internal and external links alike, underlined", async () => {
    await renderWithRouter(
      <>
        <ProseLink href="/nested/page">internal</ProseLink>
        <ProseLink href="https://example.com">external</ProseLink>
      </>,
      ["/", "/nested/page"],
      "/",
    );

    const internal = screen.getByRole("link", { name: "internal" });
    const external = screen.getByRole("link", { name: "external" });
    expect(internal.className.split(" ")).toContain("underline");
    expect(external.className).toBe(internal.className);
  });

  it("merges a caller class over its own", () => {
    render(
      <ProseLink href="https://example.com" className="no-underline">
        docs
      </ProseLink>,
    );

    const classes = screen.getByRole("link").className.split(" ");
    expect(classes).toContain("no-underline");
    expect(classes).not.toContain("underline");
  });
});

describe("prose table", () => {
  it("renders a table with header and body cells", () => {
    // Arrange / Act
    render(
      <ProseTable>
        <thead>
          <tr>
            <ProseTh>Channel</ProseTh>
          </tr>
        </thead>
        <tbody>
          <tr>
            <ProseTd>Direct</ProseTd>
          </tr>
        </tbody>
      </ProseTable>,
    );

    // Assert
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Channel" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "Direct" })).toBeVisible();
  });

  it("keeps a GFM column alignment, which arrives as an inline style", () => {
    render(
      <table>
        <tbody>
          <tr>
            <ProseTd style={{ textAlign: "right" }}>163</ProseTd>
          </tr>
        </tbody>
      </table>,
    );

    expect(screen.getByRole("cell")).toHaveStyle({ textAlign: "right" });
  });

  it("merges a caller class over its own", () => {
    render(
      <table>
        <thead>
          <tr>
            <ProseTh className="pr-8">Orders</ProseTh>
          </tr>
        </thead>
      </table>,
    );

    const classes = screen.getByRole("columnheader").className.split(" ");
    expect(classes).toContain("pr-8");
    expect(classes).not.toContain("pr-4");
  });
});

describe("prose measure", () => {
  const textBlocks = [
    ["p", ProseParagraph],
    ["h2", ProseH2],
    ["ul", ProseUnorderedList],
    ["ol", ProseOrderedList],
    ["blockquote", ProseBlockquote],
  ] as const;

  it.each(textBlocks)("caps a %s at the reading measure", (tag, Block) => {
    // Arrange / Act
    const { container } = render(<Block>Order volume.</Block>);

    // Assert
    const element = container.querySelector(tag);
    expect(element?.className.split(" ")).toContain("max-w-measure");
  });

  it("leaves a table the full column", () => {
    // Arrange / Act
    const { container } = render(<ProseTable />);

    // Assert
    const table = container.querySelector("table");
    expect(table?.className).not.toContain("max-w-measure");
  });

  it("lets a caller class widen a capped block", () => {
    // Arrange / Act
    const { container } = render(
      <ProseParagraph className="max-w-none">Order volume.</ProseParagraph>,
    );

    // Assert
    const classes = container.querySelector("p")?.className.split(" ");
    expect(classes).toContain("max-w-none");
    expect(classes).not.toContain("max-w-measure");
  });
});
