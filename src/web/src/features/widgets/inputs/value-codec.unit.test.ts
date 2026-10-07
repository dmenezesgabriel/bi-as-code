import { describe, expect, it } from "vitest";
import { selectValueCodec } from "./value-codec";

describe("selectValueCodec.serialize", () => {
  it("serializes a single string as itself", () => {
    expect(selectValueCodec.serialize("West")).toBe("West");
  });

  it("serializes an array as a JSON list", () => {
    expect(selectValueCodec.serialize(["Direct", "Marketplace"])).toBe(
      '["Direct","Marketplace"]',
    );
  });

  it("collapses undefined, empty string and empty array to undefined — param deleted", () => {
    expect(selectValueCodec.serialize(undefined)).toBeUndefined();
    expect(selectValueCodec.serialize("")).toBeUndefined();
    expect(selectValueCodec.serialize([])).toBeUndefined();
  });
});

describe("selectValueCodec.deserialize", () => {
  it("decodes a JSON string array", () => {
    expect(selectValueCodec.deserialize('["Direct","Marketplace"]')).toEqual([
      "Direct",
      "Marketplace",
    ]);
  });

  it("returns a raw string unchanged", () => {
    expect(selectValueCodec.deserialize("West")).toBe("West");
  });

  it("rejects a JSON array of non-strings, keeping the raw string", () => {
    expect(selectValueCodec.deserialize("[1,2]")).toBe("[1,2]");
  });

  it("keeps the raw string when the bracket prefix is not valid JSON", () => {
    expect(selectValueCodec.deserialize("[bad")).toBe("[bad");
  });

  it("treats a quoted string as a raw string — no legacy decode", () => {
    expect(selectValueCodec.deserialize('"West"')).toBe('"West"');
  });
});

describe("selectValueCodec round-trip", () => {
  it.each([["West"], [["Direct", "Marketplace"]], [["a"]]])(
    "value %j survives serialize → deserialize",
    (value) => {
      const serialized = selectValueCodec.serialize(value as string | string[]);
      expect(serialized).toBeDefined();
      expect(selectValueCodec.deserialize(serialized!)).toEqual(value);
    },
  );
});
