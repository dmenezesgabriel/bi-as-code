import { describe, expect, it } from "vitest";
import { invalidSetting } from "./invalid-setting.js";

describe("invalidSetting", () => {
  it("names the location, field, expected shape and the value as JSON", () => {
    const error = invalidSetting(
      "biac.config.ts",
      "sql.orders",
      "a string path",
      3,
    );

    expect(error.message).toBe(
      "Invalid biac.config.ts — sql.orders: expected a string path, got 3",
    );
  });

  it("appends a hint after the value", () => {
    const error = invalidSetting(
      "front-matter in pages/a.md",
      "icon",
      "one of calendar, clock",
      "calender",
      " (did you mean calendar?)",
    );

    expect(error.message).toBe(
      'Invalid front-matter in pages/a.md — icon: expected one of calendar, clock, got "calender" (did you mean calendar?)',
    );
  });
});
