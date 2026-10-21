import { useEffect, type RefObject } from "react";
import { flushSync } from "react-dom";

/**
 * Focuses the search box, its text selected, on `/` or ⌘K / Ctrl-K from
 * anywhere on the page — `/` only when the reader is not typing into a
 * field. `reveal` runs first and is flushed, so a box inside a hidden
 * drawer is visible (and so focusable) by the time it is focused.
 *
 * @example
 * const inputRef = useRef<HTMLInputElement>(null);
 * useSearchShortcut(inputRef, openDrawer);
 */
export function useSearchShortcut(
  inputRef: RefObject<HTMLInputElement | null>,
  reveal: () => void,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const input = inputRef.current;
      if (!input || !isSearchShortcut(event)) return;
      event.preventDefault();
      flushSync(reveal);
      input.focus();
      input.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inputRef, reveal]);
}

function isSearchShortcut(event: KeyboardEvent): boolean {
  if (event.altKey || event.shiftKey) return false;
  if (event.code === "KeyK") return event.metaKey || event.ctrlKey;
  if (event.key !== "/" || event.metaKey || event.ctrlKey) return false;
  return !isEditableTarget(event.target);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}
