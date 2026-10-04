import { useSyncExternalStore } from "react";

/**
 * Live `matchMedia` subscription: returns whether `query` currently matches
 * and re-renders when the match flips (e.g. the window crosses a
 * breakpoint). `useSyncExternalStore` is React's intended primitive for
 * external stores like `MediaQueryList`.
 *
 * @example
 * const isMobile = useMediaQuery("(max-width: 1023px)");
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
