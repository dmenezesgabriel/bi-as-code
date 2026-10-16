import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  deltaE76,
  minimumSeparation,
  simulateColourVision,
  toCielab,
} from "./palette-separability.js";

// The series palette `src/web/src/styles.css` shipped before it was chosen
// for colour-vision deficiency, and the published Okabe–Ito set (R
// grDevices `palette.colors("Okabe-Ito")`, grey dropped) — the two palettes
// whose separability the usability audit measured.
const TAILWIND_600_SERIES = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];
const OKABE_ITO = [
  "#000000",
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
];

describe("minimumSeparation", () => {
  it("finds the blue/violet pair that collapses for deutans in the first 5 series", () => {
    const firstFive = TAILWIND_600_SERIES.slice(0, 5);

    const deutan = minimumSeparation(firstFive, "deutan");

    expect(deutan.deltaE).toBeCloseTo(1.7, 1);
    expect(deutan.pair).toEqual(["#2563eb", "#7c3aed"]);
  });

  it.each([
    ["normal", 34.3],
    ["protan", 12.5],
  ] as const)(
    "measures the first 5 series under %s vision",
    (vision, expected) => {
      const firstFive = TAILWIND_600_SERIES.slice(0, 5);

      const separation = minimumSeparation(firstFive, vision);

      expect(separation.deltaE).toBeCloseTo(expected, 1);
    },
  );

  it("finds the emerald/cyan pair that converges for tritans over all 8 series", () => {
    const tritan = minimumSeparation(TAILWIND_600_SERIES, "tritan");

    expect(tritan.deltaE).toBeCloseTo(7.8, 1);
    expect(tritan.pair).toEqual(["#059669", "#0891b2"]);
  });

  it.each([
    ["normal", 26.4],
    ["protan", 20.7],
    ["deutan", 17.0],
    ["tritan", 16.1],
  ] as const)("keeps Okabe–Ito apart under %s vision", (vision, expected) => {
    const separation = minimumSeparation(OKABE_ITO, vision);

    expect(separation.deltaE).toBeCloseTo(expected, 1);
  });

  it("rejects a palette with fewer than two colours", () => {
    const single = ["#2563eb"];

    const measure = () => minimumSeparation(single, "normal");

    expect(measure).toThrow(
      "Expected at least 2 colours to compare, got 1: #2563eb",
    );
  });
});

describe("simulateColourVision", () => {
  it("leaves a colour unchanged under normal vision", () => {
    const white = simulateColourVision("#ffffff", "normal");

    expect(white).toEqual([1, 1, 1]);
  });

  it("clamps a simulated channel into the displayable range", () => {
    const pureBlue = simulateColourVision("#0000ff", "protan");

    expect(pureBlue.every((channel) => channel >= 0 && channel <= 1)).toBe(
      true,
    );
  });

  it("names the value it cannot parse and the shape it expects", () => {
    const shorthand = "#fff";

    const simulate = () => simulateColourVision(shorthand, "deutan");

    expect(simulate).toThrow('Expected a "#rrggbb" colour, got "#fff"');
  });
});

describe("toCielab", () => {
  it("places white at L* 100 with no chroma", () => {
    const [lightness, a, b] = toCielab([1, 1, 1]);

    expect(lightness).toBeCloseTo(100, 2);
    expect(a).toBeCloseTo(0, 2);
    expect(b).toBeCloseTo(0, 2);
  });
});

describe("deltaE76", () => {
  it("is zero between a colour and itself", () => {
    const blue = toCielab(simulateColourVision("#2563eb", "normal"));

    expect(deltaE76(blue, blue)).toBe(0);
  });

  it("is 100 between black and white", () => {
    const black = toCielab([0, 0, 0]);
    const white = toCielab([1, 1, 1]);

    expect(deltaE76(black, white)).toBeCloseTo(100, 2);
  });
});

describe("contrastRatio", () => {
  it.each([
    ["#000000", "#ffffff", 21],
    ["#F0E442", "#ffffff", 1.32],
    ["#000000", "#0a0a0a", 1.06],
  ] as const)("measures %s against %s", (foreground, background, expected) => {
    const ratio = contrastRatio(foreground, background);

    expect(ratio).toBeCloseTo(expected, 2);
  });

  it("is symmetric in its arguments", () => {
    const forward = contrastRatio("#2563eb", "#ffffff");

    const backward = contrastRatio("#ffffff", "#2563eb");

    expect(backward).toBe(forward);
  });
});
