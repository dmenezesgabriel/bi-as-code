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
  // `embed.origins` ships as well: the `frame-ancestors` header already
  // publishes them, and a framed page needs them to address its parent.
  // `embed.dataOrigins` stays behind: no browser code reads it, and each
  // origin is told only its own match (ADR-0025), not the whole list.
  // `base` stays behind: vite bakes it as `import.meta.env.BASE_URL` at
  // build, which is the value the SPA reads.
  const browserConfig: Omit<
    BiacConfig,
    "interpreters" | "directories" | "brand" | "embed" | "base"
  > & { embed: Pick<BiacConfig["embed"], "origins"> } = {
    title: config.title,
    theme: config.theme,
    nav: config.nav,
    sqlTables: config.sqlTables,
    layout: config.layout,
    embed: { origins: config.embed.origins },
  };
  return `export const config = ${JSON.stringify(browserConfig)};\n`;
}
