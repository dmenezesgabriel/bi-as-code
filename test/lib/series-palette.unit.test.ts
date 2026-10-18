import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/engine/contrast-ratio.js";
import {
  minimumSeparation,
  type ColourVision,
} from "./palette-separability.js";
import { ruleBody, tokenIn } from "./stylesheet-tokens.js";

// The floors the series palette is chosen against: Okabe–Ito parity for
// separability (its worst case, tritan, measures 16.1) and WCAG 2.2 SC
// 1.4.11's 3:1 for graphical objects against the page and against the
// value label drawn inside a stacked band.
const MINIMUM_DELTA_E = 16;
const MINIMUM_CONTRAST = 3;
const SERIES_TOKEN_COUNT = 8;
const VISIONS: readonly ColourVision[] = [
  "normal",
  "protan",
  "deutan",
  "tritan",
];

type ModePalette = {
  readonly background: string;
  readonly labelInside: string;
  readonly series: readonly string[];
};

function modePalette(selector: string): ModePalette {
  const body = ruleBody(selector);
  return {
    background: tokenIn(body, "--background"),
    labelInside: tokenIn(body, "--chart-label-inside"),
    series: Array.from({ length: SERIES_TOKEN_COUNT }, (_, index) =>
      tokenIn(body, `--chart-${index + 1}`),
    ),
  };
}

// Each series colour under the contrast floor against `other`, with its ratio.
function belowContrast(
  series: readonly string[],
  other: string,
): readonly string[] {
  return series
    .map((hex) => ({ hex, ratio: contrastRatio(hex, other) }))
    .filter(({ ratio }) => ratio < MINIMUM_CONTRAST)
    .map(({ hex, ratio }) => `${hex} ${ratio.toFixed(2)}:1 on ${other}`);
}

describe.each([
  ["light", ":root,\n.light"],
  ["dark", ".dark"],
])("the %s series palette in styles.css", (_mode, selector) => {
  const palette = modePalette(selector);

  it.each(VISIONS)("keeps every series apart under %s vision", (vision) => {
    const closest = minimumSeparation(palette.series, vision);

    expect(
      closest.deltaE,
      `${closest.pair.join("/")} under ${vision} vision`,
    ).toBeGreaterThanOrEqual(MINIMUM_DELTA_E);
  });

  it("stands every series out from the page background", () => {
    const failing = belowContrast(palette.series, palette.background);

    expect(failing).toEqual([]);
  });

  it("keeps an inside value label legible on every series", () => {
    const failing = belowContrast(palette.series, palette.labelInside);

    expect(failing).toEqual([]);
  });
});
