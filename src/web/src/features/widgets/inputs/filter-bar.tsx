import { useRef, type ReactElement } from "react";
import { cn } from "../../../lib/cn";
import type { FilterBarProps } from "./types";
import { useIsIntersecting } from "./use-is-intersecting";

/**
 * The `<FilterBar>` MDX widget — evidence's `filter_bar` ported to our
 * chrome: a presentational wrap that lays filter inputs out as one
 * horizontal bar, sticks it under the page header on scroll (`top-16`
 * clears the `h-12` header), and gains a floating card style once its rest
 * position leaves the viewport. Purely visual — the bar stores nothing and
 * children's `?id=` URL-param writes are untouched.
 *
 * @example
 * <FilterBar>
 *   <Dropdown id="region" data="orders" valueColumn="region" title="Region" />
 *   <Slider id="amount" data="amounts" valueColumn="amount" range />
 * </FilterBar>
 */
export function FilterBar({ children }: FilterBarProps): ReactElement {
  const sentinel = useRef<HTMLDivElement>(null);
  const resting = useIsIntersecting(sentinel, true);
  return (
    <>
      {/* The sentinel's top sits 64px above the bar's rest top (`-mt-16`),
          so it exits the viewport exactly when the bar reaches the `top-16`
          dock line — the card face fires at the pin moment, never early or
          late. `mb-16` hands the removed margin back so layout is
          unchanged. */}
      <div
        ref={sentinel}
        aria-hidden="true"
        className="pointer-events-none -mt-16 mb-16 h-0 w-0"
      />
      <div
        className={cn(
          "sticky top-16 z-10 flex flex-row flex-wrap items-end gap-4 rounded-md border pt-3 pb-2 transition-all",
          resting
            ? "border-transparent shadow-none"
            : "border-neutral-200 bg-white px-4 shadow dark:border-neutral-800 dark:bg-neutral-950",
        )}
      >
        {children}
      </div>
    </>
  );
}
