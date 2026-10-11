import { readFileSync } from "node:fs";
import { VFile } from "vfile";
import { matter } from "vfile-matter";
import type { PageFrontmatter } from "./types.js";

/**
 * Reads a page's YAML front-matter from disk without compiling the page —
 * the manifest builder's view of the page. `displayPath` (the
 * project-relative `pages/...` path) names the file in errors so discovery
 * failures read like compile failures. A file with no front-matter yields
 * `{}`; malformed YAML throws naming the file, line and column.
 *
 * @example
 * readPageFrontmatter("/site/pages/a.md", "pages/a.md");
 * // → { title: "A", sidebar_position: 1 }
 */
export function readPageFrontmatter(
  absolutePath: string,
  displayPath: string,
): PageFrontmatter {
  const file = new VFile({
    path: displayPath,
    value: readFileSync(absolutePath, "utf-8"),
  });
  try {
    parseFrontmatterBlock(file);
  } catch (error) {
    throw new Error(
      `Invalid front-matter in ${frontmatterErrorText(error, displayPath)}`,
    );
  }
  return pageFrontmatter(file);
}

function frontmatterErrorText(error: unknown, displayPath: string): string {
  if (error instanceof FrontmatterSyntaxError) {
    return `${displayPath}:${error.line}:${error.column}: ${error.message}`;
  }
  return `${displayPath}: ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * A YAML syntax error in a page's front-matter, positioned in the page file
 * rather than in the YAML block, so it reads like a page-body compile error.
 */
class FrontmatterSyntaxError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly column: number,
  ) {
    super(message);
    this.name = "FrontmatterSyntaxError";
  }
}

/**
 * Splits and parses a page's YAML front-matter into `file.data.matter`
 * (vfile-matter's `matter`), rethrowing a YAML syntax error as a
 * {@link FrontmatterSyntaxError} at its line and column in the file.
 *
 * @example
 * parseFrontmatterBlock(new VFile("---\ntitle: a: b\n---\n"));
 * // throws FrontmatterSyntaxError { line: 2, column: 8 }
 */
export function parseFrontmatterBlock(
  file: VFile,
  options?: { strip?: boolean },
): void {
  try {
    matter(file, options);
  } catch (error) {
    throw fileTrueSyntaxError(error);
  }
}

// yaml's YAMLParseError (vfile-matter's parser) carries `linePos`, 1-based
// and counted from the start of the YAML block. vfile-matter matches the
// opening fence with `^---(?:\r?\n|\r)`, so the block starts on file line 2.
function fileTrueSyntaxError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  const { linePos } = error as {
    linePos?: [{ line?: unknown; col?: unknown }];
  };
  const start = linePos?.[0];
  if (typeof start?.line !== "number" || typeof start.col !== "number") {
    return error;
  }
  // The block-relative " at line N, column M" would contradict the file
  // position; the snippet and caret after it hold for the file too.
  const message = error.message.replace(/ at line \d+, column \d+(?=:)/, "");
  return new FrontmatterSyntaxError(message, start.line + 1, start.col);
}

/**
 * Validates a VFile's parsed `data.matter` is a YAML mapping — front-matter
 * written as a scalar or array is an author error worth failing loudly on.
 *
 * @example
 * matter(vfile, { strip: true });
 * const fm = pageFrontmatter(vfile); // throws if fm was `- a\n- b`
 */
export function pageFrontmatter(file: VFile): PageFrontmatter {
  const parsed: unknown = file.data.matter;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `Invalid front-matter in ${file.path}: expected a YAML mapping, got ${
        Array.isArray(parsed) ? "an array" : typeof parsed
      }`,
    );
  }
  return parsed as PageFrontmatter;
}
