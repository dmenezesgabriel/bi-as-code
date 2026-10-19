import { describe, expect, it } from "vitest";
import { searchClause } from "./search-clause";

const SOURCE = {};

describe("searchClause — predicate", () => {
  it.each([
    ["contains", "contains(lower(region), lower(?))"],
    ["prefix", "prefix(lower(region), lower(?))"],
    ["suffix", "suffix(lower(region), lower(?))"],
  ] as const)("matches the %s method case-insensitively", (method, sql) => {
    const clause = searchClause(method)("region", "We", { source: SOURCE });

    expect(clause.predicate).toEqual({ sql, params: ["We"] });
  });

  it("carries the source it was published for", () => {
    const clause = searchClause("contains")("region", "we", {
      source: SOURCE,
    });

    expect(clause.source).toBe(SOURCE);
  });
});

describe("searchClause — empty text", () => {
  it.each([
    ["a cleared value", undefined],
    ["an empty string", ""],
  ])("publishes no predicate for %s", (_label, value) => {
    const clause = searchClause("contains")("region", value, {
      source: SOURCE,
    });

    expect(clause.predicate).toBeNull();
  });
});
