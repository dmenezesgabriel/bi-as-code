/**
 * WCAG 2.2 contrast between `#rrggbb` colours, the one form every theme
 * token and brand colour takes (ADR-0014). Shared by the brand-colour
 * check at config load and the series-palette floors (ADR-0016).
 */

type LinearSrgb = readonly [red: number, green: number, blue: number];

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/**
 * WCAG 2.2 contrast ratio between two colours, in either order.
 *
 * @example
 * contrastRatio("#000000", "#ffffff"); // → 21
 */
export function contrastRatio(firstHex: string, secondHex: string): number {
  const first = relativeLuminance(firstHex);
  const second = relativeLuminance(secondHex);
  const [lighter, darker] = [Math.max(first, second), Math.min(first, second)];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Linear-light sRGB channels of a `#rrggbb` colour, each in [0, 1].
 *
 * @example
 * toLinearSrgb("#ff8000"); // → [1, 0.2159…, 0]
 */
export function toLinearSrgb(hex: string): LinearSrgb {
  if (!HEX_COLOUR.test(hex)) {
    throw new Error(`Expected a "#rrggbb" colour, got "${hex}"`);
  }
  const packed = parseInt(hex.slice(1), 16);
  const channel = (shift: number): number =>
    srgbToLinear(((packed >> shift) & 0xff) / 255);
  return [channel(16), channel(8), channel(0)];
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = toLinearSrgb(hex);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// The sRGB transfer function (IEC 61966-2-1), as WCAG 2.2 defines it.
function srgbToLinear(encoded: number): number {
  return encoded <= 0.04045
    ? encoded / 12.92
    : ((encoded + 0.055) / 1.055) ** 2.4;
}
