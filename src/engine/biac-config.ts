import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfigFromFile } from "vite";
import {
  DEFAULT_INTERPRETERS,
  mergeInterpreters,
} from "./data-loader-interpreters.js";
import { sqlTableMap } from "./sql-frontmatter.js";
import type { BiacConfig } from "./types.js";

const CONFIG_FILE = "biac.config.ts";

const DEFAULTS: BiacConfig = {
  title: "biac",
  theme: "system",
  nav: { sidebar: true },
  sqlTables: {},
  interpreters: DEFAULT_INTERPRETERS,
};

const CONFIG_SHAPE =
  "an object with optional fields { title, theme, nav, sql, interpreters }";

/**
 * Loads the project's `biac.config.ts`, filling omitted fields with
 * defaults. The file is user code executed through vite's own config
 * pipeline (`loadConfigFromFile` bundles it with esbuild, then imports it —
 * the same trust model as `vite.config.ts`). A missing file resolves to
 * defaults; a malformed one throws naming the field, its expected shape and
 * the offending value.
 *
 * @example
 * const config = await loadBiacConfig("/site");
 * // { title: "ACME", theme: "system", nav: { sidebar: true } }
 */
export async function loadBiacConfig(projectRoot: string): Promise<BiacConfig> {
  const file = join(projectRoot, CONFIG_FILE);
  if (!existsSync(file)) return structuredClone(DEFAULTS);
  const loaded = await loadConfigFile(file, projectRoot);
  // `loaded.config` is typed as vite's UserConfig but is whatever the file
  // default-exported — validate it field by field.
  return toBiacConfig(loaded?.config);
}

/**
 * `loadConfigFromFile` rejects non-object default exports with its own terse
 * "config must export or return an object." before the value reaches us —
 * rethrow that one case with the file name and the shape we expect. Every
 * other error (syntax, failed import) already carries file+line and
 * propagates untouched.
 */
async function loadConfigFile(
  file: string,
  projectRoot: string,
): ReturnType<typeof loadConfigFromFile> {
  try {
    return await loadConfigFromFile(
      { command: "serve", mode: "development" },
      file,
      projectRoot,
      "silent",
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "config must export or return an object."
    ) {
      throw invalid("default export", CONFIG_SHAPE, "<non-object>");
    }
    throw error;
  }
}

function toBiacConfig(raw: unknown): BiacConfig {
  if (!isRecord(raw)) {
    throw invalid("default export", CONFIG_SHAPE, raw);
  }
  return {
    title: readTitle(raw),
    theme: readTheme(raw),
    nav: { sidebar: readSidebar(raw) },
    sqlTables: sqlTableMap(raw.sql, CONFIG_FILE),
    interpreters: readInterpreters(raw),
  };
}

function readTitle(spec: Record<string, unknown>): string {
  if (spec.title === undefined) return DEFAULTS.title;
  if (typeof spec.title !== "string")
    throw invalid("title", "a string", spec.title);
  return spec.title;
}

function readTheme(spec: Record<string, unknown>): BiacConfig["theme"] {
  if (spec.theme === undefined) return DEFAULTS.theme;
  if (
    spec.theme === "light" ||
    spec.theme === "dark" ||
    spec.theme === "system"
  )
    return spec.theme;
  throw invalid("theme", '"light" | "dark" | "system"', spec.theme);
}

function readSidebar(spec: Record<string, unknown>): boolean {
  if (spec.nav === undefined) return DEFAULTS.nav.sidebar;
  if (!isRecord(spec.nav))
    throw invalid(
      "nav",
      "an object with an optional boolean sidebar",
      spec.nav,
    );
  if (spec.nav.sidebar === undefined) return DEFAULTS.nav.sidebar;
  if (typeof spec.nav.sidebar !== "boolean")
    throw invalid("nav.sidebar", "a boolean", spec.nav.sidebar);
  return spec.nav.sidebar;
}

function readInterpreters(
  spec: Record<string, unknown>,
): BiacConfig["interpreters"] {
  if (spec.interpreters === undefined) return DEFAULTS.interpreters;
  if (!isRecord(spec.interpreters)) {
    throw invalid(
      "interpreters",
      'an object mapping ".ext" to an argv string[] or null',
      spec.interpreters,
    );
  }
  const overrides = Object.entries(spec.interpreters).map(readInterpreter);
  return mergeInterpreters(Object.fromEntries(overrides));
}

function readInterpreter([ext, argv]: [string, unknown]): [
  string,
  string[] | null,
] {
  if (!ext.startsWith(".")) {
    throw invalid("interpreters key", 'an extension starting with "."', ext);
  }
  if (argv === null || isStringArray(argv)) return [ext, argv];
  throw invalid(
    `interpreters[${JSON.stringify(ext)}]`,
    "an array of strings or null",
    argv,
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string, expected: string, value: unknown): Error {
  return new Error(
    `Invalid ${CONFIG_FILE} — ${field}: expected ${expected}, got ${JSON.stringify(value)}`,
  );
}
