// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STORYBOOK_PREBUNDLED_DEPS } from "./prebundled-deps";

const SOURCE_ROOT = path.join(import.meta.dirname, "../src");

/**
 * Packages Vite finds only when the first story that imports them loads, then
 * re-optimizes mid-run: `@base-ui/react` and `echarts` ship one entry per
 * component or module, and the rest are shared by many stories.
 */
const LATE_DISCOVERED_IMPORT =
  /from\s+["'](@base-ui\/react\/[\w-]+|echarts\/[\w-]+|shiki|effect|lucide-react)["']/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    const isSource = /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name);
    return isSource ? [file] : [];
  });
}

function importedLateDiscoveredDeps(): string[] {
  const specifiers = sourceFiles(SOURCE_ROOT).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(LATE_DISCOVERED_IMPORT)].map(
      (match) => match[1]!,
    ),
  );
  return [...new Set(specifiers)].sort();
}

describe("importedLateDiscoveredDeps", () => {
  it("finds the component and chart entries the app imports", () => {
    // Act
    const found = importedLateDiscoveredDeps();

    // Assert
    expect(found).toContain("@base-ui/react/tabs");
    expect(found).toContain("echarts/core");
    expect(found).toContain("shiki");
  });
});

describe("STORYBOOK_PREBUNDLED_DEPS", () => {
  it("pre-bundles every late-discovered package the app and its stories import", () => {
    // Arrange
    const imported = importedLateDiscoveredDeps();

    // Assert
    expect(STORYBOOK_PREBUNDLED_DEPS).toEqual(expect.arrayContaining(imported));
  });

  it("lists each package once", () => {
    expect(new Set(STORYBOOK_PREBUNDLED_DEPS).size).toBe(
      STORYBOOK_PREBUNDLED_DEPS.length,
    );
  });
});
