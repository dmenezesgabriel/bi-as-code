import type { BiacConfig } from "./types.js";

/** The module the SPA reads the project's browser-safe config from. */
export const VIRTUAL_CONFIG_ID = "virtual:biac-config";

/**
 * The browser's `virtual:biac-config`. Interpreters stay behind: they
 * hold host paths (`process.execPath`) and the module ships in the build.
 *
 * @example
 * configModuleSource(await loadBiacConfig(root));
 * // → 'export const config = {"title":"biac","theme":"system",…};\n'
 */
export function configModuleSource(config: BiacConfig): string {
  // `directories` reaches the browser already applied, in the manifest's
  // `navTree`; `brand` as the index.html style `brandStyleTags` injects.
  const browserConfig: Omit<
    BiacConfig,
    "interpreters" | "directories" | "brand"
  > = {
    title: config.title,
    theme: config.theme,
    nav: config.nav,
    sqlTables: config.sqlTables,
    layout: config.layout,
  };
  return `export const config = ${JSON.stringify(browserConfig)};\n`;
}
