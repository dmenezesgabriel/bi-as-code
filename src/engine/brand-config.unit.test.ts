import { describe, expect, it } from "vitest";
import { readBrand } from "./brand-config.js";

const PASSING_PRIMARY = { light: "#154886", dark: "#60a5fa" };
const PASSING_BACKGROUND = { light: "#fffdf5", dark: "#0a0a0a" };

describe("readBrand — accepted shapes", () => {
  it("returns no colours when brand is absent", () => {
    const brand = readBrand({});

    expect(brand).toEqual({ colors: {} });
  });

  it("returns no colours for a brand block without colors", () => {
    const brand = readBrand({ brand: {} });

    expect(brand).toEqual({ colors: {} });
  });

  it("reads primary and background per mode", () => {
    const spec = {
      brand: {
        colors: { primary: PASSING_PRIMARY, background: PASSING_BACKGROUND },
      },
    };

    const brand = readBrand(spec);

    expect(brand.colors).toEqual({
      primary: PASSING_PRIMARY,
      background: PASSING_BACKGROUND,
    });
  });

  it("lower-cases a hex written in capitals", () => {
    const spec = {
      brand: { colors: { primary: { light: "#15488A", dark: "#60A5FA" } } },
    };

    const brand = readBrand(spec);

    expect(brand.colors.primary).toEqual({ light: "#15488a", dark: "#60a5fa" });
  });
});

describe("readBrand — rejected shapes", () => {
  it.each([
    [
      { brand: "blue" },
      ["brand"],
      'brand: expected an object with optional fields { colors }, got "blue"',
    ],
    [
      { brand: { colors: [] } },
      ["brand", "colors"],
      "brand.colors: expected an object with optional fields { primary, background }, got []",
    ],
    [
      { brand: { colors: { primary: "#154886" } } },
      ["brand", "colors", "primary"],
      'brand.colors.primary: expected an object { light, dark } of "#rrggbb" colours, got "#154886"',
    ],
    [
      { brand: { colors: { primary: { light: "#154886" } } } },
      ["brand", "colors", "primary"],
      'brand.colors.primary: expected an object { light, dark } of "#rrggbb" colours, got {"light":"#154886"}',
    ],
    [
      { brand: { colors: { primary: { light: "#154", dark: "#60a5fa" } } } },
      ["brand", "colors", "primary", "light"],
      'brand.colors.primary.light: expected a "#rrggbb" colour, got "#154"',
    ],
    [
      { brand: { colors: { primary: { light: "blue", dark: "#60a5fa" } } } },
      ["brand", "colors", "primary", "light"],
      'brand.colors.primary.light: expected a "#rrggbb" colour, got "blue"',
    ],
  ])(
    "names the field and the expected shape for %j",
    (spec, keyPath, message) => {
      const read = () => readBrand(spec);

      expect(read).toThrow(expect.objectContaining({ keyPath, message }));
    },
  );

  it.each([
    [
      { brand: { palette: {} } },
      "brand.palette: unknown key, expected one of colors",
    ],
    [
      { brand: { colors: { accent: PASSING_PRIMARY } } },
      "brand.colors.accent: unknown key, expected one of primary, background",
    ],
    [
      {
        brand: { colors: { primary: { ...PASSING_PRIMARY, dim: "#000000" } } },
      },
      "brand.colors.primary.dim: unknown key, expected one of light, dark",
    ],
  ])("rejects an unknown key in %j", (spec, message) => {
    const read = () => readBrand(spec);

    expect(read).toThrow(message);
  });

  it("checks the colours it reads against their contrast floors", () => {
    const spec = {
      brand: { colors: { background: { light: "#fdf6e3", dark: "#0a0a0a" } } },
    };

    const read = () => readBrand(spec);

    expect(read).toThrow(
      expect.objectContaining({
        keyPath: ["brand", "colors", "background", "light"],
      }),
    );
  });
});
