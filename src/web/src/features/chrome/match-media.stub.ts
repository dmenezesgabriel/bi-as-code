import { vi } from "vitest";

/**
 * A controllable `matchMedia` stub for web-unit tests: unlike the inert
 * vitest.setup polyfill it records `change` listeners so a test can fire
 * them. Restore with `vi.unstubAllGlobals()`.
 */
export function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const state = { matches: initialMatches };
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: state.matches,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: (
      _type: string,
      listener: (e: { matches: boolean }) => void,
    ) => listeners.add(listener),
    removeEventListener: (
      _type: string,
      listener: (e: { matches: boolean }) => void,
    ) => listeners.delete(listener),
    dispatchEvent: () => false,
  }));
  return {
    setMatches(matches: boolean) {
      state.matches = matches;
      for (const listener of listeners) listener({ matches });
    },
    listenerCount: () => listeners.size,
  };
}
