import { readFileSync, statSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { assertBootAllowed, parseServeArgs } from "@/cli/commands/serve.js";
import { loadBiacConfig } from "@/engine/biac-config.js";
import { dataCorsHeaders } from "@/engine/data-cors.js";
import { frameAncestorsHeaders } from "@/engine/frame-ancestors.js";
import { widgetExports } from "@/engine/widget-exports.js";
import {
  listenPagesServer,
  makePagesServer,
} from "../lib/pages-vite-server.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

/** A Ship guide's Markdown, read when a test asks so a missing page fails only its own tests. */
function readShipPage(file: string): string {
  return readFileSync(
    new URL(`../../docs/pages/ship/${file}`, import.meta.url),
    "utf-8",
  );
}

const PAGE = readShipPage("build-preview-serve.md");

/** The `| \`command\` | \`--flag\` | \`default\` |` rows of the page's options table. */
function optionRows(): { command: string; flag: string; fallback: string }[] {
  return PAGE.split("\n").flatMap((line) => {
    const [, command, flag, fallback] = line.split("|").map((c) => c.trim());
    if (!command?.startsWith("`") || !flag?.startsWith("`--")) return [];
    return [
      {
        command: command.replaceAll("`", ""),
        flag: flag.replaceAll("`", ""),
        fallback: fallback?.match(/^`([^`]+)`/)?.[1] ?? "",
      },
    ];
  });
}

describe("the Build, preview and serve guide", () => {
  it("states the defaults `biac serve` really starts with", () => {
    // Arrange
    const documented = Object.fromEntries(
      optionRows()
        .filter(({ command }) => command === "serve")
        .map(({ flag, fallback }) => [flag, fallback]),
    );

    // Act
    const { host, port } = parseServeArgs([]);

    // Assert — a drifted default would send a reader to the wrong address.
    expect(documented).toEqual({ "--host": host, "--port": String(port) });
  });

  it("names every variable the refusal to start beyond localhost names", () => {
    // Arrange
    let refusal = "";

    // Act
    try {
      assertBootAllowed("0.0.0.0", {});
    } catch (error) {
      refusal = (error as Error).message;
    }

    // Assert — the page must be the place a reader looks up what the message says.
    const variables = refusal.match(/BIAC_[A-Z_]+/g) ?? [];
    expect(variables).toHaveLength(3);
    for (const variable of variables) expect(PAGE).toContain(variable);
  });
});

/** The bodies of a page's fenced blocks tagged `lang`, in order. */
function fencesOf(page: string, lang: string): string[] {
  const fence = new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "g");
  return [...page.matchAll(fence)].map((match) => match[1] ?? "");
}

describe("the Serve under a path prefix guide", () => {
  afterEach(cleanupProjects);

  it("shows only configs biac loads, each with the base it reads", async () => {
    // Arrange
    const configs = fencesOf(readShipPage("base-path.md"), "ts");
    expect(configs.length).toBeGreaterThan(0);

    for (const source of configs) {
      const root = makeTempProject("biac-docs-base-");
      writeProjectFile(root, "biac.config.ts", source);

      // Act
      const { base } = await loadBiacConfig(root);

      // Assert — a documented key that stopped loading would send a reader to an error.
      expect(base).toMatch(/^\/.*\/$/);
    }
  });

  it("quotes the refusal biac prints for a base without a leading slash", async () => {
    // Arrange
    const root = makeTempProject("biac-docs-base-");
    writeProjectFile(
      root,
      "biac.config.ts",
      'export default { base: "docs" };\n',
    );
    let refusal = "";

    // Act
    try {
      await loadBiacConfig(root);
    } catch (error) {
      refusal = (error as Error).message;
    }

    // Assert — the page is where a reader looks up what the message says.
    expect(refusal).toContain("base: expected a path starting with");
    expect(fencesOf(readShipPage("base-path.md"), "text")).toContain(
      `${refusal}\n`,
    );
  });
});

/** The Dockerfile's `USER` uid and `EXPOSE` port, the two facts a task definition must repeat. */
function dockerfileRuntime(): { user: string; port: number } {
  const source = readFileSync(
    new URL("../../Dockerfile", import.meta.url),
    "utf-8",
  );
  const user = source.match(/^USER (\d+)$/m)?.[1] ?? "";
  const port = Number(source.match(/^EXPOSE (\d+)$/m)?.[1]);
  return { user, port };
}

describe("the Deploy on AWS guide", () => {
  it("shows a task definition that repeats the user and port the image runs with", () => {
    // Arrange
    const [json] = fencesOf(readShipPage("deploy-on-aws.md"), "json");
    expect(json).toBeDefined();

    // Act
    const container = JSON.parse(json ?? "") as {
      user: string;
      portMappings: { containerPort: number }[];
    };

    // Assert — a drifted uid or port would deploy a task the image does not match.
    const { user, port } = dockerfileRuntime();
    expect(container.user).toBe(user);
    expect(container.portMappings[0]?.containerPort).toBe(port);
  });

  it("names every variable the refusal to start beyond localhost names", () => {
    // Arrange
    let refusal = "";

    // Act
    try {
      assertBootAllowed("0.0.0.0", {});
    } catch (error) {
      refusal = (error as Error).message;
    }

    // Assert — the guide is where a reader looks up what the message says.
    const variables = refusal.match(/BIAC_[A-Z_]+/g) ?? [];
    expect(variables).toHaveLength(3);
    for (const variable of variables)
      expect(readShipPage("deploy-on-aws.md")).toContain(variable);
  });
});

/** The `key = value` lines of an oauth2-proxy config, comments and blanks dropped. */
function settingLines(source: string): string[] {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

function readExampleFile(file: string): string {
  return readFileSync(
    new URL(`../../examples/s3-sso/${file}`, import.meta.url),
    "utf-8",
  );
}

describe("the SSO behind a proxy guide", () => {
  const PAGE_FILE = "sso-behind-a-proxy.md";

  it("shows a local gate config whose every setting is in the example's oauth2-proxy.cfg", () => {
    // Arrange
    const local = fencesOf(readShipPage(PAGE_FILE), "ini").find((fence) =>
      fence.startsWith("# Local"),
    );
    expect(local).toBeDefined();

    // Act
    const shipped = settingLines(readExampleFile("oauth2-proxy.cfg"));

    // Assert — a drifted key would send a reader to a gate that does not start.
    for (const line of settingLines(local ?? ""))
      expect(shipped).toContain(line);
  });

  it("lists in its services table exactly the services compose.yaml defines", () => {
    // Arrange
    const lines = readShipPage(PAGE_FILE).split("\n");
    const header = lines.findIndex((line) => line.startsWith("| Service"));
    expect(header).toBeGreaterThan(-1);
    const afterHeader = lines.slice(header + 2);
    const tableEnd = afterHeader.findIndex((line) => !line.startsWith("|"));
    const documented = afterHeader
      .slice(0, tableEnd)
      .flatMap((line) => line.match(/^\| `([a-z0-9-]+)`\s+\|/)?.[1] ?? []);

    // Act
    const defined = [
      ...readExampleFile("compose.yaml").matchAll(/^ {2}([a-z0-9-]+):$/gm),
    ]
      .map((match) => match[1] ?? "")
      .filter((name) => name !== "credentials");

    // Assert — a service missing from the table is a container a reader cannot explain.
    expect(documented.sort()).toEqual(defined.sort());
  });

  it("tells the reader to run a package script that exists", () => {
    // Arrange
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
    ) as { scripts: Record<string, string> };

    // Act
    const named = readShipPage(PAGE_FILE).match(
      /pnpm -s (example:[\w:-]+)/,
    )?.[1];

    // Assert
    expect(named).toBeDefined();
    expect(manifest.scripts).toHaveProperty(named ?? "");
  });
});

const EMBEDS_PAGE = "embeds.md";

/** The `Name: value` lines of a page's `http` fences. */
function headerLines(page: string): string[] {
  return fencesOf(page, "http")
    .flatMap((body) => body.split("\n"))
    .filter((line) => line.includes(": "));
}

/** The first four-backtick `md` fence: a whole page, whose own fences are three-backtick. */
function pageExample(page: string): string {
  return page.match(/````md\n([\s\S]*?)````/)?.[1] ?? "";
}

/** A project holding `pageSource` as its only page, over a one-row `data/orders.csv`. */
function projectWithPage(pageSource: string): string {
  const root = makeTempProject("biac-docs-embeds-");
  writeProjectFile(root, "pages/revenue.md", pageSource);
  writeProjectFile(root, "data/orders.csv", "region,amount\neast,1\n");
  return root;
}

async function exportFailure(pageSource: string): Promise<string> {
  try {
    await widgetExports(projectWithPage(pageSource));
  } catch (error) {
    return (error as Error).message;
  }
  return "";
}

describe("the Embeds guide", () => {
  afterEach(cleanupProjects);

  it("shows an embed config biac loads, and the headers biac sends for its origins", async () => {
    // Arrange
    const source = fencesOf(readShipPage(EMBEDS_PAGE), "ts").find((fence) =>
      fence.includes("embed"),
    );
    const root = makeTempProject("biac-docs-embeds-");
    writeProjectFile(root, "biac.config.ts", source ?? "");

    // Act
    const { embed } = await loadBiacConfig(root);

    // Assert — the page is where a reader copies the headers a static host must send.
    const sent = {
      ...frameAncestorsHeaders(embed.origins),
      ...dataCorsHeaders(embed.dataOrigins, embed.dataOrigins[0]),
    };
    expect(embed.origins.length).toBeGreaterThan(0);
    expect(embed.dataOrigins.length).toBeGreaterThan(0);
    for (const [name, value] of Object.entries(sent))
      expect(headerLines(readShipPage(EMBEDS_PAGE))).toContain(
        `${name}: ${value}`,
      );
  });

  it("builds the module the page imports from the export the page shows", async () => {
    // Arrange
    const page = readShipPage(EMBEDS_PAGE);
    const named = page.match(/widgets\/([a-z0-9-]+)\.js/)?.[1];

    // Act
    const modules = await widgetExports(projectWithPage(pageExample(page)));

    // Assert — a renamed export moves the URL every host page imports.
    expect(named).toBeDefined();
    expect(modules.map((module) => module.name)).toEqual([named]);
  });

  it("quotes the refusals the build prints for a name that is not kebab-case and for a select", async () => {
    // Arrange
    const page = readShipPage(EMBEDS_PAGE);
    const example = pageExample(page);
    const named = example.match(/export="([^"]+)"/)?.[1] ?? "";
    const badName = example.replace(`export="${named}"`, 'export="Revenue"');
    const selecting = example.replace(
      `export="${named}"`,
      `export="${named}" select="region"`,
    );

    // Act
    const refusals = [
      await exportFailure(badName),
      await exportFailure(selecting),
    ];

    // Assert — the page is where a reader looks up what the message says; the build adds the position in front.
    const quoted = fencesOf(page, "text").join("\n");
    for (const refusal of refusals) {
      expect(refusal).not.toBe("");
      expect(quoted).toContain(`: ${refusal}\n`);
    }
  });
});

const EDITOR_PAGE = "page-editor.md";
const PNG_SIGNATURE = "89504e470d0a1a0a";
// A screenshot is the one binary a docs page commits; the cap keeps a clone small.
const MAX_SCREENSHOT_BYTES = 300_000;

describe("the Page editor guide", () => {
  afterEach(cleanupProjects);

  it("shows only screenshots that are committed PNG files of a modest size", () => {
    // Arrange
    const page = readShipPage(EDITOR_PAGE);
    const shown = [...page.matchAll(/\]\(\/data\/([^)]+)\)/g)].map(
      (match) => match[1] ?? "",
    );

    // Act
    const files = shown.map((name) => {
      const path = new URL(`../../docs/data/${name}`, import.meta.url);
      return {
        name,
        signature: readFileSync(path).subarray(0, 8).toString("hex"),
        bytes: statSync(path).size,
      };
    });

    // Assert — biac builds a page whose image file is missing (backlog Known debt).
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const { name, signature, bytes } of files) {
      expect({ name, signature }).toEqual({ name, signature: PNG_SIGNATURE });
      expect(bytes).toBeLessThan(MAX_SCREENSHOT_BYTES);
    }
  });

  it("lists the HTTP statuses the page-source endpoint really answers a failed save with", async () => {
    // Arrange
    const documented = [
      ...readShipPage(EDITOR_PAGE).matchAll(/^\| `HTTP (\d{3})`/gm),
    ].map((match) => Number(match[1]));
    const root = makeTempProject("biac-docs-editor-");
    writeProjectFile(root, "pages/weekly.md", "# Weekly\n");
    const dev = await makePagesServer(root);
    const listener = await listenPagesServer(dev);
    const save = (page: string, source: string, origin?: string) =>
      fetch(`${listener.url}/__biac/page-source/${page}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify({ source }),
      });

    // Act
    const answered = [
      (await save("gone.md", "# x\n")).status,
      (await save("weekly.md", "# x\n", "http://localhost:1")).status,
      (await save("weekly.md", "x".repeat(1024 * 1024 + 1))).status,
    ];
    await listener.close();
    await dev.close();

    // Assert — a reader matches the status line to this table.
    expect(answered).toEqual([404, 403, 413]);
    expect([...documented].sort()).toEqual([...answered].sort());
  });
});
