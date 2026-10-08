import { useEffect, useState, type RefObject } from "react";

/**
 * Tracks whether `ref`'s element intersects the viewport, the React port of
 * evidence's `useIntersection`. `defaultState` seeds the pre-observe value
 * so consumers never paint the wrong face on first render — the FilterBar
 * sentinel passes `true` so the bar does not flash its floating card before
 * the observer lands.
 *
 * @example
 * const sentinel = useRef<HTMLDivElement>(null);
 * const resting = useIsIntersecting(sentinel, true);
 */
export function useIsIntersecting(
  ref: RefObject<HTMLElement | null>,
  defaultState: boolean,
): boolean {
  const [intersecting, setIntersecting] = useState(defaultState);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) setIntersecting(entry.isIntersecting);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return intersecting;
}
