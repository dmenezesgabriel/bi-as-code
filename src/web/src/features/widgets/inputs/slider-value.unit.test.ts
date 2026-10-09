import { describe, expect, it } from "vitest";
import {
  clampSliderValue,
  columnBounds,
  initialSliderValue,
  resolveSliderBounds,
  sliderClause,
  sliderValueCodec,
} from "./slider-value";

/** A stand-in clause source — identity, not shape, is what resolution keys on. */
const ctx = { source: {} };

describe("sliderValueCodec.serialize", () => {
  it("serializes a single number bare", () => {
    expect(sliderValueCodec.serialize(42)).toBe("42");
    expect(sliderValueCodec.serialize(0)).toBe("0");
  });

  it("serializes a pair as 'lo - hi'", () => {
    expect(sliderValueCodec.serialize([10, 40])).toBe("10 - 40");
    expect(sliderValueCodec.serialize([-10, -5])).toBe("-10 - -5");
  });

  it("drops undefined and non-finite values", () => {
    expect(sliderValueCodec.serialize(undefined)).toBeUndefined();
    expect(sliderValueCodec.serialize(Number.NaN)).toBeUndefined();
    expect(sliderValueCodec.serialize([1, Number.NaN])).toBeUndefined();
  });
});

describe("sliderValueCodec.deserialize", () => {
  it("decodes 'lo - hi' into a pair", () => {
    expect(sliderValueCodec.deserialize("10 - 40")).toEqual([10, 40]);
    expect(sliderValueCodec.deserialize("-10 - -5")).toEqual([-10, -5]);
  });

  it("decodes a bare number", () => {
    expect(sliderValueCodec.deserialize("42")).toBe(42);
    expect(sliderValueCodec.deserialize("42.5")).toBe(42.5);
    expect(sliderValueCodec.deserialize("-3")).toBe(-3);
  });

  it("yields undefined for undecodable params", () => {
    expect(sliderValueCodec.deserialize("abc")).toBeUndefined();
    expect(sliderValueCodec.deserialize("10 - x")).toBeUndefined();
    expect(sliderValueCodec.deserialize("  ")).toBeUndefined();
  });

  it("does not decode the legacy comma form", () => {
    expect(sliderValueCodec.deserialize("1,2")).toBeUndefined();
  });
});

describe("sliderClause", () => {
  it("binds a single value as `column >= ?` in single mode", () => {
    expect(sliderClause(false)("amount", 30, ctx).predicate).toEqual({
      sql: "amount >= ?",
      params: [30],
    });
  });

  it("binds a pair as `column BETWEEN ? AND ?` in range mode", () => {
    expect(sliderClause(true)("amount", [10, 40], ctx).predicate).toEqual({
      sql: "amount BETWEEN ? AND ?",
      params: [10, 40],
    });
  });

  it("publishes a predicate-less clause when the held shape mismatches the mode", () => {
    expect(sliderClause(false)("amount", [10, 40], ctx).predicate).toBeNull();
    expect(sliderClause(true)("amount", 30, ctx).predicate).toBeNull();
  });

  it("publishes a predicate-less clause for an unset value", () => {
    expect(sliderClause(false)("amount", undefined, ctx).predicate).toBeNull();
    expect(sliderClause(true)("amount", undefined, ctx).predicate).toBeNull();
  });
});

describe("initialSliderValue", () => {
  it("keeps a finite number in single mode", () => {
    expect(initialSliderValue(30, false)).toBe(30);
  });

  it("keeps a pair in range mode", () => {
    expect(initialSliderValue([10, 40], true)).toEqual([10, 40]);
  });

  it("drops shapes that mismatch the mode or carry non-finite values", () => {
    expect(initialSliderValue([10, 40], false)).toBeUndefined();
    expect(initialSliderValue(30, true)).toBeUndefined();
    expect(initialSliderValue(Number.NaN, false)).toBeUndefined();
    expect(initialSliderValue(undefined, true)).toBeUndefined();
  });
});

describe("columnBounds", () => {
  it("takes the min and max over the column's finite values", () => {
    const rows = [
      { amount: 30 },
      { amount: 5 },
      { amount: 90 },
      { amount: null },
      { amount: "12" },
    ];
    expect(columnBounds(rows, "amount")).toEqual({ min: 5, max: 90 });
  });

  it("yields no bound when no finite value exists", () => {
    expect(columnBounds([{ amount: null }, { amount: "x" }], "amount")).toEqual(
      {},
    );
    expect(columnBounds([], "amount")).toEqual({});
  });
});

describe("clampSliderValue", () => {
  it("clamps a single value into bounds", () => {
    expect(clampSliderValue(50, 0, 100)).toBe(50);
    expect(clampSliderValue(-5, 0, 100)).toBe(0);
    expect(clampSliderValue(500, 0, 100)).toBe(100);
  });

  it("clamps each end of a pair and keeps it ordered", () => {
    expect(clampSliderValue([10, 40], 0, 100)).toEqual([10, 40]);
    expect(clampSliderValue([-10, 400], 0, 100)).toEqual([0, 100]);
    expect(clampSliderValue([80, 20], 0, 100)).toEqual([20, 80]);
  });
});

describe("resolveSliderBounds", () => {
  it("prefers explicit props, then derived, then the defaults", () => {
    expect(resolveSliderBounds({}, {})).toEqual({ min: 0, max: 100, step: 1 });
    expect(resolveSliderBounds({ min: 5, max: 90 }, {})).toEqual({
      min: 5,
      max: 90,
      step: 1,
    });
    expect(resolveSliderBounds({ min: 5 }, { max: 40 })).toEqual({
      min: 5,
      max: 40,
      step: 1,
    });
    expect(resolveSliderBounds({ min: 5 }, { min: 0, step: 10 })).toEqual({
      min: 0,
      max: 100,
      step: 10,
    });
  });

  it("collapses a non-positive or non-finite step to 1", () => {
    expect(resolveSliderBounds({}, { step: 0 }).step).toBe(1);
    expect(resolveSliderBounds({}, { step: -2 }).step).toBe(1);
    expect(resolveSliderBounds({}, { step: Number.NaN }).step).toBe(1);
  });
});
