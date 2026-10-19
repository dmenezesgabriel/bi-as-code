import { describe, expect, it } from "vitest";
import { brandCss } from "./brand-css.js";

describe("brandCss — colours", () => {
  it("emits nothing when no brand colour is set", () => {
    const css = brandCss({ colors: {}, palette: {}, scale: {} });

    expect(css).toBe("");
  });

  it("sets each brand colour on the light and dark selectors styles.css uses", () => {
    const css = brandCss({
      colors: {
        primary: { light: "#154886", dark: "#60a5fa" },
        background: { light: "#fffdf5", dark: "#0a0a0a" },
      },
      palette: {},
      scale: {},
    });

    expect(css).toBe(
      ":root,\n.light {\n  --primary: #154886;\n  --background: #fffdf5;\n}\n" +
        ".dark {\n  --primary: #60a5fa;\n  --background: #0a0a0a;\n}\n",
    );
  });

  it("sets the delta tones over --positive and --negative per mode", () => {
    const css = brandCss({
      colors: {
        positive: { light: "#047857", dark: "#34d399" },
        negative: { light: "#b91c1c", dark: "#f87171" },
      },
      palette: {},
      scale: {},
    });

    expect(css).toBe(
      ":root,\n.light {\n  --positive: #047857;\n  --negative: #b91c1c;\n}\n" +
        ".dark {\n  --positive: #34d399;\n  --negative: #f87171;\n}\n",
    );
  });

  it("sets the field and sidebar surfaces over --field and --sidebar per mode", () => {
    const css = brandCss({
      colors: {
        field: { light: "#f8fafc", dark: "#1e293b" },
        sidebar: { light: "#f1f5f9", dark: "#0f172a" },
      },
      palette: {},
      scale: {},
    });

    expect(css).toBe(
      ":root,\n.light {\n  --field: #f8fafc;\n  --sidebar: #f1f5f9;\n}\n" +
        ".dark {\n  --field: #1e293b;\n  --sidebar: #0f172a;\n}\n",
    );
  });

  it("leaves a colour the brand omits to styles.css", () => {
    const css = brandCss({
      colors: { primary: { light: "#154886", dark: "#60a5fa" } },
      palette: {},
      scale: {},
    });

    expect(css).not.toContain("--background");
  });
});

describe("brandCss — palette", () => {
  it("lays each palette colour over the series token at its position", () => {
    const css = brandCss({
      colors: {},
      palette: { light: ["#1e40af", "#d55e00"], dark: ["#60a5fa"] },
      scale: {},
    });

    expect(css).toBe(
      ":root,\n.light {\n  --chart-1: #1e40af;\n  --chart-2: #d55e00;\n}\n" +
        ".dark {\n  --chart-1: #60a5fa;\n}\n",
    );
  });

  it("emits no rule for a mode with neither a colour nor a palette", () => {
    const css = brandCss({
      colors: {},
      palette: { light: ["#1e40af"] },
      scale: {},
    });

    expect(css).toBe(":root,\n.light {\n  --chart-1: #1e40af;\n}\n");
  });

  it("puts the colours and the palette in one rule per mode", () => {
    const css = brandCss({
      colors: { primary: { light: "#154886", dark: "#60a5fa" } },
      palette: { dark: ["#60a5fa"] },
      scale: {},
    });

    expect(css).toBe(
      ":root,\n.light {\n  --primary: #154886;\n}\n" +
        ".dark {\n  --primary: #60a5fa;\n  --chart-1: #60a5fa;\n}\n",
    );
  });
});

describe("brandCss — scale", () => {
  it("sets each mode's scale as one comma-separated ramp token", () => {
    const css = brandCss({
      colors: {},
      palette: {},
      scale: { light: ["#1e40af"], dark: ["#0a0a0a", "#60a5fa", "#ffffff"] },
    });

    expect(css).toBe(
      ":root,\n.light {\n  --chart-scale: #1e40af;\n}\n" +
        ".dark {\n  --chart-scale: #0a0a0a, #60a5fa, #ffffff;\n}\n",
    );
  });

  it("puts the scale after the palette in its mode's rule", () => {
    const css = brandCss({
      colors: {},
      palette: { light: ["#1e40af"] },
      scale: { light: ["#60a5fa"] },
    });

    expect(css).toBe(
      ":root,\n.light {\n  --chart-1: #1e40af;\n  --chart-scale: #60a5fa;\n}\n",
    );
  });
});
