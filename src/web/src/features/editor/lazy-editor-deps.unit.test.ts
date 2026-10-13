// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSync } from "vite";
import viteConfig from "../../../vite.config";

// The module `editable-page.tsx` loads through its lazy `import()` — every
// editor file it reaches ships in the lazily loaded chunk.
const LAZY_ENTRY = path.join(import.meta.dirname, "page-editor.tsx");

/** Specifiers a module imports at runtime — `import type` and all-`type` clauses dropped. */
function runtimeSpecifiers(fileName: string, source: string): string[] {
  const { staticImports } = parseSync(fileName, source).module;
  return staticImports
    .filter(({ entries }) => !entries.length || entries.some((e) => !e.isType))
    .map(({ moduleRequest }) => moduleRequest.value);
}

function isBareSpecifier(specifier: string): boolean {
  return !/^(\.|\/|@\/)/.test(specifier);
}

/** Resolves a relative import to a file in the entry's directory, or null when it leaves it. */
function resolveSibling(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith("./")) return null;
  const base = path.join(path.dirname(fromFile), specifier);
  return [".ts", ".tsx"].map((ext) => base + ext).find(existsSync) ?? null;
}

/**
 * Walks the relative imports from `entry` that stay in its directory and
 * maps each reached file to its runtime specifiers.
 */
function lazyModuleImports(entry: string): Map<string, string[]> {
  const reached = new Map<string, string[]>();
  const queue = [entry];
  for (let file = queue.shift(); file; file = queue.shift()) {
    if (reached.has(file)) continue;
    const specifiers = runtimeSpecifiers(file, readFileSync(file, "utf8"));
    reached.set(file, specifiers);
    queue.push(...specifiers.flatMap((s) => resolveSibling(file, s) ?? []));
  }
  return reached;
}

describe("runtimeSpecifiers", () => {
  it("keeps value and side-effect imports and drops type-only ones", () => {
    // Arrange
    const source = [
      'import { a, type B } from "kept";',
      'import type { C } from "type-only";',
      'import { type D } from "all-type";',
      'import "side-effect";',
    ].join("\n");

    // Act
    const specifiers = runtimeSpecifiers("module.ts", source);

    // Assert
    expect(specifiers).toEqual(["kept", "side-effect"]);
  });
});

describe("lazyModuleImports", () => {
  it("reaches the editor's own modules and no test helper", () => {
    // Act
    const files = [...lazyModuleImports(LAZY_ENTRY).keys()].map((f) =>
      path.basename(f),
    );

    // Assert
    expect(files).toContain("code-editor.tsx");
    expect(files).toContain("save-keymap.ts");
    expect(files).not.toContain("editor-test-view.ts");
  });
});

describe("vite optimizeDeps.include", () => {
  it("pre-bundles every bare specifier the lazily loaded editor imports", () => {
    // Arrange
    const included = new Set(viteConfig.optimizeDeps?.include ?? []);

    // Act
    const missing = [...lazyModuleImports(LAZY_ENTRY)].flatMap(
      ([file, specifiers]) =>
        specifiers
          .filter((s) => isBareSpecifier(s) && !included.has(s))
          .map((s) => `${s} ← ${path.basename(file)}`),
    );

    // Assert
    expect(
      missing,
      "add these to optimizeDeps.include in src/web/vite.config.ts",
    ).toEqual([]);
  });
});
