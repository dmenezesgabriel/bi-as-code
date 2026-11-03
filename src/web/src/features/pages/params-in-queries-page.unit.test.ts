// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { interpolateQuery } from "./interpolate";

const PAGE = readFileSync(
  path.join(
    import.meta.dirname,
    "../../../../../docs/pages/sql/params-in-queries.md",
  ),
  "utf-8",
);

/** The SQL of the page's ` ```sql <name> ` fence; throws when the page has none. */
function fenceSql(name: string): string {
  const match = new RegExp(
    "```sql " + name + "(?: [a-z]+)*\\n([\\s\\S]*?)\\n```",
  ).exec(PAGE);
  if (match?.[1] === undefined) {
    throw new Error(
      `docs/pages/sql/params-in-queries.md has no sql fence named "${name}"`,
    );
  }
  return match[1];
}

describe("the Parameters in queries reference", () => {
  it("quotes the SQL the database receives for its composed example", () => {
    // Arrange
    const queries = { islands_named: fenceSql("islands_named") };

    // Act
    const { sql, errors } = interpolateQuery(
      fenceSql("species_on_named_islands"),
      { params: {}, queries },
    );

    // Assert — a paraphrase would show a reader SQL the page never runs.
    expect(errors).toEqual([]);
    expect(PAGE).toContain(sql);
  });

  it("quotes the unknown-token error verbatim", () => {
    // Arrange
    const context = { params: {}, queries: {} };

    // Act
    const { errors } = interpolateQuery("select {{nope}}", context);

    // Assert — a paraphrased message would send a reader to search for text the page never prints.
    expect(errors).toHaveLength(1);
    expect(PAGE).toContain(errors[0]);
  });

  it("quotes the circular-reference error verbatim", () => {
    // Arrange
    const queries = {
      first_pass: "select * from {{second_pass}}",
      second_pass: "select * from {{first_pass}}",
    };

    // Act — the registry seeds `active` with the block's own name.
    const { errors } = interpolateQuery(
      queries.first_pass,
      { params: {}, queries },
      new Set(["first_pass"]),
    );

    // Assert
    expect(errors).toHaveLength(1);
    expect(PAGE).toContain(errors[0]);
  });
});
