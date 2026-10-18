import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import { loadBiacConfig } from "./biac-config.js";

afterEach(cleanupProjects);

function projectWithConfig(source: string): string {
  const root = makeTempProject("biac-config-directories-");
  writeProjectFile(root, "biac.config.ts", source);
  return root;
}

describe("directories", () => {
  it("defaults to no folder titles", async () => {
    const root = projectWithConfig("export default {};\n");

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      directories: {},
    });
  });

  it("reads a title per first-level folder of pages/", async () => {
    const root = projectWithConfig(
      'export default { directories: { "pages/nested": { title: "Planning" } } };\n',
    );

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      directories: { "pages/nested": { title: "Planning" } },
    });
  });

  it("throws at its line and column for a non-object directories", async () => {
    const root = projectWithConfig(
      'export default {\n  directories: "pages/nested",\n};\n',
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(
      'Invalid biac.config.ts:2:3 — directories: expected an object mapping "pages/<folder>" to { title }, got "pages/nested"',
    );
  });

  it.each([
    ["a folder below the first level", "pages/a/b"],
    ["a path outside pages/", "nested"],
    ["pages/ itself", "pages/"],
  ])("throws at the key for %s", async (_case, key) => {
    const root = projectWithConfig(
      `export default {\n  directories: {\n    "${key}": { title: "X" },\n  },\n};\n`,
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(
      `Invalid biac.config.ts:3:5 — directories key: expected "pages/<folder>", a first-level folder of pages/, got "${key}"`,
    );
  });

  it("throws naming an unknown key in a folder's settings", async () => {
    const root = projectWithConfig(
      'export default { directories: { "pages/nested": { titel: "X" } } };\n',
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(
      "directories.pages/nested.titel: unknown key, expected one of title (did you mean title?)",
    );
  });

  it.each([
    ["a non-object", '"Planning"', 'an object { title }, got "Planning"'],
    ["a blank title", '{ title: " " }', 'a non-empty string, got " "'],
    ["a non-string title", "{ title: 3 }", "a non-empty string, got 3"],
  ])("throws naming the value for %s", async (_case, value, expected) => {
    const root = projectWithConfig(
      `export default { directories: { "pages/nested": ${value} } };\n`,
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(`expected ${expected}`);
  });
});
