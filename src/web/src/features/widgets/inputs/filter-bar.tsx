import { useRef, useState, type ReactElement } from "react";
import { Collapsible } from "../../../components/collapsible";
import { ChevronDownIcon } from "../../../components/icons";
import { cn } from "../../../lib/cn";
import type { FilterBarProps } from "./types";
import { useIsIntersecting } from "./use-is-intersecting";
import { useRestingHeight } from "./use-resting-height";

// One row: a 24 px trigger (WCAG 2.5.8) with breathing room, well under the
// share of a short viewport a sticky band may cover.
const DOCKED_ROW_HEIGHT = "2.5rem";

const CARD_FACE =
  "border-neutral-200 bg-white px-4 shadow dark:border-neutral-800 dark:bg-neutral-950";

/**
 * Whether the reader has opened the docked bar's inputs. Coming back to
 * rest forgets it, so every dock starts as the one-row face.
 */
function useDockedDisclosure(
  resting: boolean,
): [boolean, (opened: boolean) => void] {
  const [opened, setOpened] = useState(false);
  if (resting && opened) setOpened(false);
  return [opened, setOpened];
}

/**
 * The `<FilterBar>` MDX widget — evidence's `filter_bar` ported to our
 * chrome: a presentational wrap that lays filter inputs out as one
 * horizontal bar, sticks it under the page header on scroll (`--dock-top`,
 * default 4rem, clears the `h-12` header; a pane that scrolls on its own
 * sets it lower), and gains a floating card style once its rest
 * position leaves the viewport. Docked, the bar is content laid over the
 * page, so it shrinks to a single `Filters` disclosure row (WCAG 2.2 SC
 * 2.4.11: a sticky band must not hide what the reader focuses) and shows
 * the inputs on demand in a card over the page; the inputs stay mounted
 * while hidden, so their selections and option queries survive. Purely
 * visual — the bar stores nothing and children's `?id=` URL-param writes
 * are untouched.
 *
 * @example
 * <FilterBar>
 *   <Dropdown id="region" data="orders" valueColumn="region" title="Region" />
 *   <Slider id="amount" data="amounts" valueColumn="amount" range />
 * </FilterBar>
 */
export function FilterBar({ children }: FilterBarProps): ReactElement {
  const sentinel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const resting = useIsIntersecting(sentinel, true);
  const [opened, setOpened] = useDockedDisclosure(resting);
  const restingHeight = useRestingHeight(bar, resting);
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
      {/* Only paint properties transition: the docked row and the spacer
          below must swap heights in one frame, or the page shifts while the
          box animates. */}
      <Collapsible.Root
        ref={bar}
        open={resting || opened}
        onOpenChange={setOpened}
        className={cn(
          "sticky top-(--dock-top,4rem) z-10 rounded-md border transition-[background-color,border-color,box-shadow]",
          resting
            ? "border-transparent pt-3 pb-2 shadow-none"
            : cn(CARD_FACE, "flex items-center"),
        )}
        style={resting ? undefined : { height: DOCKED_ROW_HEIGHT }}
      >
        {!resting && <FiltersTrigger />}
        <Collapsible.Panel
          keepMounted
          className={cn(
            "flex flex-row flex-wrap items-end gap-4",
            !resting &&
              cn(
                CARD_FACE,
                "absolute -inset-x-px top-full mt-1 rounded-md border pt-3 pb-2",
              ),
          )}
        >
          {children}
        </Collapsible.Panel>
      </Collapsible.Root>
      {/* A sticky bar is in flow: the height it gives up when docked is
          held here, so the page below never moves and the sentinel never
          swings back into view. */}
      <div
        aria-hidden="true"
        style={{ height: resting ? 0 : heightGivenUp(restingHeight) }}
      />
    </>
  );
}

function heightGivenUp(restingHeight: number): string {
  return `max(0px, ${restingHeight}px - ${DOCKED_ROW_HEIGHT})`;
}

function FiltersTrigger(): ReactElement {
  return (
    <Collapsible.Trigger className="group flex min-h-6 cursor-pointer items-center gap-0.5 text-sm text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100">
      <ChevronDownIcon className="shrink-0 -rotate-90 transition-transform group-data-panel-open:rotate-0" />
      Filters
    </Collapsible.Trigger>
  );
}
