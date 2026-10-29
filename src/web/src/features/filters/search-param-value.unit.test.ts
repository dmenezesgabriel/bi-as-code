import { describe, expect, it } from "vitest";
import { decodeSearchParam } from "./search-param-value";

describe("decodeSearchParam", () => {
  it.each([
    ["a boolean", "true", true],
    ["a number", "30", 30],
    ["a JSON list", '["a","b"]', ["a", "b"]],
    ["a non-JSON string", "Dream", "Dream"],
    ["an absent param", null, null],
  ])(
    "decodes %s as the router's search parser does",
    (_label, raw, expected) => {
      expect(decodeSearchParam(raw)).toEqual(expected);
    },
  );
});
