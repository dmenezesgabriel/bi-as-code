import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Column } from "./column";

describe("Column", () => {
  it("reports its misuse inline when rendered outside <Table>", () => {
    render(<Column id="revenue" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Column: must be a direct child of <Table>",
    );
  });
});
