import { useEffect, type RefObject } from "react";

interface DockedDismissal {
  /** True while the bar is docked with its inputs opened. */
  active: boolean;
  bar: RefObject<HTMLElement | null>;
  trigger: RefObject<HTMLElement | null>;
  collapse: () => void;
}

/**
 * Whether a press on `target` is on the page around `bar`: inside the bar's
 * app root — its top-level ancestor under `<body>` — but not in the bar. A
 * target outside the app root is a popup portaled to `<body>` (an input's
 * option list or date picker) and belongs to whatever opened it.
 *
 * @example
 * if (isOutsidePress(bar.current, event.target)) collapse();
 */
export function isOutsidePress(
  bar: Element | null,
  target: EventTarget | null,
): boolean {
  if (!bar || !(target instanceof Node)) return false;
  if (bar.contains(target)) return false;
  return bar.closest("body > *")?.contains(target) ?? false;
}

/**
 * The ways out of an opened docked bar besides its trigger: `Escape`
 * collapses it and returns focus to the trigger, and a pointer press on the
 * page around it collapses it. `Escape` is heard on `window`, the last stop
 * of the bubble: a child popup that closes on `Escape` handles the key on
 * `document` and stops it there, so one press closes the popup and the next
 * collapses the bar.
 *
 * @example
 * useDockedDismissal({ active: !resting && opened, bar, trigger, collapse });
 */
export function useDockedDismissal({
  active,
  bar,
  trigger,
  collapse,
}: DockedDismissal): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      collapse();
      trigger.current?.focus();
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (isOutsidePress(bar.current, event.target)) collapse();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [active, bar, trigger, collapse]);
}
