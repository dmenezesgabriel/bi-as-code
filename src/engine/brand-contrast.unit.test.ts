import { describe, expect, it } from "vitest";
import { brandedThemeTokens, checkBrandContrast } from "./brand-contrast.js";
import { DEFAULT_THEME_TOKENS } from "./default-theme-tokens.js";
import type { BrandColours, BrandTheme, ModeColourLists } from "./types.js";

function brandOf(
  colors: BrandColours,
  palette: ModeColourLists = {},
): BrandTheme {
  return { colors, palette, scale: {}, fonts: {} };
}

function failureOf(
  colours: BrandColours,
  palette: ModeColourLists = {},
): unknown {
  try {
    checkBrandContrast(brandOf(colours, palette));
  } catch (error) {
    return error;
  }
  throw new Error(
    `Expected ${JSON.stringify({ colours, palette })} to fail a floor`,
  );
}

describe("checkBrandContrast — passing colours", () => {
  it("accepts no brand colours", () => {
    const check = () => checkBrandContrast(brandOf({}));

    expect(check).not.toThrow();
  });

  it("accepts colours that clear every floor in both modes", () => {
    const colours: BrandColours = {
      primary: { light: "#154886", dark: "#60a5fa" },
      background: { light: "#fffdf5", dark: "#0a0a0a" },
    };

    const check = () => checkBrandContrast(brandOf(colours));

    expect(check).not.toThrow();
  });

  it("accepts a palette that clears every floor on a brand background", () => {
    const brand = brandOf(
      { background: { light: "#fffdf5", dark: "#0a0a0a" } },
      { light: ["#1e40af"], dark: ["#60a5fa"] },
    );

    const check = () => checkBrandContrast(brand);

    expect(check).not.toThrow();
  });

  it("leaves the scale unchecked, even a stop identical to the background", () => {
    const brand: BrandTheme = {
      colors: {},
      palette: {},
      scale: { light: ["#ffffff", "#1e40af"], dark: ["#0a0a0a"] },
      fonts: {},
    };

    const check = () => checkBrandContrast(brand);

    expect(check).not.toThrow();
  });
});

