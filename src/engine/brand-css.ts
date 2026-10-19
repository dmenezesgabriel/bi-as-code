import {
  BRAND_TOKENS,
  SCALE_TOKEN,
  SERIES_TOKENS,
} from "./default-theme-tokens.js";
import type {
  BrandColours,
  BrandFonts,
  BrandTheme,
  ColourMode,
} from "./types.js";

// The selectors `src/web/src/styles.css` declares each mode's tokens on:
// `.light`/`.dark` also match the chart theme's hidden token probe, so a
// brand colour reaches the charts as well as the chrome.
const MODE_SELECTORS: Readonly<Record<ColourMode, string>> = {
  light: ":root,\n.light",
  dark: ".dark",
};

// The font token each `brand.fonts` key sets. A font is the same in both
// modes, so it goes in one `:root` rule, ahead of the per-mode colours,
// with the root font size.
const FONT_TOKENS: Readonly<Record<keyof BrandFonts, string>> = {
  body: "--body-font",
  heading: "--heading-font",
  code: "--code-font",
};

/**
 * The stylesheet that sets each brand font, colour, palette entry and scale
 * over its theme token, and the root font size: one `:root` rule for the
 * fonts and size, then one rule per mode that sets any colour; empty when
 * the project sets none.
 *
 * @example
 * brandCss({ colors: { primary: { light: "#154886", dark: "#60a5fa" } }, palette: {}, scale: {}, fonts: {} });
 * // → ":root,\n.light {\n  --primary: #154886;\n}\n.dark {\n  --primary: #60a5fa;\n}\n"
 */
export function brandCss(brand: BrandTheme): string {
  const modeRules = (Object.keys(MODE_SELECTORS) as ColourMode[]).map((mode) =>
    cssRule(MODE_SELECTORS[mode], modeDeclarations(brand, mode)),
  );
  return [cssRule(":root", rootDeclarations(brand)), ...modeRules].join("");
}

function cssRule(selector: string, declarations: string[]): string {
  if (declarations.length === 0) return "";
  return `${selector} {\n${declarations.join("")}}\n`;
}

// Each stack is a token styles.css declares from Tailwind's own, so the
// brand names a stack and never writes a font list itself.
function fontDeclarations(fonts: BrandFonts): string[] {
  return (Object.keys(FONT_TOKENS) as (keyof BrandFonts)[])
    .filter((key) => fonts[key] !== undefined)
    .map((key) => `  ${FONT_TOKENS[key]}: var(--font-stack-${fonts[key]});\n`);
}

function rootDeclarations(brand: BrandTheme): string[] {
  const fonts = fontDeclarations(brand.fonts);
  if (brand.fontSize === undefined) return fonts;
  return [...fonts, `  font-size: ${rootFontSizePercent(brand.fontSize)};\n`];
}

// A percentage of the browser's 16px default rather than px, so a reader who
// set a larger default size still gets it scaled, not replaced (WCAG
// technique C12, https://www.w3.org/WAI/WCAG22/Techniques/css/C12).
function rootFontSizePercent(px: number): string {
  return `${(px / 16) * 100}%`;
}

function modeDeclarations(brand: BrandTheme, mode: ColourMode): string[] {
  const colours = (Object.keys(BRAND_TOKENS) as (keyof BrandColours)[])
    .filter((key) => brand.colors[key] !== undefined)
    .map((key) => `  ${BRAND_TOKENS[key]}: ${brand.colors[key]?.[mode]};\n`);
  const palette = (brand.palette[mode] ?? []).map(
    (colour, index) => `  ${SERIES_TOKENS[index]}: ${colour};\n`,
  );
  const scale = brand.scale[mode];
  const ramp = scale ? [`  ${SCALE_TOKEN}: ${scale.join(", ")};\n`] : [];
  return [...colours, ...palette, ...ramp];
}
