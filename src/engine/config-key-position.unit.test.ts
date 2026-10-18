import { describe, expect, it } from "vitest";
import { findConfigKeyPosition } from "./config-key-position.js";

describe("findConfigKeyPosition — located keys", () => {
  it("finds a top-level key", () => {
    const source =
      'export default {\n  title: "biac",\n  pagewidth: "full",\n};\n';

    const position = findConfigKeyPosition(source, ["pagewidth"]);

    expect(position).toEqual({ line: 3, column: 3 });
  });

  it("finds a nested key by its path", () => {
    const source = "export default {\n  nav: { sidebr: false },\n};\n";

    const position = findConfigKeyPosition(source, ["nav", "sidebr"]);

    expect(position).toEqual({ line: 2, column: 10 });
  });

  it("finds a quoted key", () => {
    const source = 'export default { "pagewidth": 1 };\n';

    const position = findConfigKeyPosition(source, ["pagewidth"]);

    expect(position).toEqual({ line: 1, column: 18 });
  });

  it.each([
    ["satisfies", "export default { titel: 1 } satisfies object;\n"],
    ["as const", "export default { titel: 1 } as const;\n"],
    ["parentheses", "export default ({ titel: 1 });\n"],
  ])("sees through %s around the object", (_case, source) => {
    const position = findConfigKeyPosition(source, ["titel"]);

    expect(position?.line).toBe(1);
    expect(source.slice((position?.column ?? 0) - 1)).toMatch(/^titel/);
  });

  it("counts columns in UTF-16 units after non-ASCII text", () => {
    const source = 'export default { title: "café 🎉", titel: 1 };\n';

    const position = findConfigKeyPosition(source, ["titel"]);

    expect(position).toEqual({ line: 1, column: source.indexOf("titel") + 1 });
  });

  it("counts lines under CRLF line endings", () => {
    const source = "export default {\r\n  title: 1,\r\n  titel: 2,\r\n};\r\n";

    const position = findConfigKeyPosition(source, ["titel"]);

    expect(position).toEqual({ line: 3, column: 3 });
  });

  it("locates the default-exported object for an empty path", () => {
    const source = "// project settings\nexport default 42;\n";

    const position = findConfigKeyPosition(source, []);

    expect(position).toEqual({ line: 2, column: 16 });
  });
});

describe("findConfigKeyPosition — no position", () => {
  it.each([
    [
      "a key spread in from elsewhere",
      "const extra = { titel: 1 };\nexport default { ...extra };\n",
    ],
    ["a computed key", 'export default { ["titel"]: 1 };\n'],
    [
      "a default export that is not an object literal",
      "const config = { titel: 1 };\nexport default config;\n",
    ],
    ["a syntax error", "export default { titel: 1\n"],
    ["no default export", "export const titel = 1;\n"],
  ])("returns undefined for %s", (_case, source) => {
    const position = findConfigKeyPosition(source, ["titel"]);

    expect(position).toBeUndefined();
  });

  it("returns undefined when a parent key holds no object literal", () => {
    const source = "const nav = { sidebr: 1 };\nexport default { nav };\n";

    const position = findConfigKeyPosition(source, ["nav", "sidebr"]);

    expect(position).toBeUndefined();
  });
});
