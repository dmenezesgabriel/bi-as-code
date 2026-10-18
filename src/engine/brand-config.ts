import { formatKeyPath, invalid } from "./biac-config-error.js";
import { checkBrandContrast } from "./brand-contrast.js";
import { isRecord, rejectUnknownKeys } from "./config-shape.js";
import { SERIES_TOKENS } from "./default-theme-tokens.js";
import type {
  BrandColours,
  BrandPalette,
  BrandTheme,
  ModeColour,
} from "./types.js";

const BRAND_KEYS = ["colors", "palette"] as const;
const COLOUR_KEYS = ["primary", "background"] as const;
const MODE_KEYS = ["light", "dark"] as const;

// One accepted form: zrender parses hex but not `oklch()` (ADR-0014), and a
// single form keeps the contrast maths exact.
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

const BRAND_SHAPE = `an object with optional fields { ${BRAND_KEYS.join(", ")} }`;
const COLOURS_SHAPE = `an object with optional fields { ${COLOUR_KEYS.join(", ")} }`;
const MODE_COLOUR_SHAPE = `an object { ${MODE_KEYS.join(", ")} } of "#rrggbb" colours`;
const PALETTE_SHAPE = `an object with optional fields { ${MODE_KEYS.join(", ")} }`;
// Past eight series ECharts repeats the list, and every extra colour lowers
// the separation floor the palette is chosen against (ADR-0016).
const PALETTE_MODE_SHAPE = `an array of 1 to ${SERIES_TOKENS.length} "#rrggbb" colours`;

/**
 * Reads `biac.config.ts`'s `brand` block, lower-casing each colour, and
 * checks every colour and palette entry against its contrast floor. A bad
 * shape or a colour under its floor throws a `ConfigFieldError` at the
 * colour's key path.
 *
 * @example
 * readBrand({ brand: { colors: { primary: { light: "#154886", dark: "#60A5FA" } } } });
 * // → { colors: { primary: { light: "#154886", dark: "#60a5fa" } } }
 */
export function readBrand(spec: Record<string, unknown>): BrandTheme {
  if (spec.brand === undefined) return { colors: {}, palette: {} };
  if (!isRecord(spec.brand)) {
    throw invalid("brand", ["brand"], BRAND_SHAPE, spec.brand);
  }
  rejectUnknownKeys(spec.brand, BRAND_KEYS, ["brand"]);
  const brand: BrandTheme = {
    colors: readColours(spec.brand.colors),
    palette: readPalette(spec.brand.palette),
  };
  checkBrandContrast(brand);
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

function readPalette(value: unknown): BrandPalette {
  if (value === undefined) return {};
  const keyPath = ["brand", "palette"];
  if (!isRecord(value)) {
    throw invalid(formatKeyPath(keyPath), keyPath, PALETTE_SHAPE, value);
  }
  rejectUnknownKeys(value, MODE_KEYS, keyPath);
  const palette: BrandPalette = {};
  for (const mode of MODE_KEYS) {
    if (value[mode] === undefined) continue;
    palette[mode] = readPaletteMode(value[mode], [...keyPath, mode]);
  }
  return palette;
}

function readPaletteMode(value: unknown, keyPath: string[]): string[] {
  const fits =
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= SERIES_TOKENS.length;
  if (!fits) {
    throw invalid(formatKeyPath(keyPath), keyPath, PALETTE_MODE_SHAPE, value);
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
