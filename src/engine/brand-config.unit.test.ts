import { describe, expect, it } from "vitest";
import { readBrand } from "./brand-config.js";
import { brandedThemeTokens } from "./brand-contrast.js";

const PASSING_PRIMARY = { light: "#154886", dark: "#60a5fa" };
const PASSING_BACKGROUND = { light: "#fffdf5", dark: "#0a0a0a" };

describe("readBrand — accepted shapes", () => {
  it("returns no colours when brand is absent", () => {
    const brand = readBrand({});

    expect(brand).toEqual({ colors: {}, palette: {}, scale: {} });
  });

  it("returns no colours for a brand block without colors", () => {
    const brand = readBrand({ brand: {} });

    expect(brand).toEqual({ colors: {}, palette: {}, scale: {} });
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

  it("reads positive and negative per mode, lower-cased", () => {
    const spec = {
      brand: {
        colors: {
          positive: { light: "#047857", dark: "#34D399" },
          negative: { light: "#B91C1C", dark: "#F87171" },
        },
      },
    };

    const brand = readBrand(spec);

    expect(brand.colors).toEqual({
      positive: { light: "#047857", dark: "#34d399" },
      negative: { light: "#b91c1c", dark: "#f87171" },
    });
  });

  it("reads a palette per mode, lower-cased", () => {
    const spec = {
      brand: { palette: { light: ["#1E40AF", "#D55E00"], dark: ["#60a5fa"] } },
    };

    const brand = readBrand(spec);

    expect(brand.palette).toEqual({
      light: ["#1e40af", "#d55e00"],
      dark: ["#60a5fa"],
    });
  });

  it("leaves a palette mode the author omits to the defaults", () => {
    const spec = { brand: { palette: { dark: ["#60a5fa"] } } };

    const brand = readBrand(spec);

    expect(brand.palette).toEqual({ dark: ["#60a5fa"] });
  });

  it("accepts a palette of eight colours, one per series token", () => {
    const eight = Array.from({ length: 8 }, () => "#1e40af");

    const brand = readBrand({ brand: { palette: { light: eight } } });

    expect(brand.palette.light).toHaveLength(8);
  });

  it("reads a scale of any length per mode, lower-cased", () => {
    const twelve = Array.from({ length: 12 }, () => "#1E40AF");
    const spec = { brand: { scale: { light: ["#1E40AF"], dark: twelve } } };

    const brand = readBrand(spec);

    expect(brand.scale).toEqual({
      light: ["#1e40af"],
      dark: Array.from({ length: 12 }, () => "#1e40af"),
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
      'brand: expected an object with optional fields { colors, palette, scale }, got "blue"',
    ],
    [
      { brand: { colors: [] } },
      ["brand", "colors"],
      "brand.colors: expected an object with optional fields { primary, background, positive, negative }, got []",
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
    [
      { brand: { colors: { negative: { light: "red", dark: "#f87171" } } } },
      ["brand", "colors", "negative", "light"],
      'brand.colors.negative.light: expected a "#rrggbb" colour, got "red"',
    ],
    [
      { brand: { palette: ["#1e40af"] } },
      ["brand", "palette"],
      'brand.palette: expected an object with optional fields { light, dark }, got ["#1e40af"]',
    ],
    [
      { brand: { palette: { light: "#1e40af" } } },
      ["brand", "palette", "light"],
      'brand.palette.light: expected an array of 1 to 8 "#rrggbb" colours, got "#1e40af"',
    ],
    [
      { brand: { palette: { light: [] } } },
      ["brand", "palette", "light"],
      'brand.palette.light: expected an array of 1 to 8 "#rrggbb" colours, got []',
    ],
    [
      {
        brand: {
          palette: { dark: Array.from({ length: 9 }, () => "#60a5fa") },
        },
      },
      ["brand", "palette", "dark"],
      `brand.palette.dark: expected an array of 1 to 8 "#rrggbb" colours, got ${JSON.stringify(Array.from({ length: 9 }, () => "#60a5fa"))}`,
    ],
    [
      { brand: { palette: { light: ["#1e40af", "#d55e00", "teal"] } } },
      ["brand", "palette", "light", "2"],
      'brand.palette.light[2]: expected a "#rrggbb" colour, got "teal"',
    ],
    [
      { brand: { scale: "#1e40af" } },
      ["brand", "scale"],
      'brand.scale: expected an object with optional fields { light, dark }, got "#1e40af"',
    ],
    [
      { brand: { scale: { dark: [] } } },
      ["brand", "scale", "dark"],
      'brand.scale.dark: expected an array of 1 or more "#rrggbb" colours, got []',
    ],
    [
      { brand: { scale: { light: ["#1e40af", "navy"] } } },
      ["brand", "scale", "light", "1"],
      'brand.scale.light[1]: expected a "#rrggbb" colour, got "navy"',
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
      { brand: { ramp: {} } },
      "brand.ramp: unknown key, expected one of colors, palette, scale",
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
    [
      { brand: { palette: { mid: ["#1e40af"] } } },
      "brand.palette.mid: unknown key, expected one of light, dark",
    ],
    [
      { brand: { scale: { mid: ["#1e40af"] } } },
      "brand.scale.mid: unknown key, expected one of light, dark",
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

  it("checks a delta tone it reads against its contrast floors", () => {
    const spec = {
      brand: { colors: { positive: { light: "#4ade80", dark: "#34d399" } } },
    };

    const read = () => readBrand(spec);

    expect(read).toThrow(
      expect.objectContaining({
        keyPath: ["brand", "colors", "positive", "light"],
      }),
    );
  });

  it("checks the palette it reads against its contrast floors", () => {
    const spec = { brand: { palette: { light: ["#45a1bf"] } } };

    const read = () => readBrand(spec);

    expect(read).toThrow(
      expect.objectContaining({ keyPath: ["brand", "palette", "light", "0"] }),
    );
  });
});

describe("readBrand — over a project brand", () => {
  it("checks contrast against the theme it is given", () => {
    const project = brandedThemeTokens({
      colors: { primary: PASSING_PRIMARY },
      palette: {},
      scale: {},
    });
    const spec = {
      brand: { colors: { background: { light: "#3b5c99", dark: "#0a0a0a" } } },
    };

    const read = () => readBrand(spec, project);

    expect(read).toThrow("against --primary #154886 measures 1.37:1");
  });
});
