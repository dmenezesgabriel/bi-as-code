import { describe, expect, it } from "vitest";
import { holdsFilterValue } from "./filter-value";

describe("holdsFilterValue", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty string", ""],
    ["an empty list", []],
    ["false", false],
  ])("is false for %s", (_label, value) => {
    expect(holdsFilterValue(value)).toBe(false);
  });

  it.each([
    ["a string", "West"],
    ["a non-empty list", ["web"]],
    ["true", true],
    ["zero", 0],
    ["a range pair", [0, 500]],
  ])("is true for %s", (_label, value) => {
    expect(holdsFilterValue(value)).toBe(true);
  });
});
