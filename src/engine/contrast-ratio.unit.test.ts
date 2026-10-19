import { describe, expect, it } from "vitest";
import { blendOver, contrastRatio, toLinearSrgb } from "./contrast-ratio.js";

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

describe("toLinearSrgb", () => {
  it("decodes each channel through the sRGB transfer function", () => {
    const linear = toLinearSrgb("#ff8000");

    expect(linear[0]).toBe(1);
    expect(linear[1]).toBeCloseTo(0.2159, 4);
    expect(linear[2]).toBe(0);
  });

  it("names the offending value and the expected shape", () => {
    const decode = () => toLinearSrgb("#fff");

    expect(decode).toThrow('Expected a "#rrggbb" colour, got "#fff"');
  });
});

describe("blendOver", () => {
  it.each([
    ["#007a55", "#fafafa", 0.1, "#e1edea"],
    ["#ff6467", "#171717", 0.1, "#2e1f1f"],
    ["#123456", "#ffffff", 1, "#123456"],
    ["#123456", "#ffffff", 0, "#ffffff"],
  ] as const)(
    "lays %s over %s at alpha %s",
    (foreground, background, alpha, expected) => {
      const blended = blendOver(foreground, background, alpha);

      expect(blended).toBe(expected);
    },
  );

  it("names the offending alpha and the expected range", () => {
    const blend = () => blendOver("#000000", "#ffffff", 1.5);

    expect(blend).toThrow("Expected an alpha from 0 to 1, got 1.5");
  });
});
