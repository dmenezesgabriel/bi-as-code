import { contrastTooLow } from "./biac-config-error.js";
import { contrastRatio } from "./contrast-ratio.js";
import {
  BRAND_TOKENS,
  DEFAULT_THEME_TOKENS,
  type ThemeTokenName,
} from "./default-theme-tokens.js";
import type { BrandColours, ColourMode, ContrastShortfall } from "./types.js";

type BrandKey = keyof BrandColours;

interface ContrastPair {
  readonly first: ThemeTokenName;
  readonly second: ThemeTokenName;
  readonly floor: number;
  readonly criterion: string;
}

const BRAND_KEYS = Object.keys(BRAND_TOKENS) as BrandKey[];

const SERIES_TOKENS: readonly ThemeTokenName[] = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
];

// Every pair a brand colour paints into, at its WCAG 2.2 floor
// (https://www.w3.org/TR/WCAG22/): SC 1.4.3 4.5:1 for text — the pressed
// button-group label on `--primary`, body and muted text on
// `--background`; SC 1.4.11 3:1 for the shapes of a control — the checked
// toggle and slider thumb on the page, the slider's filled indicator on its
// `--secondary` track — and for chart series on the canvas (ADR-0016's
// floor, held for the default palette on any brand background); SC 2.4.13
// 3:1 for the focus ring on the page. A pair is checked when either side is
// a brand colour.
const CONTRAST_PAIRS: readonly ContrastPair[] = [
  pair("--primary", "--primary-foreground", 4.5, "1.4.3"),
  pair("--primary", "--background", 3, "1.4.11"),
  pair("--primary", "--secondary", 3, "1.4.11"),
  pair("--background", "--foreground", 4.5, "1.4.3"),
  pair("--background", "--muted-foreground", 4.5, "1.4.3"),
  pair("--background", "--ring", 3, "2.4.13"),
  ...SERIES_TOKENS.map((series) => pair("--background", series, 3, "1.4.11")),
];

const COLOUR_MODES: readonly ColourMode[] = ["light", "dark"];

/**
 * Throws a located error for the first brand colour, in either mode, under
 * its contrast floor against the theme it lands in. It names the side to
 * change and never adjusts the colour itself.
 *
 * @example
 * checkBrandContrast({ background: { light: "#fdf6e3", dark: "#0a0a0a" } });
 * // throws "brand.colors.background.light: #fdf6e3 against --chart-4 #cc79a7 measures 2.84:1, …"
 */
export function checkBrandContrast(colours: BrandColours): void {
  for (const mode of COLOUR_MODES) {
    const shortfall = CONTRAST_PAIRS.map((checked) =>
      measure(checked, colours, mode),
    ).find((measured) => measured !== undefined);
    if (shortfall) throw contrastTooLow(shortfall);
  }
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

function measure(
  checked: ContrastPair,
  colours: BrandColours,
  mode: ColourMode,
): ContrastShortfall | undefined {
  const first = pairSide(checked.first, colours, mode);
  const second = pairSide(checked.second, colours, mode);
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
    against: neighbour.brandPath?.join(".") ?? neighbour.token,
    againstColour: neighbour.colour,
    ratio,
    floor: checked.floor,
    criterion: checked.criterion,
    fixes: [subject, neighbour].flatMap((side) =>
      side.brandPath ? [side.brandPath.join(".")] : [],
    ),
  };
}

function pairSide(
  token: ThemeTokenName,
  colours: BrandColours,
  mode: ColourMode,
): PairSide {
  const key = BRAND_KEYS.find((brandKey) => BRAND_TOKENS[brandKey] === token);
  const brandColour = key ? colours[key]?.[mode] : undefined;
  if (key === undefined || brandColour === undefined) {
    return { token, colour: DEFAULT_THEME_TOKENS[mode][token] };
  }
  return {
    token,
    colour: brandColour,
    brandPath: ["brand", "colors", key, mode],
  };
}
