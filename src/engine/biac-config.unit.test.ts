import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import { loadBiacConfig } from "./biac-config.js";
import { DEFAULT_INTERPRETERS } from "./data-loader-interpreters.js";

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
      sqlTables: {},
      interpreters: DEFAULT_INTERPRETERS,
    });
  });

  it("returns defaults when the config exports an empty object", async () => {
    const root = makeProject();
    writeConfig(root, "export default {};\n");

    await expect(loadBiacConfig(root)).resolves.toEqual({
      title: "biac",
      theme: "system",
      nav: { sidebar: true },
      sqlTables: {},
      interpreters: DEFAULT_INTERPRETERS,
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
      sqlTables: {},
      interpreters: DEFAULT_INTERPRETERS,
    });
  });

  it("reads project sql tables", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'export default { sql: { orders: "data/orders.parquet" } };\n',
    );

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      sqlTables: { orders: "data/orders.parquet" },
    });
  });
});

describe("interpreters", () => {
  it("adds a loader language", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'export default { interpreters: { ".pl": ["perl"] } };\n',
    );

    const { interpreters } = await loadBiacConfig(root);

    expect(interpreters).toEqual({ ...DEFAULT_INTERPRETERS, ".pl": ["perl"] });
  });

  it("disables a default language with null", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { interpreters: { ".py": null } };\n');

    const { interpreters } = await loadBiacConfig(root);

    expect(interpreters).not.toHaveProperty(".py");
    expect(interpreters[".sh"]).toEqual(["sh"]);
  });

  it("replaces a default language's argv", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { interpreters: { ".ts": ["tsx"] } };\n');

    const { interpreters } = await loadBiacConfig(root);

    expect(interpreters[".ts"]).toEqual(["tsx"]);
  });

  it("accepts an empty argv, which runs the loader file itself", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { interpreters: { ".bin": [] } };\n');

    const { interpreters } = await loadBiacConfig(root);

    expect(interpreters[".bin"]).toEqual([]);
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

  it("throws naming the value and expected shape for a non-mapping sql", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { sql: "data/orders.csv" };\n');

    await expect(loadBiacConfig(root)).rejects.toThrow(
      /biac\.config\.ts.*sql.*expected a mapping.*got "data\/orders\.csv"/i,
    );
  });

  it("throws for a sql source that is not a string path", async () => {
    const root = makeProject();
    writeConfig(root, "export default { sql: { orders: 42 } };\n");

    await expect(loadBiacConfig(root)).rejects.toThrow(
      /sql\.orders: expected a string path.*got 42/,
    );
  });

  it("throws for a sql source outside data/", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'export default { sql: { orders: "pages/orders.csv" } };\n',
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(
      /sql\.orders: expected a "data\/…" path/,
    );
  });

  it("throws for an empty sql table name", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { sql: { "": "data/orders.csv" } };\n');

    await expect(loadBiacConfig(root)).rejects.toThrow(
      /sql: expected a non-empty table name.*got ""/,
    );
  });

  it.each([
    [
      "a non-object interpreters",
      '[".py"]',
      'interpreters: expected an object mapping ".ext" to an argv string[] or null, got [".py"]',
    ],
    [
      "a key without a leading dot",
      '{ py: ["python3"] }',
      'interpreters key: expected an extension starting with ".", got "py"',
    ],
    [
      "an argv that is not an array",
      '{ ".py": "python3" }',
      'interpreters[".py"]: expected an array of strings or null, got "python3"',
    ],
    [
      "an argv entry that is not a string",
      '{ ".py": ["python3", 3] }',
      'interpreters[".py"]: expected an array of strings or null, got ["python3",3]',
    ],
  ])(
    "throws naming the value and expected shape for %s",
    async (_case, interpreters, message) => {
      const root = makeProject();
      writeConfig(root, `export default { interpreters: ${interpreters} };\n`);

      await expect(loadBiacConfig(root)).rejects.toThrow(message);
    },
  );
});

describe("unknown keys", () => {
  const ACCEPTED = "expected one of title, theme, nav, sql, interpreters";

  it.each([
    ["no close key", "pagewidth", `pagewidth: unknown key, ${ACCEPTED}`],
    [
      "a misspelling",
      "titel",
      `titel: unknown key, ${ACCEPTED} (did you mean title?)`,
    ],
    [
      "a case difference",
      "Title",
      `Title: unknown key, ${ACCEPTED} (did you mean title?)`,
    ],
  ])("throws naming a top-level key with %s", async (_case, key, message) => {
    const root = makeProject();
    writeConfig(root, `export default { ${key}: "full" };\n`);

    await expect(loadBiacConfig(root)).rejects.toThrow(
      `Invalid biac.config.ts — ${message}`,
    );
  });

  it("throws naming an unknown nav key by its dotted path", async () => {
    const root = makeProject();
    writeConfig(root, "export default { nav: { sidebr: false } };\n");

    await expect(loadBiacConfig(root)).rejects.toThrow(
      "Invalid biac.config.ts — nav.sidebr: unknown key, expected one of sidebar (did you mean sidebar?)",
    );
  });

  it("accepts any table name under sql and any extension under interpreters", async () => {
    const root = makeProject();
    writeProjectFile(root, "data/channels.csv", "channel\nweb\n");
    writeConfig(
      root,
      'export default { sql: { anything: "data/channels.csv" }, interpreters: { ".pl": ["perl"] } };\n',
    );

    const config = await loadBiacConfig(root);

    expect(Object.keys(config.sqlTables)).toEqual(["anything"]);
    expect(config.interpreters[".pl"]).toEqual(["perl"]);
  });
});
