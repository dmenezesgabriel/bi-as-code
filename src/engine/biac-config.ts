import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfigFromFile } from "vite";
import {
  ConfigFieldError,
  invalid,
  locatedError,
} from "./biac-config-error.js";
import { readBrand } from "./brand-config.js";
import { isRecord, rejectUnknownKeys } from "./config-shape.js";
import {
  DEFAULT_INTERPRETERS,
  mergeInterpreters,
} from "./data-loader-interpreters.js";
import {
  isPageWidth,
  isNonBlankText,
  PAGE_WIDTH_CHOICES,
  NON_BLANK_TEXT_SHAPE,
} from "./page-layout-frontmatter.js";
import { sqlTableMap } from "./sql-frontmatter.js";
import type { BiacConfig, DirectoryTitles, LayoutSwitch } from "./types.js";

const CONFIG_FILE = "biac.config.ts";

const DEFAULTS: BiacConfig = {
  title: "biac",
  theme: "system",
  nav: { sidebar: true },
  sqlTables: {},
  interpreters: DEFAULT_INTERPRETERS,
  layout: {
    page_width: "article",
    cards: false,
    table_of_contents: true,
    table_of_contents_label: "On this page",
  },
  directories: {},
  brand: { colors: {}, palette: {}, scale: {}, fonts: {} },
};

// The keys of the closed objects. An unknown one throws rather than
// warns: a warning scrolls past in a busy dev terminal and never fails a
// build, so a typo like `pagewidth` would silently do nothing. `sql` and
// `interpreters` are open maps (table names, file extensions) and are never
// checked; `directories` keys are folders, checked against the discovered
// pages where the manifest is built.
const CONFIG_KEYS = [
  "title",
  "theme",
  "nav",
  "sql",
  "interpreters",
  "layout",
  "directories",
  "brand",
] as const;
const NAV_KEYS = ["sidebar"] as const;
const LAYOUT_KEYS = [
  "page_width",
  "cards",
  "table_of_contents",
  "table_of_contents_label",
] as const;

const DIRECTORY_SETTING_KEYS = ["title"] as const;
// The sidebar groups pages by their first folder only, so a title for a
// deeper folder (`pages/a/b`) would never show — it is refused, not ignored.
const DIRECTORY_KEY = /^pages\/[^/]+$/;

const CONFIG_SHAPE = `an object with optional fields { ${CONFIG_KEYS.join(", ")} }`;

/**
 * Loads the project's `biac.config.ts`, filling omitted fields with
 * defaults. The file is user code executed through vite's own config
 * pipeline (`loadConfigFromFile` bundles it with esbuild, then imports it —
 * the same trust model as `vite.config.ts`). A missing file resolves to
 * defaults; a malformed one throws naming the field, its expected shape and
 * the offending value, at the field's `biac.config.ts:<line>:<column>`. The
 * Error carries vite's `id` and `loc`, so the dev overlay and terminal link
 * to the author's file rather than to this module.
 *
 * @example
 * const config = await loadBiacConfig("/site");
 * // { title: "ACME", theme: "system", nav: { sidebar: true } }
 */
export async function loadBiacConfig(projectRoot: string): Promise<BiacConfig> {
  const file = join(projectRoot, CONFIG_FILE);
  if (!existsSync(file)) return structuredClone(DEFAULTS);
  try {
    const loaded = await loadConfigFile(file, projectRoot);
    // `loaded.config` is typed as vite's UserConfig but is whatever the file
    // default-exported — validate it field by field.
    return toBiacConfig(loaded?.config);
  } catch (error) {
    if (error instanceof ConfigFieldError) throw locatedError(error, file);
    throw error;
  }
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
      throw invalid("default export", [], CONFIG_SHAPE, "<non-object>");
    }
    throw error;
  }
}

function toBiacConfig(raw: unknown): BiacConfig {
  if (!isRecord(raw)) {
    throw invalid("default export", [], CONFIG_SHAPE, raw);
  }
  rejectUnknownKeys(raw, CONFIG_KEYS, []);
  return {
    title: readTitle(raw),
    theme: readTheme(raw),
    nav: { sidebar: readSidebar(raw) },
    sqlTables: sqlTableMap(raw.sql, CONFIG_FILE),
    interpreters: readInterpreters(raw),
    layout: readLayout(raw),
    directories: readDirectories(raw),
    brand: readBrand(raw),
  };
}

function readTitle(spec: Record<string, unknown>): string {
  if (spec.title === undefined) return DEFAULTS.title;
  if (typeof spec.title !== "string")
    throw invalid("title", ["title"], "a string", spec.title);
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
  throw invalid("theme", ["theme"], '"light" | "dark" | "system"', spec.theme);
}

