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
  }
  export const config: BiacConfig;
}
