import { describe, expect, it } from "vitest";
import { pageBrand } from "./page-brand-frontmatter.js";
import type { BrandTheme } from "./types.js";

const LOCATION = "front-matter in pages/page.md";
const NO_BRAND: BrandTheme = { colors: {}, palette: {}, scale: {} };
const PROJECT_BRAND: BrandTheme = {
  colors: { primary: { light: "#154886", dark: "#60a5fa" } },
  palette: {},
  scale: {},
};

describe("pageBrand — accepted", () => {
  it("is empty when the front-matter sets no brand", () => {
    const brand = pageBrand({ title: "T" }, LOCATION, PROJECT_BRAND);

    expect(brand).toEqual(NO_BRAND);
  });

  it("reads the page's own keys only, lower-cased", () => {
    const frontmatter = { brand: { palette: { light: ["#1E40AF"] } } };

    const brand = pageBrand(frontmatter, LOCATION, PROJECT_BRAND);

    expect(brand).toEqual({
      colors: {},
      palette: { light: ["#1e40af"] },
      scale: {},
    });
  });
});

describe("pageBrand — rejected", () => {
  it("names the file, the key path, the expected shape and the value", () => {
    const frontmatter = { brand: { colors: { primary: "blue" } } };

    const read = () => pageBrand(frontmatter, LOCATION, NO_BRAND);

    expect(read).toThrow(
      'Invalid front-matter in pages/page.md — brand.colors.primary: expected an object { light, dark } of "#rrggbb" colours, got "blue"',
    );
  });

  it("measures the page's colours against the project brand they land on", () => {
    const frontmatter = {
      brand: { colors: { background: { light: "#3b5c99", dark: "#0a0a0a" } } },
    };

    const read = () => pageBrand(frontmatter, LOCATION, PROJECT_BRAND);

    expect(read).toThrow(
      "Invalid front-matter in pages/page.md — brand.colors.background.light: #3b5c99 against --primary #154886 measures 1.37:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light",
    );
  });
});
