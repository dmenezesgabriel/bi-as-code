import { describe, expect, it } from "vitest";
import { isRecord, rejectUnknownKeys } from "./config-shape.js";

describe("isRecord", () => {
  it.each([
    [{}, true],
    [[], false],
    [null, false],
    ["colors", false],
  ])("treats %j as a record: %s", (value, expected) => {
    const result = isRecord(value);

    expect(result).toBe(expected);
  });
});

describe("rejectUnknownKeys", () => {
  it("accepts a spec whose keys are all known", () => {
    const check = () =>
      rejectUnknownKeys({ sidebar: true }, ["sidebar"], ["nav"]);

    expect(check).not.toThrow();
  });

  it("names the first unknown key by its dotted path", () => {
    const check = () =>
      rejectUnknownKeys({ sidebr: true }, ["sidebar"], ["nav"]);

    expect(check).toThrow(
      expect.objectContaining({
        keyPath: ["nav", "sidebr"],
        message:
          "nav.sidebr: unknown key, expected one of sidebar (did you mean sidebar?)",
      }),
    );
  });
});
