import { describe, expect, it } from "vitest";
import { tableFromJSON } from "apache-arrow";
import { toRows } from "./to-rows";

describe("toRows", () => {
  it("converts an Arrow table into plain row objects", () => {
    const table = tableFromJSON([
      { region: "West", total: 12.5 },
      { region: "East", total: 7 },
    ]);

    const rows = toRows(table);

    expect(rows).toEqual([
      { region: "West", total: 12.5 },
      { region: "East", total: 7 },
    ]);
  });

  it("hands out plain objects, not Arrow row proxies", () => {
    const table = tableFromJSON([{ region: "West" }]);

    const [row] = toRows(table);

    expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
    expect(row).not.toHaveProperty("toJSON");
  });

  it("preserves nulls in typed columns and returns no rows for an empty table", () => {
    // A null in a typed column — what a real DuckDB result emits. (A
    // tableFromJSON column of only nulls is inferred away entirely, so the
    // null rides beside a real value to keep the field in the schema.)
    const table = tableFromJSON([
      { region: "West", total: 1 },
      { region: "East", total: null },
    ]);

    expect(toRows(table)).toEqual([
      { region: "West", total: 1 },
      { region: "East", total: null },
    ]);
    expect(toRows(tableFromJSON([]))).toEqual([]);
  });
});
