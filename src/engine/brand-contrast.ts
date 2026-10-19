import { contrastTooLow, formatKeyPath } from "./biac-config-error.js";
import { blendOver, contrastRatio } from "./contrast-ratio.js";
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
  // Set when `first` is text on a chip of its own colour at this alpha over
  // `second`: the pair measures `first` against that chip.
  readonly tint?: number;
}

const BRAND_KEYS = Object.keys(BRAND_TOKENS) as BrandKey[];

const DELTA_TOKENS: readonly ThemeTokenName[] = ["--positive", "--negative"];
const DELTA_SURFACES: readonly ThemeTokenName[] = [
  "--background",
  "--card",
  "--card-mode-background",
];
// The alpha of a delta chip's fill, `bg-positive/10` in
// `src/web/src/features/widgets/value/delta-display.tsx`.
const CHIP_TINT = 0.1;

// Every pair a brand colour paints into, at its WCAG 2.2 floor
// (https://www.w3.org/TR/WCAG22/): SC 1.4.3 4.5:1 for text — the pressed
// button-group label on `--primary`, body and muted text on
// `--background`; SC 1.4.11 3:1 for the shapes of a control — the checked
// toggle and slider thumb on the page, the slider's filled indicator on its
// `--secondary` track — and for every chart series, brand or default, on
// the canvas and under the label drawn inside it (ADR-0016's floors); SC
// 2.4.13 3:1 for the focus ring on the page; SC 1.4.3 4.5:1 for a delta's
// text on every surface it sits on — the page, a widget card, the card-mode
// page under an inline delta — and on its own chip over each; SC 1.4.3 4.5:1
// for a control's value and placeholder on `--field`, and for the title,
// folder and link text on `--sidebar`, whose links draw their focus ring
// inside it (SC 2.4.13 3:1). A pair is checked when either side is a brand
// colour.
//
// Not checked: `--field` against its `--input` border and the toggle thumb
// against its `--secondary` track (SC 1.4.11), which the defaults already
// miss (1.48:1 and 1.26:1 in light), the label and placeholder naming the
// control; and the active sidebar link's `--sidebar-accent` chip, which
// cannot fail while the plain sidebar pairs pass so long as
// `--sidebar-accent`, `--foreground` and `--ring` are not brand colours.
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
  ...DELTA_TOKENS.flatMap((tone) =>
    DELTA_SURFACES.map((surface) => pair(tone, surface, 4.5, "1.4.3")),
  ),
  ...DELTA_TOKENS.flatMap((tone) =>
    DELTA_SURFACES.map((surface) => chipPair(tone, surface)),
  ),
  pair("--field", "--foreground", 4.5, "1.4.3"),
  pair("--field", "--muted-foreground-faded", 4.5, "1.4.3"),
  pair("--sidebar", "--foreground", 4.5, "1.4.3"),
  pair("--sidebar", "--sidebar-foreground", 4.5, "1.4.3"),
  pair("--sidebar", "--muted-foreground", 4.5, "1.4.3"),
  pair("--sidebar", "--ring", 3, "2.4.13"),
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

function chipPair(tone: ThemeTokenName, surface: ThemeTokenName): ContrastPair {
  return { ...pair(tone, surface, 4.5, "1.4.3"), tint: CHIP_TINT };
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
  const brandPath = first.brandPath ?? second.brandPath;
  if (!brandPath) return undefined;
  const surface =
    checked.tint === undefined
      ? second.colour
      : blendOver(first.colour, second.colour, checked.tint);
  const ratio = contrastRatio(first.colour, surface);
  if (ratio >= checked.floor) return undefined;
  return shortfall(brandPath, first, second, ratio, checked);
}

// The shortfall is located at the brand side, the first when both are; the
// other side is named by its brand key when the author wrote it too.
function shortfall(
  keyPath: readonly string[],
  first: PairSide,
  second: PairSide,
  ratio: number,
  checked: ContrastPair,
): ContrastShortfall {
  const firstIsSubject = first.brandPath !== undefined;
  return {
    keyPath,
    colour: firstIsSubject ? first.colour : second.colour,
    ...describeNeighbour(first, second, firstIsSubject, checked.tint),
    ratio,
    floor: checked.floor,
    criterion: checked.criterion,
    fixes: [first, second].flatMap((side) =>
      side.brandPath ? [formatKeyPath(side.brandPath)] : [],
    ),
  };
}

// What the subject was measured against. On a chip pair the text is
// measured against the chip, so a brand surface is named under the text it
// carries, and brand text against the chip it paints over the surface.
function describeNeighbour(
  first: PairSide,
  second: PairSide,
  firstIsSubject: boolean,
  tint: number | undefined,
): Pick<ContrastShortfall, "against" | "againstColour"> {
  const neighbour = firstIsSubject ? second : first;
  if (tint === undefined) {
    return { against: sideName(neighbour), againstColour: neighbour.colour };
  }
  const percent = `${tint * 100}%`;
  if (!firstIsSubject) {
    return {
      against: `${first.token} on its ${percent} chip`,
      againstColour: first.colour,
    };
  }
  return {
    against: `its ${percent} chip over ${sideName(second)}`,
    againstColour: blendOver(first.colour, second.colour, tint),
  };
}

function sideName(side: PairSide): string {
  return side.brandPath ? formatKeyPath(side.brandPath) : side.token;
}

function pairSide(
  token: ThemeTokenName,
  sides: BrandSides,
  theme: ThemeTokens[ColourMode],
): PairSide {
  return sides.get(token) ?? { token, colour: theme[token] };
}
