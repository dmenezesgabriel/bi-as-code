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
