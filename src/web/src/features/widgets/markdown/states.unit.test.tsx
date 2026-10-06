import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WidgetError } from "./states";

describe("WidgetError", () => {
  it("renders the tag name and message as an inline alert", () => {
    render(
      <WidgetError name="Tab" message="must be a direct child of <Tabs>" />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Tab");
    expect(alert).toHaveTextContent("must be a direct child of <Tabs>");
    expect(alert.className).toContain("border-red-200");
  });
});
