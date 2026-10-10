import { useRef, type ReactElement } from "react";
import { cn } from "../../../lib/cn";
import type { FilterBarProps } from "./types";
import { useIsIntersecting } from "./use-is-intersecting";

/**
 * The `<FilterBar>` MDX widget — evidence's `filter_bar` ported to our
 * chrome: a presentational wrap that lays filter inputs out as one
 * horizontal bar, sticks it under the page header on scroll (`--dock-top`,
 * default 4rem, clears the `h-12` header; a pane that scrolls on its own
 * sets it lower), and gains a floating card style once its rest
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
      {/* The sentinel's top sits one dock offset above the bar's rest top,
          so it leaves its scroll container exactly when the bar reaches the
          dock line — the card face fires at the pin moment, never early or
          late. The bottom margin hands the offset back so layout is
          unchanged. */}
      <div
        ref={sentinel}
        aria-hidden="true"
        className="pointer-events-none -mt-(--dock-top,4rem) mb-(--dock-top,4rem) h-0 w-0"
      />
      <div
        className={cn(
          "sticky top-(--dock-top,4rem) z-10 flex flex-row flex-wrap items-end gap-4 rounded-md border pt-3 pb-2 transition-all",
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
