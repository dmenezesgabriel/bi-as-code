import { formatKeyPath, invalid } from "./biac-config-error.js";
import { checkBrandContrast } from "./brand-contrast.js";
import { isRecord, rejectUnknownKeys } from "./config-shape.js";
import { SERIES_TOKENS, type ThemeTokens } from "./default-theme-tokens.js";
import type {
  BrandColours,
  BrandTheme,
  ModeColour,
  ModeColourLists,
} from "./types.js";

const BRAND_KEYS = ["colors", "palette", "scale"] as const;
const COLOUR_KEYS = ["primary", "background", "positive", "negative"] as const;
const MODE_KEYS = ["light", "dark"] as const;

// One accepted form: zrender parses hex but not `oklch()` (ADR-0014), and a
// single form keeps the contrast maths exact.
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

const BRAND_SHAPE = `an object with optional fields { ${BRAND_KEYS.join(", ")} }`;
const COLOURS_SHAPE = `an object with optional fields { ${COLOUR_KEYS.join(", ")} }`;
const MODE_COLOUR_SHAPE = `an object { ${MODE_KEYS.join(", ")} } of "#rrggbb" colours`;
const MODE_LISTS_SHAPE = `an object with optional fields { ${MODE_KEYS.join(", ")} }`;
// Past eight series ECharts repeats the list, and every extra colour lowers
// the separation floor the palette is chosen against (ADR-0016).
const PALETTE_LIST: ColourListLimit = {
  max: SERIES_TOKENS.length,
  shape: `an array of 1 to ${SERIES_TOKENS.length} "#rrggbb" colours`,
};
// A ramp interpolates between its stops, so any count of one or more draws.
const SCALE_LIST: ColourListLimit = {
  max: Infinity,
  shape: 'an array of 1 or more "#rrggbb" colours',
};

/** How many colours one mode's list may hold, and how to name that shape. */
interface ColourListLimit {
  max: number;
  shape: string;
}

/**
 * The brand of a project or page that sets none: every token keeps its
 * default.
 *
 * @example
 * brandCss(NO_BRAND); // → ""
 */
export const NO_BRAND: BrandTheme = { colors: {}, palette: {}, scale: {} };

/**
 * Reads `biac.config.ts`'s `brand` block, lower-casing each colour, and
 * checks every colour and palette entry against its contrast floor on
 * `theme` — the defaults, or a page's project brand — leaving the scale
 * unchecked, since a heatmap cell's value is in its tooltip and label. A bad
 * shape or a colour under its floor throws a `ConfigFieldError` at the
 * colour's key path.
 *
 * @example
 * readBrand({ brand: { colors: { primary: { light: "#154886", dark: "#60A5FA" } } } });
 * // → { colors: { primary: { light: "#154886", dark: "#60a5fa" } } }
 */
export function readBrand(
  spec: Record<string, unknown>,
  theme?: ThemeTokens,
): BrandTheme {
  if (spec.brand === undefined) return NO_BRAND;
  if (!isRecord(spec.brand)) {
    throw invalid("brand", ["brand"], BRAND_SHAPE, spec.brand);
  }
  rejectUnknownKeys(spec.brand, BRAND_KEYS, ["brand"]);
  const brand: BrandTheme = {
    colors: readColours(spec.brand.colors),
    palette: readModeLists(spec.brand.palette, "palette", PALETTE_LIST),
    scale: readModeLists(spec.brand.scale, "scale", SCALE_LIST),
  };
  checkBrandContrast(brand, theme);
  return brand;
}

function readColours(value: unknown): BrandColours {
  if (value === undefined) return {};
  const keyPath = ["brand", "colors"];
  if (!isRecord(value)) {
    throw invalid(keyPath.join("."), keyPath, COLOURS_SHAPE, value);
  }
  rejectUnknownKeys(value, COLOUR_KEYS, keyPath);
  const colours: BrandColours = {};
  for (const key of COLOUR_KEYS) {
    if (value[key] === undefined) continue;
    colours[key] = readModeColour(value[key], [...keyPath, key]);
  }
  return colours;
}

function readModeLists(
  value: unknown,
  key: "palette" | "scale",
  limit: ColourListLimit,
): ModeColourLists {
  if (value === undefined) return {};
  const keyPath = ["brand", key];
  if (!isRecord(value)) {
    throw invalid(formatKeyPath(keyPath), keyPath, MODE_LISTS_SHAPE, value);
  }
  rejectUnknownKeys(value, MODE_KEYS, keyPath);
  const lists: ModeColourLists = {};
  for (const mode of MODE_KEYS) {
    if (value[mode] === undefined) continue;
    lists[mode] = readColourList(value[mode], [...keyPath, mode], limit);
  }
  return lists;
}

function readColourList(
  value: unknown,
  keyPath: string[],
  limit: ColourListLimit,
): string[] {
  const fits =
    Array.isArray(value) && value.length >= 1 && value.length <= limit.max;
  if (!fits) {
    throw invalid(formatKeyPath(keyPath), keyPath, limit.shape, value);
  }
  return value.map((entry, index) =>
    readHex(entry, [...keyPath, String(index)]),
  );
}

function readModeColour(value: unknown, keyPath: string[]): ModeColour {
  const field = keyPath.join(".");
  if (!isRecord(value) || MODE_KEYS.some((mode) => value[mode] === undefined)) {
    throw invalid(field, keyPath, MODE_COLOUR_SHAPE, value);
  }
  rejectUnknownKeys(value, MODE_KEYS, keyPath);
  return {
    light: readHex(value.light, [...keyPath, "light"]),
    dark: readHex(value.dark, [...keyPath, "dark"]),
  };
}

function readHex(value: unknown, keyPath: string[]): string {
  if (typeof value === "string" && HEX_COLOUR.test(value)) {
    return value.toLowerCase();
  }
  throw invalid(formatKeyPath(keyPath), keyPath, 'a "#rrggbb" colour', value);
}