describe("checkBrandContrast — palette floors", () => {
  it("fails a palette colour under 3:1 on the default canvas, at its index", () => {
    const error = failureOf({}, { light: ["#1e40af", "#45a1bf"] });

    expect(error).toMatchObject({
      keyPath: ["brand", "palette", "light", "1"],
      message:
        "brand.palette.light[1]: #45a1bf against --background #ffffff measures 2.95:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.palette.light[1]",
    });
  });

  it("fails a palette colour under 3:1 against the label drawn inside it", () => {
    const error = failureOf(
      { background: { light: "#ffffff", dark: "#000000" } },
      { dark: ["#5a5a5a"] },
    );

    expect(error).toMatchObject({
      message:
        "brand.palette.dark[0]: #5a5a5a against --chart-label-inside #0a0a0a measures 2.87:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.palette.dark[0]",
    });
  });

  it("names both brand keys when the palette and the background are both the author's", () => {
    const error = failureOf(
      { background: { light: "#fffdf5", dark: "#0a0a0a" } },
      { light: ["#45a1bf"] },
    );

    expect(error).toMatchObject({
      message:
        "brand.colors.background.light: #fffdf5 against brand.palette.light[0] #45a1bf measures 2.90:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light or brand.palette.light[0]",
    });
  });

  it("checks the default series past the palette's end on a brand background", () => {
    const error = failureOf(
      { background: { light: "#fdf6e3", dark: "#0a0a0a" } },
      { light: ["#1e40af"] },
    );

    expect(error).toMatchObject({
      message: expect.stringContaining("against --chart-4 #cc79a7"),
    });
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

describe("checkBrandContrast — delta colours", () => {
  // Dark series everywhere, so a grey background clears the palette floors
  // and the delta pairs are the ones left to fail.
  const darkPalette: ModeColourLists = { light: Array(8).fill("#1e3a8a") };

  it("accepts the default positive and negative tones as brand colours", () => {
    const colours: BrandColours = {
      positive: { light: "#00784f", dark: "#00d492" },
      negative: { light: "#c10007", dark: "#ff6467" },
    };

    const check = () => checkBrandContrast(brandOf(colours));

    expect(check).not.toThrow();
  });

  it("fails a positive tone under 4.5:1 on the page", () => {
    const error = failureOf({
      positive: { light: "#4ade80", dark: "#00d492" },
    });

    expect(error).toMatchObject({
      keyPath: ["brand", "colors", "positive", "light"],
      message:
        "brand.colors.positive.light: #4ade80 against --background #ffffff measures 1.74:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.positive.light",
    });
  });

  it("fails a tone that clears the plain surfaces but not its own 10% chip", () => {
    const error = failureOf({
      positive: { light: "#007a55", dark: "#00d492" },
    });

    expect(error).toMatchObject({
      message:
        "brand.colors.positive.light: #007a55 against its 10% chip over --card-mode-background #e1edea measures 4.47:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.positive.light",
    });
  });

  it("checks the default positive tone on a brand background", () => {
    const error = failureOf(
      { background: { light: "#d0d0d0", dark: "#0a0a0a" } },
      darkPalette,
    );

    expect(error).toMatchObject({
      message:
        "brand.colors.background.light: #d0d0d0 against --positive #00784f measures 3.58:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.background.light",
    });
  });

  it("checks the default positive chip on a brand background", () => {
    const error = failureOf(
      { background: { light: "#f0f0f0", dark: "#0a0a0a" } },
      darkPalette,
    );

    expect(error).toMatchObject({
      message:
        "brand.colors.background.light: #f0f0f0 against --positive on its 10% chip #00784f measures 4.23:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.background.light",
    });
  });

  it("names both brand keys when the tone and the background its chip lies on are both the author's", () => {
    const error = failureOf(
      {
        positive: { light: "#00784f", dark: "#00d492" },
        background: { light: "#f0f0f0", dark: "#0a0a0a" },
      },
      darkPalette,
    );

    expect(error).toMatchObject({
      message:
        "brand.colors.positive.light: #00784f against its 10% chip over brand.colors.background.light #d8e4e0 measures 4.23:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.positive.light or brand.colors.background.light",
    });
  });
});

describe("checkBrandContrast — field and sidebar", () => {
  it("accepts the default field and sidebar surfaces as brand colours", () => {
    const colours: BrandColours = {
      field: { light: "#ffffff", dark: "#171717" },
      sidebar: { light: "#fafafa", dark: "#171717" },
    };

    const check = () => checkBrandContrast(brandOf(colours));

    expect(check).not.toThrow();
  });

  it("fails a field under 4.5:1 against its placeholder text", () => {
    const error = failureOf({ field: { light: "#f0f0f0", dark: "#171717" } });

    expect(error).toMatchObject({
      keyPath: ["brand", "colors", "field", "light"],
      message:
        "brand.colors.field.light: #f0f0f0 against --muted-foreground-faded #737373 measures 4.16:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.field.light",
    });
  });

  it("fails a sidebar whose text clears 4.5:1 but whose focus ring does not clear 3:1", () => {
    const error = failureOf({ sidebar: { light: "#cccccc", dark: "#171717" } });

    expect(error).toMatchObject({
      message:
        "brand.colors.sidebar.light: #cccccc against --ring #737373 measures 2.95:1, expected at least 3:1 (WCAG 2.2 SC 2.4.13) — change brand.colors.sidebar.light",
    });
  });

  it("fails a dark sidebar under 4.5:1 against its folder labels", () => {
    const error = failureOf({ sidebar: { light: "#fafafa", dark: "#606060" } });

    expect(error).toMatchObject({
      keyPath: ["brand", "colors", "sidebar", "dark"],
      message:
        "brand.colors.sidebar.dark: #606060 against --sidebar-foreground #d4d4d4 measures 4.24:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.sidebar.dark",
    });
  });
});

describe("checkBrandContrast — over a project brand", () => {
  it("measures a colour against the project's colour, naming only its own key", () => {
    const project = brandOf({ primary: { light: "#154886", dark: "#60a5fa" } });
    const page = brandOf({ background: { light: "#3b5c99", dark: "#0a0a0a" } });

    const check = () => checkBrandContrast(page, brandedThemeTokens(project));

    expect(check).toThrow(
      "brand.colors.background.light: #3b5c99 against --primary #154886 measures 1.37:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light",
    );
  });
});

describe("brandedThemeTokens", () => {
  it("is the default theme when the brand sets nothing", () => {
    const tokens = brandedThemeTokens(brandOf({}));

    expect(tokens).toEqual(DEFAULT_THEME_TOKENS);
  });

  it("overlays brand colours and palette entries per mode, keeping the rest", () => {
    const brand = brandOf(
      { background: { light: "#fffdf5", dark: "#111111" } },
      { dark: ["#60a5fa"] },
    );

    const tokens = brandedThemeTokens(brand);

    expect(tokens.light).toEqual({
      ...DEFAULT_THEME_TOKENS.light,
      "--background": "#fffdf5",
    });
    expect(tokens.dark).toEqual({
      ...DEFAULT_THEME_TOKENS.dark,
      "--background": "#111111",
      "--chart-1": "#60a5fa",
    });
  });
});
