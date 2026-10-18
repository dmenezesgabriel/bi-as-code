import { describe, expect, it } from "vitest";
import { brandCss } from "./brand-css.js";

describe("brandCss", () => {
  it("emits nothing when no brand colour is set", () => {
    const css = brandCss({});

    expect(css).toBe("");
  });

  it("sets each brand colour on the light and dark selectors styles.css uses", () => {
    const css = brandCss({
      primary: { light: "#154886", dark: "#60a5fa" },
      background: { light: "#fffdf5", dark: "#0a0a0a" },
    });

    expect(css).toBe(
      ":root,\n.light {\n  --primary: #154886;\n  --background: #fffdf5;\n}\n" +
        ".dark {\n  --primary: #60a5fa;\n  --background: #0a0a0a;\n}\n",
    );
  });

  it("leaves a colour the brand omits to styles.css", () => {
    const css = brandCss({ primary: { light: "#154886", dark: "#60a5fa" } });

    expect(css).not.toContain("--background");
  });
});
