import { basename } from "node:path";
import { readFileSync } from "node:fs";
import { closestKey } from "./closest-key.js";
import { findConfigKeyPosition } from "./config-key-position.js";

/** A bad `biac.config.ts` field, before its position in the file is known. */
export class ConfigFieldError extends Error {
  constructor(
    readonly keyPath: readonly string[],
    detail: string,
  ) {
    super(detail);
  }
}

/**
 * Names a field whose value has the wrong shape, with the offending value.
 *
 * @example
 * invalid("theme", ["theme"], '"light" | "dark"', "blue").message;
 * // 'theme: expected "light" | "dark", got "blue"'
 */
export function invalid(
  field: string,
  keyPath: readonly string[],
  expected: string,
  value: unknown,
): ConfigFieldError {
  return new ConfigFieldError(
    keyPath,
    `${field}: expected ${expected}, got ${JSON.stringify(value)}`,
  );
}

/**
 * Names an unknown key by its dotted path, every accepted key in declaration
 * order, and the closest one when there is a close one.
 *
 * @example
 * unknownKey("sidebr", ["nav"], ["sidebar"]).message;
 * // "nav.sidebr: unknown key, expected one of sidebar (did you mean sidebar?)"
 */
export function unknownKey(
  key: string,
  parentPath: readonly string[],
  accepted: readonly string[],
): ConfigFieldError {
  const keyPath = [...parentPath, key];
  const suggestion = closestKey(key, accepted);
  const hint = suggestion === undefined ? "" : ` (did you mean ${suggestion}?)`;
  return new ConfigFieldError(
    keyPath,
    `${keyPath.join(".")}: unknown key, expected one of ${accepted.join(", ")}${hint}`,
  );
}

/**
 * The thrown shape vite's error overlay and terminal read: `id` names the
 * file, `loc` the line and column (`ErrorPayload.err` in vite's
 * `types/hmrPayload.d.ts`). A key the parser cannot reach (spread in,
 * computed) is named by its path alone.
 *
 * @example
 * locatedError(invalid("title", ["title"], "a string", 42), "/site/biac.config.ts");
 * // Error "Invalid biac.config.ts:2:3 — title: …", id, loc { file, line: 2, column: 3 }
 */
export function locatedError(error: ConfigFieldError, file: string): Error {
  const position = findConfigKeyPosition(
    readFileSync(file, "utf8"),
    error.keyPath,
  );
  const where =
    position === undefined ? "" : `:${position.line}:${position.column}`;
  return Object.assign(
    new Error(`Invalid ${basename(file)}${where} — ${error.message}`),
    { id: file },
    position === undefined ? {} : { loc: { file, ...position } },
  );
}