function readSidebar(spec: Record<string, unknown>): boolean {
  if (spec.nav === undefined) return DEFAULTS.nav.sidebar;
  if (!isRecord(spec.nav))
    throw invalid(
      "nav",
      ["nav"],
      "an object with an optional boolean sidebar",
      spec.nav,
    );
  rejectUnknownKeys(spec.nav, NAV_KEYS, ["nav"]);
  if (spec.nav.sidebar === undefined) return DEFAULTS.nav.sidebar;
  if (typeof spec.nav.sidebar !== "boolean")
    throw invalid(
      "nav.sidebar",
      ["nav", "sidebar"],
      "a boolean",
      spec.nav.sidebar,
    );
  return spec.nav.sidebar;
}

function readLayout(spec: Record<string, unknown>): BiacConfig["layout"] {
  if (spec.layout === undefined) return { ...DEFAULTS.layout };
  if (!isRecord(spec.layout))
    throw invalid(
      "layout",
      ["layout"],
      `an object with optional ${LAYOUT_KEYS.join(", ")}`,
      spec.layout,
    );
  rejectUnknownKeys(spec.layout, LAYOUT_KEYS, ["layout"]);
  return {
    page_width: readPageWidth(spec.layout.page_width),
    cards: readLayoutSwitch(spec.layout, "cards"),
    table_of_contents: readLayoutSwitch(spec.layout, "table_of_contents"),
    table_of_contents_label: readTocLabel(spec.layout.table_of_contents_label),
  };
}

function readPageWidth(width: unknown): BiacConfig["layout"]["page_width"] {
  if (width === undefined) return DEFAULTS.layout.page_width;
  if (!isPageWidth(width))
    throw invalid(
      "layout.page_width",
      ["layout", "page_width"],
      PAGE_WIDTH_CHOICES,
      width,
    );
  return width;
}

function readLayoutSwitch(
  layout: Record<string, unknown>,
  key: LayoutSwitch,
): boolean {
  const value = layout[key];
  if (value === undefined) return DEFAULTS.layout[key];
  if (typeof value !== "boolean")
    throw invalid(`layout.${key}`, ["layout", key], "a boolean", value);
  return value;
}

function readTocLabel(label: unknown): string {
  if (label === undefined) return DEFAULTS.layout.table_of_contents_label;
  if (!isNonBlankText(label))
    throw invalid(
      "layout.table_of_contents_label",
      ["layout", "table_of_contents_label"],
      NON_BLANK_TEXT_SHAPE,
      label,
    );
  return label;
}

function readDirectories(spec: Record<string, unknown>): DirectoryTitles {
  if (spec.directories === undefined) return { ...DEFAULTS.directories };
  if (!isRecord(spec.directories))
    throw invalid(
      "directories",
      ["directories"],
      'an object mapping "pages/<folder>" to { title }',
      spec.directories,
    );
  const titles = Object.entries(spec.directories).map(readDirectoryTitle);
  return Object.fromEntries(titles);
}

function readDirectoryTitle([key, settings]: [string, unknown]): [
  string,
  { title: string },
] {
  const keyPath = ["directories", readDirectoryKey(key)];
  const field = `directories[${JSON.stringify(key)}]`;
  if (!isRecord(settings))
    throw invalid(field, keyPath, "an object { title }", settings);
  rejectUnknownKeys(settings, DIRECTORY_SETTING_KEYS, keyPath);
  if (!isNonBlankText(settings.title))
    throw invalid(
      `${field}.title`,
      [...keyPath, "title"],
      NON_BLANK_TEXT_SHAPE,
      settings.title,
    );
  return [key, { title: settings.title }];
}

function readDirectoryKey(key: string): string {
  if (DIRECTORY_KEY.test(key)) return key;
  throw invalid(
    "directories key",
    ["directories", key],
    '"pages/<folder>", a first-level folder of pages/',
    key,
  );
}

function readInterpreters(
  spec: Record<string, unknown>,
): BiacConfig["interpreters"] {
  if (spec.interpreters === undefined) return DEFAULTS.interpreters;
  if (!isRecord(spec.interpreters)) {
    throw invalid(
      "interpreters",
      ["interpreters"],
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
    throw invalid(
      "interpreters key",
      ["interpreters", ext],
      'an extension starting with "."',
      ext,
    );
  }
  if (argv === null || isStringArray(argv)) return [ext, argv];
  throw invalid(
    `interpreters[${JSON.stringify(ext)}]`,
    ["interpreters", ext],
    "an array of strings or null",
    argv,
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}
