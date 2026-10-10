import type { PageCompileError } from "./types.js";

/**
 * Describes whatever a page compile threw as a {@link PageCompileError}:
 * the message, plus the position when the error carries one (the MDX
 * compiler's syntax errors do).
 *
 * @example
 * pageCompileError(new Error("Duplicate sql block name"), "pages/a.md");
 * // → { file: "pages/a.md", message: "Duplicate sql block name" }
 */
export function pageCompileError(
  error: unknown,
  file: string,
): PageCompileError {
  const message = error instanceof Error ? error.message : String(error);
  const position = errorPosition(error);
  return position ? { file, message, ...position } : { file, message };
}

function errorPosition(
  error: unknown,
): { line: number; column: number } | undefined {
  if (!(error instanceof Error)) return;
  const { line, column } = error as { line?: unknown; column?: unknown };
  if (typeof line !== "number" || typeof column !== "number") return;
  return { line, column };
}

/**
 * Source of the module served for a page that failed to compile: the error
 * is its only export, so the SPA can tell it from a compiled page and render
 * the failure where the page would be.
 *
 * @example
 * compileErrorModuleSource({ file: "pages/a.md", message: "Unexpected `<`" });
 * // → 'export const compileError = {"file":"pages/a.md","message":"Unexpected `<`"};\n'
 */
export function compileErrorModuleSource(error: PageCompileError): string {
  return `export const compileError = ${JSON.stringify(error)};\n`;
}
