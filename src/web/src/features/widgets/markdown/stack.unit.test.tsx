import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stack } from "./stack";
import type { StackAlign } from "./types";

describe("Stack", () => {
  it("renders children inside a flex-col container with a gap", () => {
    render(
      <Stack>
        <p>first</p>
        <p>second</p>
      </Stack>,
    );

    const stack = screen.getByText("first").parentElement!;
    expect(stack.className).toContain("flex");
    expect(stack.className).toContain("flex-col");
    expect(stack.className).toContain("gap-4");
    expect(stack).toHaveTextContent("second");
  });

  it("lets children shrink-wrap so non-stretch aligns are visible", () => {
    render(
      <Stack align="center">
        <p>body</p>
      </Stack>,
    );

    expect(screen.getByText("body").parentElement!.className).toContain(
      "[&>*]:w-auto",
    );
  });

  it("defaults to stretch alignment", () => {
    render(
      <Stack>
        <p>body</p>
      </Stack>,
    );

    expect(screen.getByText("body").parentElement!.className).toContain(
      "items-stretch",
    );
  });

  it.each([
    ["left", "items-start"],
    ["center", "items-center"],
    ["right", "items-end"],
    ["stretch", "items-stretch"],
  ] as const)("align=%s maps to %s", (align, items) => {
    render(
      <Stack align={align}>
        <p>body</p>
      </Stack>,
    );

    expect(screen.getByText("body").parentElement!.className).toContain(items);
  });

  it("renders an inline alert naming an align outside the schema", () => {
    render(<Stack align={"half" as StackAlign}>body</Stack>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Stack");
    expect(alert).toHaveTextContent('"half"');
    expect(alert).toHaveTextContent("left, center, right, stretch");
  });
});
