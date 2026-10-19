import { contrastTooLow, formatKeyPath } from "./biac-config-error.js";
import { contrastRatio } from "./contrast-ratio.js";
import {
  BRAND_TOKENS,
  DEFAULT_THEME_TOKENS,
  SERIES_TOKENS,
  type ThemeTokenName,
  type ThemeTokens,
} from "./default-theme-tokens.js";
import type {
  BrandColours,
  BrandTheme,
  ColourMode,
  ContrastShortfall,
} from "./types.js";

type BrandKey = keyof BrandColours;

interface ContrastPair {
  readonly first: ThemeTokenName;
  readonly second: ThemeTokenName;
  readonly floor: number;
  readonly criterion: string;
}

const BRAND_KEYS = Object.keys(BRAND_TOKENS) as BrandKey[];

// Every pair a brand colour paints into, at its WCAG 2.2 floor
// (https://www.w3.org/TR/WCAG22/): SC 1.4.3 4.5:1 for text — the pressed
// button-group label on `--primary`, body and muted text on
// `--background`; SC 1.4.11 3:1 for the shapes of a control — the checked
// toggle and slider thumb on the page, the slider's filled indicator on its
// `--secondary` track — and for every chart series, brand or default, on
// the canvas and under the label drawn inside it (ADR-0016's floors); SC
// 2.4.13 3:1 for the focus ring on the page. A pair is checked when either
// side is a brand colour.
const CONTRAST_PAIRS: readonly ContrastPair[] = [
  pair("--primary", "--primary-foreground", 4.5, "1.4.3"),
  pair("--primary", "--background", 3, "1.4.11"),
  pair("--primary", "--secondary", 3, "1.4.11"),
  pair("--background", "--foreground", 4.5, "1.4.3"),
  pair("--background", "--muted-foreground", 4.5, "1.4.3"),
  pair("--background", "--ring", 3, "2.4.13"),
  ...SERIES_TOKENS.map((series) => pair("--background", series, 3, "1.4.11")),
  ...SERIES_TOKENS.map((series) =>
    pair(series, "--chart-label-inside", 3, "1.4.11"),
  ),
];

const COLOUR_MODES: readonly ColourMode[] = ["light", "dark"];

/**
 * Throws a located error for the first brand colour or palette entry, in
 * either mode, under its contrast floor against the theme it lands in —
 * the defaults, or a page's project brand from `brandedThemeTokens`. It
 * names the side to change and never adjusts the colour itself.
 *
 * @example
 * checkBrandContrast({ colors: {}, palette: { light: ["#45a1bf"] } });
 * // throws "brand.palette.light[0]: #45a1bf against --background #ffffff measures 2.95:1, …"
 */
export function checkBrandContrast(
  brand: BrandTheme,
  theme: ThemeTokens = DEFAULT_THEME_TOKENS,
): void {
  for (const mode of COLOUR_MODES) {
    const sides = brandSides(brand, mode);
    const shortfall = CONTRAST_PAIRS.map((checked) =>
      measure(checked, sides, theme[mode]),
    ).find((measured) => measured !== undefined);
    if (shortfall) throw contrastTooLow(shortfall);
  }
}

/**
 * The theme a brand paints: each colour and palette entry over the default
 * token it replaces, per mode. A page's front-matter brand is checked
 * against its project's, since the page's colours land on that theme.
 *
 * @example
 * brandedThemeTokens({ colors: { background: { light: "#fffdf5", dark: "#111111" } }, palette: {}, scale: {} })
 *   .light["--background"]; // → "#fffdf5"
 */
export function brandedThemeTokens(brand: BrandTheme): ThemeTokens {
  const branded = (mode: ColourMode) => ({
    ...DEFAULT_THEME_TOKENS[mode],
    ...Object.fromEntries(
      [...brandSides(brand, mode)].map(([token, side]) => [token, side.colour]),
    ),
  });
  return { light: branded("light"), dark: branded("dark") };
}

function pair(
  first: ThemeTokenName,
  second: ThemeTokenName,
  floor: number,
  criterion: string,
): ContrastPair {
  return { first, second, floor, criterion };
}

// One side of a pair as it lands in a mode: a brand colour carries the
// path the author wrote it at.
interface PairSide {
  readonly token: ThemeTokenName;
  readonly colour: string;
  readonly brandPath?: readonly string[];
}

// The brand's colours in one mode, keyed by the token each one replaces.
type BrandSides = ReadonlyMap<ThemeTokenName, PairSide>;

function brandSides(brand: BrandTheme, mode: ColourMode): BrandSides {
  const colours = BRAND_KEYS.flatMap((key) => {
    const colour = brand.colors[key]?.[mode];
    if (colour === undefined) return [];
    const brandPath = ["brand", "colors", key, mode];
    return [{ token: BRAND_TOKENS[key], colour, brandPath }];
  });
  const palette = (brand.palette[mode] ?? []).flatMap((colour, index) => {
    const token = SERIES_TOKENS[index];
    if (token === undefined) return [];
    const brandPath = ["brand", "palette", mode, String(index)];
    return [{ token, colour, brandPath }];
  });
  return new Map([...colours, ...palette].map((side) => [side.token, side]));
}

function measure(
  checked: ContrastPair,
  sides: BrandSides,
  theme: ThemeTokens[ColourMode],
): ContrastShortfall | undefined {
  const first = pairSide(checked.first, sides, theme);
  const second = pairSide(checked.second, sides, theme);
  const [subject, neighbour] = first.brandPath
    ? [first, second]
    : [second, first];
  if (!subject.brandPath) return undefined;
  const ratio = contrastRatio(subject.colour, neighbour.colour);
  if (ratio >= checked.floor) return undefined;
  return shortfall(subject.brandPath, subject, neighbour, ratio, checked);
}

function shortfall(
  keyPath: readonly string[],
  subject: PairSide,
  neighbour: PairSide,
  ratio: number,
  checked: ContrastPair,
): ContrastShortfall {
  return {
    keyPath,
    colour: subject.colour,
    against: neighbour.brandPath
      ? formatKeyPath(neighbour.brandPath)
      : neighbour.token,
    againstColour: neighbour.colour,
    ratio,
    floor: checked.floor,
    criterion: checked.criterion,
    fixes: [subject, neighbour].flatMap((side) =>
      side.brandPath ? [formatKeyPath(side.brandPath)] : [],
    ),
  };
}

function pairSide(
  token: ThemeTokenName,
  sides: BrandSides,
  theme: ThemeTokens[ColourMode],
): PairSide {
  return sides.get(token) ?? { token, colour: theme[token] };
}
