import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * The height `bar` had the last time it was `resting`, in px — what a
 * docked bar must keep occupying in flow. Tracked with a ResizeObserver
 * only while resting (inputs load options and wrap after mount) and frozen
 * while docked, when the bar's own box is the one-row face. Holding it in
 * state means the docked face and the height it gives up commit in one
 * render: sizing the hand-back from a layout read between two DOM writes
 * makes the browser's scroll anchoring move the page by the difference. A
 * viewport resize while docked keeps the last value until the bar next
 * comes to rest.
 *
 * @example
 * const bar = useRef<HTMLDivElement>(null);
 * const restingHeight = useRestingHeight(bar, resting);
 */
export function useRestingHeight(
  bar: RefObject<HTMLElement | null>,
  resting: boolean,
): number {
  const [restingHeight, setRestingHeight] = useState(0);
  useLayoutEffect(() => {
    const node = bar.current;
    if (!node || !resting) return;
    const record = (): void => setRestingHeight(node.offsetHeight);
    record();
    const observer = new ResizeObserver(record);
    observer.observe(node);
    return () => observer.disconnect();
  }, [bar, resting]);
  return restingHeight;
}
