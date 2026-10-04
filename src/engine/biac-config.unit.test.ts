import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import { loadBiacConfig } from "./biac-config.js";

let projectRoot: string | undefined;

afterEach(() => {
  cleanupProjects();
  projectRoot = undefined;
});

function makeProject(): string {
  projectRoot = makeTempProject("biac-config-");
  return projectRoot;
}

function writeConfig(root: string, source: string): void {
  writeProjectFile(root, "biac.config.ts", source);
}

describe("missing or empty config", () => {
  it("returns defaults when biac.config.ts does not exist", async () => {
    const root = makeProject();

    await expect(loadBiacConfig(root)).resolves.toEqual({
      title: "biac",
      theme: "system",
      nav: { sidebar: true },
    });
  });

  it("returns defaults when the config exports an empty object", async () => {
    const root = makeProject();
    writeConfig(root, "export default {};\n");

    await expect(loadBiacConfig(root)).resolves.toEqual({
      title: "biac",
      theme: "system",
      nav: { sidebar: true },
    });
  });
});

describe("field handling", () => {
  it("reads a project title", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { title: "ACME" };\n');

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      title: "ACME",
    });
  });

  it("reads a theme default", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { theme: "dark" };\n');

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      theme: "dark",
    });
  });

  it("reads nav.sidebar", async () => {
    const root = makeProject();
    writeConfig(root, "export default { nav: { sidebar: false } };\n");

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      nav: { sidebar: false },
    });
  });

  it("keeps defaults for fields the config omits", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { title: "ACME" };\n');

    await expect(loadBiacConfig(root)).resolves.toEqual({
      title: "ACME",
      theme: "system",
      nav: { sidebar: true },
    });
  });
});

describe("validation", () => {
  it("throws naming the value and expected shape for a non-object export", async () => {
    const root = makeProject();
    writeConfig(root, "export default 42;\n");

    await expect(loadBiacConfig(root)).rejects.toThrow(
      /biac\.config\.ts.*expected.*object/i,
    );
  });

  it("throws naming the value and expected shape for a bad title", async () => {
    const root = makeProject();
    writeConfig(root, "export default { title: 42 };\n");

    await expect(loadBiacConfig(root)).rejects.toThrow(
      /title.*expected.*string.*got 42/i,
    );
  });

  it("throws naming the value and expected shape for a bad theme", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { theme: "blue" };\n');

    await expect(loadBiacConfig(root)).rejects.toThrow(
      /theme.*expected.*light.*dark.*system.*got.*blue/i,
    );
  });

  it("throws naming the value and expected shape for a non-object nav", async () => {
    const root = makeProject();
    writeConfig(root, "export default { nav: true };\n");

    await expect(loadBiacConfig(root)).rejects.toThrow(
      /nav.*expected.*object.*got true/i,
    );
  });

  it("throws naming the value and expected shape for a bad sidebar flag", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { nav: { sidebar: "yes" } };\n');

    await expect(loadBiacConfig(root)).rejects.toThrow(
      /sidebar.*expected.*boolean.*got.*yes/i,
    );
  });
});
