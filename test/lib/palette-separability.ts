/**
 * How far apart a series palette's colours stay for readers with and
 * without colour-vision deficiency, and how they contrast with the page:
 * Machado severity-1.0 simulation and CIE76 ΔE in CIELAB (D65); WCAG 2.2
 * contrast is `src/engine/contrast-ratio.ts`. Inputs are `#rrggbb` hexes, the form every `--chart-*` and
 * `--background` token takes in `src/web/src/styles.css`.
 */

import { toLinearSrgb } from "../../src/engine/contrast-ratio.js";

export type ColourVision = "normal" | "protan" | "deutan" | "tritan";

type Triple = readonly [number, number, number];

/** Linear-light sRGB channels, each in [0, 1]. */
export type LinearRgb = readonly [red: number, green: number, blue: number];

/** CIELAB coordinates under D65. */
export type Cielab = readonly [lightness: number, a: number, b: number];

export type PaletteSeparation = {
  readonly deltaE: number;
  readonly pair: readonly [string, string];
};

type Matrix3 = readonly [Triple, Triple, Triple];

// Severity-1.0 matrices, Table 1 of Machado, Oliveira & Fernandes 2009,
// "A Physiologically-based Model for Simulation of Color Vision Deficiency",
// IEEE TVCG 15(6) — https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html.
// The paper leaves the input encoding unstated; they are applied to linear
// sRGB, which is what reproduces the usability audit's published numbers.
const MACHADO_SEVERITY_1: Record<Exclude<ColourVision, "normal">, Matrix3> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

// IEC 61966-2-1 sRGB primaries to CIE XYZ, and the D65 reference white.
const LINEAR_SRGB_TO_XYZ: Matrix3 = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];
const D65_WHITE = [0.95047, 1, 1.08883] as const;

/**
 * The colour a reader with the given vision perceives, as linear sRGB.
 *
 * @example
 * simulateColourVision("#2563eb", "deutan"); // → [0.08…, 0.10…, 0.83…]
 */
export function simulateColourVision(
  hex: string,
  vision: ColourVision,
): LinearRgb {
  const linear = toLinearSrgb(hex);
  if (vision === "normal") return linear;
  return mapTriple(multiply(MACHADO_SEVERITY_1[vision], linear), clampUnit);
}

/**
 * CIELAB (D65) coordinates of a linear sRGB colour.
 *
 * @example
 * toCielab([1, 1, 1]); // → [100, 0, 0]
 */
export function toCielab(linear: LinearRgb): Cielab {
  const xyz = multiply(LINEAR_SRGB_TO_XYZ, linear);
  const x = labCompand(xyz[0] / D65_WHITE[0]);
  const y = labCompand(xyz[1] / D65_WHITE[1]);
  const z = labCompand(xyz[2] / D65_WHITE[2]);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/**
 * CIE76 colour difference: Euclidean distance in CIELAB.
 *
 * @example
 * deltaE76(toCielab([0, 0, 0]), toCielab([1, 1, 1])); // → 100
 */
export function deltaE76(first: Cielab, second: Cielab): number {
  return Math.hypot(
    first[0] - second[0],
    first[1] - second[1],
    first[2] - second[2],
  );
}

/**
 * The closest pair of a palette under the given vision, and its ΔE.
 *
 * @example
 * minimumSeparation(["#2563eb", "#7c3aed"], "deutan"); // → { deltaE: 1.7…, pair: ["#2563eb", "#7c3aed"] }
 */
export function minimumSeparation(
  hexes: readonly string[],
  vision: ColourVision,
): PaletteSeparation {
  if (hexes.length < 2) {
    throw new Error(
      `Expected at least 2 colours to compare, got ${hexes.length}: ${hexes.join(", ")}`,
    );
  }
  const perceived = hexes.map((hex) => ({
    hex,
    lab: toCielab(simulateColourVision(hex, vision)),
  }));
  return perceived
    .flatMap((first, index) =>
      perceived.slice(index + 1).map(
        (second): PaletteSeparation => ({
          deltaE: deltaE76(first.lab, second.lab),
          pair: [first.hex, second.hex],
        }),
      ),
    )
    .reduce((closest, pair) => (pair.deltaE < closest.deltaE ? pair : closest));
}

// CIE 1976 L*a*b* companding, with its linear segment near black.
function labCompand(ratio: number): number {
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  return ratio > epsilon ? Math.cbrt(ratio) : (kappa * ratio + 16) / 116;
}

function multiply(matrix: Matrix3, vector: Triple): Triple {
  const dot = (row: Triple): number =>
    row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2];
  return mapTriple(matrix, dot);
}

function mapTriple<T>(
  triple: readonly [T, T, T],
  map: (value: T) => number,
): Triple {
  return [map(triple[0]), map(triple[1]), map(triple[2])];
}

function clampUnit(channel: number): number {
  return Math.min(1, Math.max(0, channel));
}
