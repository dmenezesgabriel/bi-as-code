// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { interpolateQuery } from "./interpolate";

const DOCS_ROOT = path.join(import.meta.dirname, "../../../../../docs");
const PAGE = readFileSync(
  path.join(DOCS_ROOT, "pages/sql/query-files.md"),
  "utf-8",
);
const QUERY_FILES = ["island_counts.sql", "penguins/island_search.sql"];

describe("the Query files reference", () => {
  it.each(QUERY_FILES)("shows queries/%s exactly as it is on disk", (name) => {
    // Arrange
    const sql = readFileSync(path.join(DOCS_ROOT, "queries", name), "utf-8");

    // Act
    const shown = PAGE.includes(sql.trimEnd());

    // Assert — a retyped file would show a reader SQL the page never runs.
    expect(shown).toBe(true);
  });

  it("quotes the circular-reference error between two files verbatim", () => {
    // Arrange — the registry seeds `active` with the block's own name.
    const queries = {
      "/queries/first_pass": "select * from {{/queries/second_pass}}",
      "/queries/second_pass": "select * from {{/queries/first_pass}}",
    };

    // Act
    const { errors } = interpolateQuery(
      queries["/queries/first_pass"],
      { params: {}, queries },
      new Set(["/queries/first_pass"]),
    );

    // Assert
    expect(errors).toHaveLength(1);
    expect(PAGE).toContain(errors[0]);
  });
});
