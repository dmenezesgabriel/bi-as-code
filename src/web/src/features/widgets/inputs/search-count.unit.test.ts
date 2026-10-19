import { describe, expect, it } from "vitest";
import { countShape, formatMatchCount } from "./search-count";

describe("formatMatchCount", () => {
  it("reads 'No matches' at zero", () => {
    expect(formatMatchCount(0)).toBe("No matches");
  });

  it("reads '1 match' in the singular", () => {
    expect(formatMatchCount(1)).toBe("1 match");
  });

  it("reads a small plural as a whole number", () => {
    expect(formatMatchCount(3)).toBe("3 matches");
  });

  it("groups thousands in the plural", () => {
    expect(formatMatchCount(1234)).toBe("1,234 matches");
  });
});

describe("countShape", () => {
  it("counts the fence's rows under the predicate, binding both param lists", () => {
    const query = countShape(
      { sql: "select * from orders where id > ?", params: [3], errors: [] },
      { sql: "contains(lower(region), lower(?))", params: ["we"] },
    );

    expect(query).toEqual({
      sql: "select count(*) as match_count from (select * from orders where id > ?) where contains(lower(region), lower(?))",
      params: [3, "we"],
      errors: [],
    });
  });
});
