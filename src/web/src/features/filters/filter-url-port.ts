/**
 * The browser `FilterUrlPort`: filters read and write `window.location` —
 * the same source both ways, so two filters never clobber each other's
 * params through a stale copy. Writes go through `history.replaceState`
 * (`pushState` would make every filter change a history entry);
 * `cross-cutting.md` records the rule.
 */

/** Reads and writes the URL a filter persists to. Reads return a fresh URL
 * copy each call (the caller mutates it before writing); `undefined` means
 * there is no URL to work with. */
export interface FilterUrlPort {
  read(): URL | undefined;
  write(url: URL): void;
}

export const browserFilterUrlPort: FilterUrlPort = {
  read: () =>
    typeof window === "undefined" ? undefined : new URL(window.location.href),
  write: (url) => window.history.replaceState(window.history.state, "", url),
};
