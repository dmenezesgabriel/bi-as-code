import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Note } from "./note";

describe("Note", () => {
  it("renders children as a muted text-xs block", () => {
    render(<Note>Report data sourced from the warehouse</Note>);

    const note = screen.getByText("Report data sourced from the warehouse");
    expect(note.className).toContain("text-xs");
    expect(note.className).toContain("text-muted-foreground-faded");
  });
});
