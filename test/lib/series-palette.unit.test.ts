import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  minimumSeparation,
  type ColourVision,
} from "./palette-separability.js";

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

const STYLESHEET = readFileSync(
  new URL("../../src/web/src/styles.css", import.meta.url),
  "utf8",
);

type ModePalette = {
  readonly background: string;
  readonly labelInside: string;
  readonly series: readonly string[];
};

function ruleBody(selector: string): string {
  const start = STYLESHEET.indexOf(`${selector} {`);
  if (start < 0) {
    throw new Error(`Expected a "${selector} {" rule in styles.css`);
  }
  return STYLESHEET.slice(start, STYLESHEET.indexOf("}", start));
}

function tokenIn(body: string, name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(body);
  if (!match?.[1]) {
    throw new Error(`Expected "${name}: #rrggbb" in the rule, got none`);
  }
  return match[1];
}

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
