// Types the site-config module served by the engine's vite plugin —
// `virtual:` ids have no real file for tsc to resolve, so the contract is
// declared here. The module regenerates when `biac.config.ts` changes.
declare module "virtual:biac-config" {
  /** Resolved `biac.config.ts` — mirrors `BiacConfig` in `src/engine/types.ts`. */
  export interface BiacConfig {
    /** Site name: sidebar header and the document-title fallback. */
    title: string;
    /** Project theme default; a persisted user toggle overrides it. */
    theme: "light" | "dark" | "system";
    nav: {
      /** False removes the sidebar — content spans the viewport. */
      sidebar: boolean;
    };
    /** Project-wide `sql:` tables — name → `data/` path; merged with each page's own `sqlTables`. */
    sqlTables: Record<string, string>;
    /** Project-wide page layout; a page's own layout front-matter overrides it key by key. */
    layout: {
      /** `article` keeps the reading column; `full` fills the space beside the sidebar. */
      page_width: "article" | "full";
      /** True puts each chart, table and big value on its own card. */
      cards: boolean;
      /** False hides the right-rail table of contents; a page can bring it back. */
      table_of_contents: boolean;
      /** The table of contents' heading and the name of its `nav` landmark. */
      table_of_contents_label: string;
    };
    embed: {
      /** Origins allowed to frame the site; a framed page posts its height only to one of them. */
      origins: readonly string[];
    };
  }
  export const config: BiacConfig;
}
