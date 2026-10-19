import {
  BRAND_TOKENS,
  SCALE_TOKEN,
  SERIES_TOKENS,
} from "./default-theme-tokens.js";
import type { BrandColours, BrandTheme, ColourMode } from "./types.js";

// The selectors `src/web/src/styles.css` declares each mode's tokens on:
// `.light`/`.dark` also match the chart theme's hidden token probe, so a
// brand colour reaches the charts as well as the chrome.
const MODE_SELECTORS: Readonly<Record<ColourMode, string>> = {
  light: ":root,\n.light",
  dark: ".dark",
};

/**
 * The stylesheet that sets each brand colour, palette entry and scale over
 * its theme token, one rule per mode that sets any; empty when the project
 * sets none.
 *
 * @example
 * brandCss({ colors: { primary: { light: "#154886", dark: "#60a5fa" } }, palette: {}, scale: {} });
 * // → ":root,\n.light {\n  --primary: #154886;\n}\n.dark {\n  --primary: #60a5fa;\n}\n"
 */
export function brandCss(brand: BrandTheme): string {
  return (Object.keys(MODE_SELECTORS) as ColourMode[])
    .map((mode) => {
      const declarations = modeDeclarations(brand, mode);
      if (declarations.length === 0) return "";
      return `${MODE_SELECTORS[mode]} {\n${declarations.join("")}}\n`;
    })
    .join("");
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
