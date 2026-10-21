import { type RefObject, useEffect, useSyncExternalStore } from "react";
import type { FrameWindow } from "./types";

/**
 * Whether the page is shown inside another page's iframe.
 *
 * @example
 * isFramed(window); // → false in a tab of its own
 */
export function isFramed(frame: FrameWindow): boolean {
  return frame.parent !== frame;
}

/**
 * `isFramed` for render: the page's own window (or `frame`), read once per
 * render — a page never moves in or out of a frame — and false off the
 * browser, where there is no window to ask.
 *
 * @example
 * const framed = useFramed();
 */
export function useFramed(frame?: FrameWindow): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => isFramed(frame ?? window),
    () => false,
  );
}

function neverChanges(): () => void {
  return () => {};
}

/**
 * The origin of the page framing this one, or null when it is not framed
 * or the browser does not say. `ancestorOrigins[0]` is the parent even
 * under a `no-referrer` policy (where Firefox masks it as `"null"`); the
 * referrer covers browsers without `ancestorOrigins`.
 *
 * @example
 * parentOrigin(window); // → "https://intranet.example.com"
 */
export function parentOrigin(frame: FrameWindow): string | null {
  if (!isFramed(frame)) return null;
  const ancestor = frame.location.ancestorOrigins?.[0];
  if (ancestor !== undefined) return ancestor;
  const referrer = frame.document.referrer;
  return URL.canParse(referrer) ? new URL(referrer).origin : null;
}

/**
 * Posts `{ type: "biac:height", height }` to the parent each time the
 * `content` element's height changes, so the host can size its iframe to
 * the page. The message goes only to a parent whose origin `origins` lists,
 * addressed to that exact origin (never `"*"`): any other parent learns
 * nothing about the page, and nothing is logged. `frame` defaults to the
 * page's own window.
 *
 * @example
 * useFrameHeightReporter(contentRef, config.embed.origins);
 */
export function useFrameHeightReporter(
  content: RefObject<HTMLElement | null>,
  origins: readonly string[],
  frame?: FrameWindow,
): void {
  useEffect(() => {
    const element = content.current;
    const page = frame ?? window;
    const origin = parentOrigin(page);
    if (!element || origin === null || !origins.includes(origin)) return;
    return observeHeight(element, (height) =>
      page.parent.postMessage({ type: "biac:height", height }, origin),
    );
  }, [content, origins, frame]);
}

// ResizeObserver delivers at most once per frame, so an unchanged height is
// the only repeat worth dropping.
function observeHeight(
  element: HTMLElement,
  onHeight: (height: number) => void,
): () => void {
  let reported: number | null = null;
  const observer = new ResizeObserver(() => {
    const height = element.scrollHeight;
    if (height === reported) return;
    reported = height;
    onHeight(height);
  });
  observer.observe(element);
  return () => observer.disconnect();
}
