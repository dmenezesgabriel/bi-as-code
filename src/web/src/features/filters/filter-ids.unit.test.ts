import { describe, expect, it } from "vitest";
import { toFilterIds } from "./filter-ids";

describe("toFilterIds", () => {
  it("maps an absent prop to no ids", () => {
    expect(toFilterIds(undefined)).toEqual([]);
  });

  it("wraps a lone id in a one-element list", () => {
    expect(toFilterIds("region")).toEqual(["region"]);
  });

  it("passes an id list through unchanged", () => {
    expect(toFilterIds(["region", "channel"])).toEqual(["region", "channel"]);
  });

  it.each([
    ["a lone id", "edit"],
    ["a list", ["region", "edit"]],
  ] as const)("rejects the editor's URL key in %s", (_case, filters) => {
    expect(() => toFilterIds(filters)).toThrow('Reserved filter id "edit"');
  });
});
