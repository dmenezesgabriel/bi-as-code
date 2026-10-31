import { useEffect, useState, type RefObject } from "react";

/**
 * The observed region reaches this far below the viewport, so a sentinel
 * waiting below the fold still intersects. It is a margin, not a position
 * test, because a jump from below the fold to above the viewport (an anchor
 * or table-of-contents link) crosses no intersection threshold: both sides
 * read `isIntersecting: false`, and the observer would never report it.
 */
const BELOW_FOLD_REACH = "1000000px";

/**
 * Tracks whether a sticky element is still at its rest position: `false`
 * only once `ref`'s element has left the viewport above, i.e. the element
 * it guards reached its dock line. A sentinel waiting below the fold is
 * still at rest, so a docked row never replaces inputs the reader has not
 * scrolled to yet. `defaultState` seeds the pre-observe value so consumers
 * never paint the wrong face on first render — the FilterBar sentinel
 * passes `true` so the bar does not flash its floating card before the
 * observer lands.
 *
 * @example
 * const sentinel = useRef<HTMLDivElement>(null);
 * const resting = useIsAtRest(sentinel, true);
 */
export function useIsAtRest(
  ref: RefObject<HTMLElement | null>,
  defaultState: boolean,
): boolean {
  const [resting, setResting] = useState(defaultState);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setResting(entry.isIntersecting);
      },
      { rootMargin: `0px 0px ${BELOW_FOLD_REACH} 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return resting;
}
