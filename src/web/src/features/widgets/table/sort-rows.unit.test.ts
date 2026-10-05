import { describe, expect, it } from "vitest";
import type { Row } from "../../data/types";
import { nextSort, sortRows } from "./sort-rows";

const columnValues = (rows: readonly Row[], column: string) =>
  rows.map((row) => row[column]);

describe("sortRows", () => {
  it("sorts numbers numerically in both directions", () => {
    const rows = [{ n: 3 }, { n: 1 }, { n: 20 }];

    expect(
      columnValues(sortRows(rows, { column: "n", direction: "asc" }), "n"),
    ).toEqual([1, 3, 20]);
    expect(
      columnValues(sortRows(rows, { column: "n", direction: "desc" }), "n"),
    ).toEqual([20, 3, 1]);
  });

  it("sorts bigint values numerically", () => {
    const rows = [{ n: 3n }, { n: 1n }, { n: 20n }];

    expect(
      columnValues(sortRows(rows, { column: "n", direction: "asc" }), "n"),
    ).toEqual([1n, 3n, 20n]);
  });

  it("compares mixed number/bigint pairs without a TypeError", () => {
    const rows = [{ n: 20 }, { n: 3n }, { n: 1 }];

    expect(
      columnValues(sortRows(rows, { column: "n", direction: "asc" }), "n"),
    ).toEqual([1, 3n, 20]);
  });

  it("sorts Date values temporally", () => {
    const rows = [
      { d: new Date("2025-03-01") },
      { d: new Date("2025-01-01") },
      { d: new Date("2025-02-01") },
    ];

    expect(
      columnValues(sortRows(rows, { column: "d", direction: "asc" }), "d"),
    ).toEqual([
      new Date("2025-01-01"),
      new Date("2025-02-01"),
      new Date("2025-03-01"),
    ]);
  });

  it("sorts other values as strings", () => {
    const rows = [{ s: "pear" }, { s: "apple" }, { s: "banana" }];

    expect(
      columnValues(sortRows(rows, { column: "s", direction: "asc" }), "s"),
    ).toEqual(["apple", "banana", "pear"]);
  });

  it("keeps null and undefined last in both directions", () => {
    const rows = [{ n: 2 }, { n: null }, { n: 1 }, { n: undefined }, { n: 3 }];

    expect(
      columnValues(sortRows(rows, { column: "n", direction: "asc" }), "n"),
    ).toEqual([1, 2, 3, null, undefined]);
    expect(
      columnValues(sortRows(rows, { column: "n", direction: "desc" }), "n"),
    ).toEqual([3, 2, 1, null, undefined]);
  });

  it("falls back to string comparison for mixed-type pairs", () => {
    const rows = [{ v: "10" }, { v: 2 }, { v: "a" }];

    expect(
      columnValues(sortRows(rows, { column: "v", direction: "asc" }), "v"),
    ).toEqual(["10", 2, "a"]);
  });

  it("does not mutate the input array", () => {
    const rows = [{ n: 2 }, { n: 1 }];

    sortRows(rows, { column: "n", direction: "asc" });

    expect(columnValues(rows, "n")).toEqual([2, 1]);
  });
});

describe("nextSort", () => {
  it("cycles a column desc → asc → none", () => {
    const desc = nextSort(null, "orders");
    expect(desc).toEqual({ column: "orders", direction: "desc" });

    const asc = nextSort(desc, "orders");
    expect(asc).toEqual({ column: "orders", direction: "asc" });

    expect(nextSort(asc, "orders")).toBeNull();
  });

  it("restarts at desc when a different column is clicked", () => {
    const current = { column: "orders", direction: "asc" as const };

    expect(nextSort(current, "region")).toEqual({
      column: "region",
      direction: "desc",
    });
  });
});
