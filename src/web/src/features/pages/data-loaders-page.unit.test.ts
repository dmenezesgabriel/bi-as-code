// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DOCS_ROOT = path.join(import.meta.dirname, "../../../../../docs");
const PAGE = readFileSync(
  path.join(DOCS_ROOT, "pages/sql/data-loaders.md"),
  "utf-8",
);

describe("the Data loaders reference", () => {
  it("shows data/island-summary.csv.js exactly as it is on disk", () => {
    // Arrange
    const source = readFileSync(
      path.join(DOCS_ROOT, "data/island-summary.csv.js"),
      "utf-8",
    );

    // Act
    const shown = PAGE.includes(source.trimEnd());

    // Assert — a retyped loader would show a reader a program the page never runs.
    expect(shown).toBe(true);
  });

  it("registers the loader's output, not the loader, in its sql front-matter", () => {
    // Arrange
    const front = PAGE.split("---")[1] ?? "";

    // Act
    const registered = front.includes("data/island-summary.csv");

    // Assert — DuckDB reads the generated file; it never opens program source.
    expect(registered).toBe(true);
    expect(front).not.toContain("island-summary.csv.js");
  });
});
