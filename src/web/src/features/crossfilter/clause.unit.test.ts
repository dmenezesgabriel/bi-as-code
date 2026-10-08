import { describe, expect, it } from "vitest";
import {
  clauseInterval,
  clauseList,
  clauseMatch,
  clauseNone,
  clausePoint,
  composeAnd,
  composeOr,
} from "./clause";
import type { FilterPredicate, QueryClient } from "./types";

/** A stand-in clause source — identity, not shape, is what resolution keys on. */
const source = {};

const client: QueryClient = {
  query: () => undefined,
  queryPending: () => {},
  queryResult: () => {},
  queryError: () => {},
};

describe("clausePoint", () => {
  it("binds a scalar as an equality predicate", () => {
    expect(clausePoint("region", "West", { source })).toEqual({
      meta: { type: "point" },
      source,
      clients: undefined,
      fields: ["region"],
      value: "West",
      predicate: { sql: "region = ?", params: ["West"] },
    });
  });

  it("clears on an undefined value", () => {
    expect(clausePoint("region", undefined, { source }).predicate).toBeNull();
  });

  it("clears on a null value — our filter values treat null as cleared", () => {
    expect(clausePoint("region", null, { source }).predicate).toBeNull();
  });

  it("carries the clients that skip this clause under cross-filtering", () => {
    const clause = clausePoint("region", "West", {
      source,
      clients: new Set([client]),
    });
    expect(clause.clients).toEqual(new Set([client]));
  });
});

describe("clauseList", () => {
  it("binds multiple values as one IN predicate", () => {
    expect(clauseList("region", ["West", "North"], { source })).toEqual({
      meta: { type: "list" },
      source,
      clients: undefined,
      fields: ["region"],
      value: ["West", "North"],
      predicate: { sql: "region IN (?, ?)", params: ["West", "North"] },
    });
  });

  it("binds a single-element array as IN with one hole", () => {
    expect(clauseList("channel", ["online"], { source }).predicate).toEqual({
      sql: "channel IN (?)",
      params: ["online"],
    });
  });

  it("clears on an empty array — an empty list clears, never filters all out", () => {
    expect(clauseList("region", [], { source }).predicate).toBeNull();
  });

  it("clears on an undefined value", () => {
    expect(clauseList("region", undefined, { source }).predicate).toBeNull();
  });
});

describe("clauseInterval", () => {
  it("binds a closed extent as BETWEEN", () => {
    expect(clauseInterval("amount", [10, 20], { source })).toEqual({
      meta: { type: "interval" },
      source,
      clients: undefined,
      fields: ["amount"],
      value: [10, 20],
      predicate: { sql: "amount BETWEEN ? AND ?", params: [10, 20] },
    });
  });

  it("degrades a lo-only extent to >=", () => {
    expect(
      clauseInterval("amount", [10, undefined], { source }).predicate,
    ).toEqual({
      sql: "amount >= ?",
      params: [10],
    });
  });

  it("degrades a hi-only extent to <=", () => {
    expect(
      clauseInterval("amount", [undefined, 20], { source }).predicate,
    ).toEqual({ sql: "amount <= ?", params: [20] });
  });

  it("clears on a fully open extent", () => {
    expect(
      clauseInterval("amount", [undefined, undefined], { source }).predicate,
    ).toBeNull();
  });

  it("clears on a null or undefined extent", () => {
    expect(clauseInterval("amount", null, { source }).predicate).toBeNull();
    expect(
      clauseInterval("amount", undefined, { source }).predicate,
    ).toBeNull();
  });
});

describe("clauseMatch", () => {
  it("binds a case-insensitive contains by default", () => {
    expect(clauseMatch("region", "West", { source })).toEqual({
      meta: { type: "match", method: "contains" },
      source,
      clients: undefined,
      fields: ["region"],
      value: "West",
      predicate: { sql: "contains(lower(region), lower(?))", params: ["West"] },
    });
  });

  it("binds prefix, suffix and regexp methods", () => {
    const options = { source } as const;
    expect(
      clauseMatch("region", "We", { ...options, method: "prefix" }).predicate,
    ).toEqual({
      sql: "prefix(lower(region), lower(?))",
      params: ["We"],
    });
    expect(
      clauseMatch("region", "st", { ...options, method: "suffix" }).predicate,
    ).toEqual({
      sql: "suffix(lower(region), lower(?))",
      params: ["st"],
    });
    expect(
      clauseMatch("region", "W.st", { ...options, method: "regexp" }).predicate,
    ).toEqual({
      sql: "regexp_matches(lower(region), lower(?))",
      params: ["W.st"],
    });
  });

  it("skips the lower() transform when caseSensitive", () => {
    expect(
      clauseMatch("region", "West", { source, caseSensitive: true }).predicate,
    ).toEqual({ sql: "contains(region, ?)", params: ["West"] });
  });

  it("clears on a falsy value", () => {
    expect(clauseMatch("region", "", { source }).predicate).toBeNull();
    expect(clauseMatch("region", undefined, { source }).predicate).toBeNull();
  });
});

describe("clauseNone", () => {
  it("carries a null predicate and no metadata — its only job is clearing", () => {
    const clause = clauseNone(source);
    expect(clause).toEqual({
      source,
      fields: [],
      value: null,
      predicate: null,
    });
    expect("meta" in clause).toBe(false);
  });
});

describe("composeAnd", () => {
  const p1: FilterPredicate = { sql: "region = ?", params: ["West"] };
  const p2: FilterPredicate = { sql: "channel = ?", params: ["online"] };

  it("returns undefined for no fragments — nothing contributes", () => {
    expect(composeAnd([])).toBeUndefined();
  });

  it("returns a lone fragment unwrapped", () => {
    expect(composeAnd([p1])).toBe(p1);
  });

  it("joins fragments parenthesized with params in clause order", () => {
    expect(composeAnd([p1, p2])).toEqual({
      sql: "(region = ?) AND (channel = ?)",
      params: ["West", "online"],
    });
  });
});

describe("composeOr", () => {
  const p1: FilterPredicate = { sql: "region = ?", params: ["West"] };
  const p2: FilterPredicate = { sql: "channel = ?", params: ["online"] };

  it("returns undefined for no fragments", () => {
    expect(composeOr([])).toBeUndefined();
  });

  it("returns a lone fragment unwrapped", () => {
    expect(composeOr([p1])).toBe(p1);
  });

  it("joins fragments parenthesized so each stays self-contained", () => {
    expect(composeOr([p1, p2])).toEqual({
      sql: "(region = ?) OR (channel = ?)",
      params: ["West", "online"],
    });
  });
});
