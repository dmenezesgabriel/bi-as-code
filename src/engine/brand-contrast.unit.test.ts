import { describe, expect, it } from "vitest";
import { checkBrandContrast } from "./brand-contrast.js";
import type { BrandColours } from "./types.js";

function failureOf(colours: BrandColours): unknown {
  try {
    checkBrandContrast(colours);
  } catch (error) {
    return error;
  }
  throw new Error(`Expected ${JSON.stringify(colours)} to fail a floor`);
}

describe("checkBrandContrast — passing colours", () => {
  it("accepts no brand colours", () => {
    const check = () => checkBrandContrast({});

    expect(check).not.toThrow();
  });

  it("accepts colours that clear every floor in both modes", () => {
    const colours: BrandColours = {
      primary: { light: "#154886", dark: "#60a5fa" },
      background: { light: "#fffdf5", dark: "#0a0a0a" },
    };

    const check = () => checkBrandContrast(colours);

    expect(check).not.toThrow();
  });
});

describe("checkBrandContrast — each floor", () => {
  it.each([
    [
      "primary against --primary-foreground",
      { primary: { light: "#8a8a8a", dark: "#e5e5e5" } },
      "brand.colors.primary.light: #8a8a8a against --primary-foreground #ffffff measures 3.45:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.primary.light",
    ],
    [
      "background against --primary",
      { background: { light: "#ffffff", dark: "#d4d4d4" } },
      "brand.colors.background.dark: #d4d4d4 against --primary #e5e5e5 measures 1.17:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11)",
    ],
    [
      "primary against --secondary",
      { primary: { light: "#171717", dark: "#808080" } },
      "brand.colors.primary.dark: #808080 against --secondary #404040 measures 2.62:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11)",
    ],
    [
      "background against --foreground",
      { background: { light: "#666666", dark: "#0a0a0a" } },
      "brand.colors.background.light: #666666 against --foreground #171717 measures 3.12:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3)",
    ],
    [
      "background against --muted-foreground",
      { background: { light: "#a0a0a0", dark: "#0a0a0a" } },
      "brand.colors.background.light: #a0a0a0 against --muted-foreground #525252 measures 2.98:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3)",
    ],
    [
      "background against --ring",
      { background: { light: "#c8c8c8", dark: "#0a0a0a" } },
      "brand.colors.background.light: #c8c8c8 against --ring #737373 measures 2.83:1, expected at least 3:1 (WCAG 2.2 SC 2.4.13)",
    ],
    [
      "background against the default palette",
      { background: { light: "#fdf6e3", dark: "#0a0a0a" } },
      "brand.colors.background.light: #fdf6e3 against --chart-4 #cc79a7 measures 2.83:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light",
    ],
  ])("fails %s", (_pair, colours, message) => {
    const error = failureOf(colours);

    expect(error).toMatchObject({ message: expect.stringContaining(message) });
  });

  it("locates the failure at the brand key that fails", () => {
    const error = failureOf({
      background: { light: "#fdf6e3", dark: "#0a0a0a" },
    });

    expect(error).toMatchObject({
      keyPath: ["brand", "colors", "background", "light"],
    });
  });

  it("names both brand keys when primary and background are both the author's", () => {
    const colours: BrandColours = {
      primary: { light: "#154886", dark: "#60a5fa" },
      background: { light: "#ffffff", dark: "#555555" },
    };

    const error = failureOf(colours);

    expect(error).toMatchObject({
      message:
        "brand.colors.primary.dark: #60a5fa against brand.colors.background.dark #555555 measures 2.93:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.primary.dark or brand.colors.background.dark",
    });
  });

  it("truncates the ratio so a shortfall never prints as the floor", () => {
    // 2.9964:1 — rounding would print the 3:1 floor it misses.
    const error = failureOf({
      background: { light: "#fffcfa", dark: "#0a0a0a" },
    });

    expect(error).toMatchObject({
      message: expect.stringContaining("measures 2.99:1"),
    });
  });
});
