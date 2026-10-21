import { join } from "node:path";
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
      layout: {
        page_width: "article",
        cards: false,
        table_of_contents: true,
        table_of_contents_label: "On this page",
      },
      directories: {},
      brand: { colors: {}, palette: {}, scale: {}, fonts: {} },
      embed: { origins: [] },
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
      layout: {
        page_width: "article",
        cards: false,
        table_of_contents: true,
        table_of_contents_label: "On this page",
      },
      directories: {},
      brand: { colors: {}, palette: {}, scale: {}, fonts: {} },
      embed: { origins: [] },
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
      layout: {
        page_width: "article",
        cards: false,
        table_of_contents: true,
        table_of_contents_label: "On this page",
      },
      directories: {},
      brand: { colors: {}, palette: {}, scale: {}, fonts: {} },
      embed: { origins: [] },
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

  it("reads layout.page_width", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { layout: { page_width: "full" } };\n');

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      layout: { page_width: "full" },
    });
  });

  it("keeps the article width for a layout block without page_width", async () => {
    const root = makeProject();
    writeConfig(root, "export default { layout: {} };\n");

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      layout: {
        page_width: "article",
        cards: false,
        table_of_contents: true,
        table_of_contents_label: "On this page",
      },
    });
  });

  it("reads layout.cards", async () => {
    const root = makeProject();
    writeConfig(root, "export default { layout: { cards: true } };\n");

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      layout: { page_width: "article", cards: true },
    });
  });

  it("reads layout.table_of_contents", async () => {
    const root = makeProject();
    writeConfig(
      root,
      "export default { layout: { table_of_contents: false } };\n",
    );

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      layout: { page_width: "article", cards: false, table_of_contents: false },
    });
  });

  it("reads layout.table_of_contents_label", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'export default { layout: { table_of_contents_label: "Contents" } };\n',
    );

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      layout: { table_of_contents_label: "Contents" },
    });
  });
});

