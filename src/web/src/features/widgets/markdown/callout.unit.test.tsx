import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Callout } from "./callout";
import type { CalloutType } from "./types";

describe("Callout", () => {
  it("renders children inside a note-role panel", () => {
    render(
      <Callout>
        <p>Body copy</p>
      </Callout>,
    );

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Body copy");
  });

  it("tints info by default", () => {
    render(<Callout>body</Callout>);

    expect(screen.getByRole("note").className).toContain("bg-blue-50");
  });

  it.each([
    ["info", "bg-blue-50"],
    ["success", "bg-emerald-50"],
    ["warning", "bg-yellow-50"],
    ["error", "bg-red-50"],
  ] as const)("tints type=%s with its palette", (type, bg) => {
    render(<Callout type={type}>body</Callout>);

    const note = screen.getByRole("note");
    expect(note.className).toContain(bg);
    expect(note.className).toContain("dark:bg-");
  });

  it("renders the title as a bold heading", () => {
    render(<Callout title="Concentration risk">body</Callout>);

    const heading = screen.getByRole("heading", { name: "Concentration risk" });
    expect(heading.tagName).toBe("H4");
    expect(heading.className).toContain("font-bold");
  });

  it("renders no heading when title is unset", () => {
    render(<Callout>body</Callout>);

    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders an inline alert naming a type outside the schema", () => {
    render(<Callout type={"tip" as CalloutType}>body</Callout>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Callout");
    expect(alert).toHaveTextContent('"tip"');
    expect(alert).toHaveTextContent("info, success, warning, error");
  });
});
