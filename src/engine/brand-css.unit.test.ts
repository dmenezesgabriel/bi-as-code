import { describe, expect, it } from "vitest";
import { brandCss } from "./brand-css.js";

describe("brandCss — colours", () => {
  it("emits nothing when no brand colour is set", () => {
    const css = brandCss({ colors: {}, palette: {} });

    expect(css).toBe("");
  });

  it("sets each brand colour on the light and dark selectors styles.css uses", () => {
    const css = brandCss({
      colors: {
        primary: { light: "#154886", dark: "#60a5fa" },
        background: { light: "#fffdf5", dark: "#0a0a0a" },
      },
      palette: {},
    });

    expect(css).toBe(
      ":root,\n.light {\n  --primary: #154886;\n  --background: #fffdf5;\n}\n" +
        ".dark {\n  --primary: #60a5fa;\n  --background: #0a0a0a;\n}\n",
    );
  });

  it("leaves a colour the brand omits to styles.css", () => {
    const css = brandCss({
      colors: { primary: { light: "#154886", dark: "#60a5fa" } },
      palette: {},
    });

    expect(css).not.toContain("--background");
  });
});

describe("brandCss — palette", () => {
  it("lays each palette colour over the series token at its position", () => {
    const css = brandCss({
      colors: {},
      palette: { light: ["#1e40af", "#d55e00"], dark: ["#60a5fa"] },
    });

    expect(css).toBe(
      ":root,\n.light {\n  --chart-1: #1e40af;\n  --chart-2: #d55e00;\n}\n" +
        ".dark {\n  --chart-1: #60a5fa;\n}\n",
    );
  });

  it("emits no rule for a mode with neither a colour nor a palette", () => {
    const css = brandCss({ colors: {}, palette: { light: ["#1e40af"] } });

    expect(css).toBe(":root,\n.light {\n  --chart-1: #1e40af;\n}\n");
  });

  it("puts the colours and the palette in one rule per mode", () => {
    const css = brandCss({
      colors: { primary: { light: "#154886", dark: "#60a5fa" } },
      palette: { dark: ["#60a5fa"] },
    });

    expect(css).toBe(
      ":root,\n.light {\n  --primary: #154886;\n}\n" +
        ".dark {\n  --primary: #60a5fa;\n  --chart-1: #60a5fa;\n}\n",
    );
  });
});
