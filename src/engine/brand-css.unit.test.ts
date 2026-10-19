import { describe, expect, it } from "vitest";
import { brandCss } from "./brand-css.js";

describe("brandCss — colours", () => {
  it("emits nothing when no brand colour is set", () => {
    const css = brandCss({ colors: {}, palette: {}, scale: {}, fonts: {} });

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
      fonts: {},
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
      fonts: {},
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
      fonts: {},
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
      fonts: {},
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
      fonts: {},
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
      fonts: {},
    });

    expect(css).toBe(":root,\n.light {\n  --chart-1: #1e40af;\n}\n");
  });

  it("puts the colours and the palette in one rule per mode", () => {
    const css = brandCss({
      colors: { primary: { light: "#154886", dark: "#60a5fa" } },
      palette: { dark: ["#60a5fa"] },
      scale: {},
      fonts: {},
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
      fonts: {},
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
      fonts: {},
    });

    expect(css).toBe(
      ":root,\n.light {\n  --chart-1: #1e40af;\n  --chart-scale: #60a5fa;\n}\n",
    );
  });
});

describe("brandCss — fonts", () => {
  it("sets each brand font to its named stack in one rule for both modes", () => {
    const css = brandCss({
      colors: {},
      palette: {},
      scale: {},
      fonts: { body: "serif", heading: "sans-serif", code: "mono" },
    });

    expect(css).toBe(
      ":root {\n  --body-font: var(--font-stack-serif);\n" +
        "  --heading-font: var(--font-stack-sans-serif);\n" +
        "  --code-font: var(--font-stack-mono);\n}\n",
    );
  });

  it("leaves a font the brand omits to styles.css", () => {
    const css = brandCss({
      colors: {},
      palette: {},
      scale: {},
      fonts: { body: "serif" },
    });

    expect(css).toBe(":root {\n  --body-font: var(--font-stack-serif);\n}\n");
  });

  it("puts the font rule before the per-mode colour rules", () => {
    const css = brandCss({
      colors: { primary: { light: "#154886", dark: "#60a5fa" } },
      palette: {},
      scale: {},
      fonts: { code: "serif" },
    });

    expect(css).toBe(
      ":root {\n  --code-font: var(--font-stack-serif);\n}\n" +
        ":root,\n.light {\n  --primary: #154886;\n}\n" +
        ".dark {\n  --primary: #60a5fa;\n}\n",
    );
  });
});

describe("brandCss — root font size", () => {
  it.each([
    [18, "112.5%"],
    [12, "75%"],
    [24, "150%"],
  ])(
    "sets %i px as %s of the browser's default size on :root",
    (fontSize, percent) => {
      const css = brandCss({
        colors: {},
        palette: {},
        scale: {},
        fonts: {},
        fontSize,
      });

      expect(css).toBe(`:root {\n  font-size: ${percent};\n}\n`);
    },
  );

  it("puts the root font size in the font rule, after the font tokens", () => {
    const css = brandCss({
      colors: {},
      palette: {},
      scale: {},
      fonts: { body: "serif" },
      fontSize: 18,
    });

    expect(css).toBe(
      ":root {\n  --body-font: var(--font-stack-serif);\n" +
        "  font-size: 112.5%;\n}\n",
    );
  });
});

describe("brandCss — corner radius", () => {
  it.each(["0", "12px", "1.5rem"])(
    "sets a radius of %s over --radius on :root",
    (radius) => {
      const css = brandCss({
        colors: {},
        palette: {},
        scale: {},
        fonts: {},
        radius,
      });

      expect(css).toBe(`:root {\n  --radius: ${radius};\n}\n`);
    },
  );

  it("puts the radius in the font rule, after the root font size", () => {
    const css = brandCss({
      colors: {},
      palette: {},
      scale: {},
      fonts: { body: "serif" },
      fontSize: 18,
      radius: "1rem",
    });

    expect(css).toBe(
      ":root {\n  --body-font: var(--font-stack-serif);\n" +
        "  font-size: 112.5%;\n  --radius: 1rem;\n}\n",
    );
  });
});
