import { describe, expect, it } from "vitest";
import { identifier } from "./sql-identifier";

describe("identifier", () => {
  it("wraps a column name in double quotes", () => {
    const quoted = identifier("amount");

    expect(quoted).toBe('"amount"');
  });

  it("doubles an embedded double quote", () => {
    const quoted = identifier('odd"name');

    expect(quoted).toBe('"odd""name"');
  });
});