describe("brand", () => {
  it("reads brand colours, lower-cased", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'export default { brand: { colors: { primary: { light: "#154886", dark: "#60A5FA" } } } };\n',
    );

    const config = await loadBiacConfig(root);

    expect(config.brand).toEqual({
      colors: { primary: { light: "#154886", dark: "#60a5fa" } },
      palette: {},
      scale: {},
      fonts: {},
    });
  });

  it("reads a brand palette", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'export default { brand: { palette: { light: ["#1E40AF"], dark: ["#60a5fa"] } } };\n',
    );

    const config = await loadBiacConfig(root);

    expect(config.brand.palette).toEqual({
      light: ["#1e40af"],
      dark: ["#60a5fa"],
    });
  });

  it("reads a brand scale", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'export default { brand: { scale: { light: ["#1E40AF"], dark: ["#0a0a0a", "#60a5fa"] } } };\n',
    );

    const config = await loadBiacConfig(root);

    expect(config.brand.scale).toEqual({
      light: ["#1e40af"],
      dark: ["#0a0a0a", "#60a5fa"],
    });
  });

  it("throws at the entry's line and column for a scale colour that is not hex", async () => {
    const root = makeProject();
    writeConfig(
      root,
      [
        "export default {",
        "  brand: {",
        '    scale: { light: ["#1e40af", "navy"] },',
        "  },",
        "};",
        "",
      ].join("\n"),
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(
      'Invalid biac.config.ts:3:33 — brand.scale.light[1]: expected a "#rrggbb" colour, got "navy"',
    );
  });

  it("throws at the entry's line and column for a palette colour under its contrast floor", async () => {
    const root = makeProject();
    writeConfig(
      root,
      [
        "export default {",
        "  brand: {",
        '    palette: { light: ["#1e40af", "#45a1bf"], dark: ["#60a5fa"] },',
        "  },",
        "};",
        "",
      ].join("\n"),
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(
      "Invalid biac.config.ts:3:35 — brand.palette.light[1]: #45a1bf against --background #ffffff measures 2.95:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.palette.light[1]",
    );
  });

  it("throws at the colour's line and column for a colour under its contrast floor", async () => {
    const root = makeProject();
    writeConfig(
      root,
      [
        "export default {",
        "  brand: {",
        "    colors: {",
        '      background: { light: "#fdf6e3", dark: "#0a0a0a" },',
        "    },",
        "  },",
        "};",
        "",
      ].join("\n"),
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(
      "Invalid biac.config.ts:4:21 — brand.colors.background.light: #fdf6e3 against --chart-4 #cc79a7 measures 2.83:1, expected at least 3:1 (WCAG 2.2 SC 1.4.11) — change brand.colors.background.light",
    );
  });
});

describe("embed", () => {
  it("reads the origins allowed to frame the site", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'export default { embed: { origins: ["http://localhost:8901"] } };\n',
    );

    await expect(loadBiacConfig(root)).resolves.toMatchObject({
      embed: { origins: ["http://localhost:8901"] },
    });
  });

  it("throws at the entry's line and column for an origin with a path", async () => {
    const root = makeProject();
    writeConfig(
      root,
      [
        "export default {",
        '  embed: { origins: ["https://example.com/path"] },',
        "};",
        "",
      ].join("\n"),
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(
      'Invalid biac.config.ts:2:22 — embed.origins[0]: expected an origin "scheme://host[:port]" (http or https, no path, no wildcard), got "https://example.com/path"',
    );
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

  it("throws naming the value and expected shape for a non-object layout", async () => {
    const root = makeProject();
    writeConfig(root, 'export default { layout: "full" };\n');

    await expect(loadBiacConfig(root)).rejects.toThrow(
      /layout: expected an object with optional page_width, cards, table_of_contents, table_of_contents_label, got "full"/,
    );
  });

  it("throws at its line and column for a page_width that is not article or full", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'export default {\n  layout: {\n    page_width: "wide",\n  },\n};\n',
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(
      'Invalid biac.config.ts:3:5 — layout.page_width: expected "article" | "full", got "wide"',
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

describe("error position", () => {
  it("locates a bad value at its key's line and column", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'export default {\n  title: "ACME",\n  theme: "blue",\n};\n',
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(
      /^Invalid biac\.config\.ts:3:3 — theme: expected/,
    );
  });

  it("locates a non-object default export at the exported value", async () => {
    const root = makeProject();
    writeConfig(root, "export default 42;\n");

    await expect(loadBiacConfig(root)).rejects.toThrow(
      "Invalid biac.config.ts:1:16 — default export: expected an object",
    );
  });

  it("locates a bad interpreter argv at its extension key", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'export default {\n  interpreters: {\n    ".py": "python3",\n  },\n};\n',
    );

    await expect(loadBiacConfig(root)).rejects.toThrow(
      'Invalid biac.config.ts:3:5 — interpreters[".py"]: expected',
    );
  });

  it("gives vite the file as id and the key as loc", async () => {
    const root = makeProject();
    writeConfig(root, 'export default {\n  pagewidth: "full",\n};\n');
    const file = join(root, "biac.config.ts");

    const error = await loadBiacConfig(root).catch((thrown: unknown) => thrown);

    expect(error).toMatchObject({
      id: file,
      loc: { file, line: 2, column: 3 },
    });
  });

  it("names the key path alone when the key is spread in", async () => {
    const root = makeProject();
    writeConfig(
      root,
      'const extra = { titel: "ACME" };\nexport default { ...extra };\n',
    );
    const file = join(root, "biac.config.ts");

    const error = await loadBiacConfig(root).catch((thrown: unknown) => thrown);

    expect(error).toMatchObject({
      id: file,
      message: expect.stringMatching(
        /^Invalid biac\.config\.ts — titel: unknown key/,
      ),
    });
    expect(error).not.toHaveProperty("loc");
  });
});

describe("unknown keys", () => {
  const ACCEPTED =
    "expected one of title, theme, nav, sql, interpreters, layout, directories, brand, embed";

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
      `Invalid biac.config.ts:1:18 — ${message}`,
    );
  });

  it.each([
    [
      "an unknown nav key by its dotted path",
      "export default { nav: { sidebr: false } };\n",
      "Invalid biac.config.ts:1:25 — nav.sidebr: unknown key, expected one of sidebar (did you mean sidebar?)",
    ],
    [
      "an unknown layout key by its dotted path",
      'export default { layout: { pagewidth: "full" } };\n',
      "Invalid biac.config.ts:1:28 — layout.pagewidth: unknown key, expected one of page_width, cards, table_of_contents, table_of_contents_label (did you mean page_width?)",
    ],
    [
      "a misspelt layout key with the closest, cards",
      "export default { layout: { cardz: true } };\n",
      "Invalid biac.config.ts:1:28 — layout.cardz: unknown key, expected one of page_width, cards, table_of_contents, table_of_contents_label (did you mean cards?)",
    ],
    [
      "a non-boolean layout.cards at its line and column",
      'export default {\n  layout: { cards: "yes" },\n};\n',
      'Invalid biac.config.ts:2:13 — layout.cards: expected a boolean, got "yes"',
    ],
    [
      "a non-boolean layout.table_of_contents at its line and column",
      'export default {\n  layout: { table_of_contents: "no" },\n};\n',
      'Invalid biac.config.ts:2:13 — layout.table_of_contents: expected a boolean, got "no"',
    ],
    [
      "an empty layout.table_of_contents_label at its line and column",
      'export default {\n  layout: { table_of_contents_label: "" },\n};\n',
      'Invalid biac.config.ts:2:13 — layout.table_of_contents_label: expected a non-empty string, got ""',
    ],
    [
      "a non-string layout.table_of_contents_label",
      "export default { layout: { table_of_contents_label: 3 } };\n",
      "Invalid biac.config.ts:1:28 — layout.table_of_contents_label: expected a non-empty string, got 3",
    ],
  ])("throws naming %s", async (_case, source, message) => {
    const root = makeProject();
    writeConfig(root, source);

    await expect(loadBiacConfig(root)).rejects.toThrow(message);
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
