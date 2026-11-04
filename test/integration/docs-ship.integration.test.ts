import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertBootAllowed, parseServeArgs } from "@/cli/commands/serve.js";

const PAGE = readFileSync(
  new URL("../../docs/pages/ship/build-preview-serve.md", import.meta.url),
  "utf-8",
);

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
