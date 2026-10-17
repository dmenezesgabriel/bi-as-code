import type { DataUpdate, DataUpdateSubscription } from "./types";

/**
 * The custom HMR event `biac dev` sends when a `data/` file changes — the
 * engine's `DATA_UPDATE_EVENT` (`src/engine/data-update.ts`), restated
 * because the SPA never imports the engine.
 */
const DATA_UPDATE_EVENT = "biac:data-update";

/** The slice of vite's `import.meta.hot` a data subscription listens on. */
export interface HotChannel {
  on(event: string, listener: (payload: DataUpdate) => void): void;
  off(event: string, listener: (payload: DataUpdate) => void): void;
}

/**
 * Data changes pushed over vite's HMR channel. The channel is one
 * broadcast: every open page hears every change and keeps only the paths
 * it reads.
 *
 * @example
 * const dataUpdates = import.meta.hot ? hmrDataUpdates(import.meta.hot) : undefined;
 */
export function hmrDataUpdates(hot: HotChannel): DataUpdateSubscription {
  return (onUpdate) => {
    const listener = (update: DataUpdate) => onUpdate(update);
    hot.on(DATA_UPDATE_EVENT, listener);
    return () => hot.off(DATA_UPDATE_EVENT, listener);
  };
}
