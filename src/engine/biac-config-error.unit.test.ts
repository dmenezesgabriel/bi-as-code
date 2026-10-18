import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import {
  contrastTooLow,
  formatKeyPath,
  invalid,
  locatedError,
  unknownKey,
} from "./biac-config-error.js";

afterEach(() => {
  cleanupProjects();
});

function writeConfig(source: string): string {
  const root = makeTempProject("biac-config-error-");
  writeProjectFile(root, "biac.config.ts", source);
  return join(root, "biac.config.ts");
}

describe("formatKeyPath", () => {
  it.each([
    [["title"], "title"],
    [["brand", "colors", "primary", "light"], "brand.colors.primary.light"],
    [["brand", "palette", "dark", "7"], "brand.palette.dark[7]"],
  ])("writes %j as %s", (keyPath, written) => {
    const formatted = formatKeyPath(keyPath);

    expect(formatted).toBe(written);
  });
});

describe("field errors", () => {
  it("names the field, its expected shape and the value", () => {
    const error = invalid("title", ["title"], "a string", 42);

    expect(error).toMatchObject({
      keyPath: ["title"],
      message: "title: expected a string, got 42",
    });
  });

  it("names a colour under its contrast floor, its neighbour and the key to change", () => {
    const error = contrastTooLow({
      keyPath: ["brand", "colors", "primary", "light"],
      colour: "#8a8a8a",
      against: "--primary-foreground",
      againstColour: "#ffffff",
      ratio: 3.4567,
      floor: 4.5,
      criterion: "1.4.3",
      fixes: ["brand.colors.primary.light"],
    });

    expect(error).toMatchObject({
      keyPath: ["brand", "colors", "primary", "light"],
      message:
        "brand.colors.primary.light: #8a8a8a against --primary-foreground #ffffff measures 3.45:1, expected at least 4.5:1 (WCAG 2.2 SC 1.4.3) — change brand.colors.primary.light",
    });
  });

  it("writes an array index in brackets in a palette colour's path", () => {
    const error = contrastTooLow({
      keyPath: ["brand", "palette", "light", "0"],
      colour: "#45a1bf",
      against: "--background",
      againstColour: "#ffffff",
      ratio: 2.96,
      floor: 3,
      criterion: "1.4.11",
      fixes: ["brand.palette.light[0]"],
    });

    expect(error.message).toMatch(
      /^brand\.palette\.light\[0\]: #45a1bf against/,
    );
  });

  it("names an unknown key by its dotted path with a suggestion", () => {
    const error = unknownKey("sidebr", ["nav"], ["sidebar"]);

    expect(error).toMatchObject({
      keyPath: ["nav", "sidebr"],
      message:
        "nav.sidebr: unknown key, expected one of sidebar (did you mean sidebar?)",
    });
  });
});

describe("locatedError", () => {
  it("prefixes the file's line and column and sets vite's id and loc", () => {
    const file = writeConfig("export default {\n  title: 42,\n};\n");

    const error = locatedError(
      invalid("title", ["title"], "a string", 42),
      file,
    );

    expect(error).toMatchObject({
      message: "Invalid biac.config.ts:2:3 — title: expected a string, got 42",
      id: file,
      loc: { file, line: 2, column: 3 },
    });
  });

  it("names the file alone when the key has no position", () => {
    const file = writeConfig(
      "const extra = { titel: 1 };\nexport default { ...extra };\n",
    );

    const error = locatedError(unknownKey("titel", [], ["title"]), file);

    expect(error.message).toMatch(
      /^Invalid biac\.config\.ts — titel: unknown key/,
    );
    expect(error).toMatchObject({ id: file });
    expect(error).not.toHaveProperty("loc");
  });
});
