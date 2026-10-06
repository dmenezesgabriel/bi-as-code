import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Row } from "./row";
import type { RowAlign } from "./types";

describe("Row", () => {
  it("renders children inside a flex-wrap container with a gap", () => {
    render(
      <Row>
        <p>first</p>
        <p>second</p>
      </Row>,
    );

    const row = screen.getByText("first").parentElement!;
    expect(row.className).toContain("flex");
    expect(row.className).toContain("flex-wrap");
    expect(row.className).toContain("gap-4");
    expect(row).toHaveTextContent("second");
  });

  it("gives children equal flexible shares that wrap below the basis", () => {
    render(
      <Row>
        <p>first</p>
      </Row>,
    );

    const row = screen.getByText("first").parentElement!;
    expect(row.className).toContain("[&>*]:flex-1");
    expect(row.className).toContain("[&>*]:basis-72");
    expect(row.className).toContain("[&>*]:min-w-0");
  });

  it("defaults to stretch alignment", () => {
    render(
      <Row>
        <p>body</p>
      </Row>,
    );

    expect(screen.getByText("body").parentElement!.className).toContain(
      "items-stretch",
    );
  });

  it.each([
    ["top", "items-start"],
    ["center", "items-center"],
    ["bottom", "items-end"],
    ["stretch", "items-stretch"],
  ] as const)("align=%s maps to %s", (align, items) => {
    render(
      <Row align={align}>
        <p>body</p>
      </Row>,
    );

    expect(screen.getByText("body").parentElement!.className).toContain(items);
  });

  it("renders an inline alert naming an align outside the schema", () => {
    render(<Row align={"middle" as RowAlign}>body</Row>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Row");
    expect(alert).toHaveTextContent('"middle"');
    expect(alert).toHaveTextContent("top, center, bottom, stretch");
  });
});
