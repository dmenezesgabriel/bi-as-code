import { BRAND_TOKENS } from "./default-theme-tokens.js";
import type { BrandColours, ColourMode } from "./types.js";

// The selectors `src/web/src/styles.css` declares each mode's tokens on:
// `.light`/`.dark` also match the chart theme's hidden token probe, so a
// brand colour reaches the charts as well as the chrome.
const MODE_SELECTORS: Readonly<Record<ColourMode, string>> = {
  light: ":root,\n.light",
  dark: ".dark",
};

/**
 * The stylesheet that sets each brand colour over its theme token, one rule
 * per mode; empty when the project sets no brand colour.
 *
 * @example
 * brandCss({ primary: { light: "#154886", dark: "#60a5fa" } });
 * // → ":root,\n.light {\n  --primary: #154886;\n}\n.dark {\n  --primary: #60a5fa;\n}\n"
 */
export function brandCss(colours: BrandColours): string {
  const keys = (Object.keys(BRAND_TOKENS) as (keyof BrandColours)[]).filter(
    (key) => colours[key] !== undefined,
  );
  if (keys.length === 0) return "";
  return (Object.keys(MODE_SELECTORS) as ColourMode[])
    .map((mode) => {
      const declarations = keys.map(
        (key) => `  ${BRAND_TOKENS[key]}: ${colours[key]?.[mode]};\n`,
      );
      return `${MODE_SELECTORS[mode]} {\n${declarations.join("")}}\n`;
    })
    .join("");
}
