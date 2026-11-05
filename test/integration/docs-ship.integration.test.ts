import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { assertBootAllowed, parseServeArgs } from "@/cli/commands/serve.js";
import { loadBiacConfig } from "@/engine/biac-config.js";
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
