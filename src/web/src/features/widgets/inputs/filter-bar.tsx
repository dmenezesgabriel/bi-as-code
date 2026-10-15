import {
  useCallback,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type Ref,
} from "react";
import { Collapsible } from "../../../components/collapsible";
import { ChevronDownIcon } from "../../../components/icons";
import { cn } from "../../../lib/cn";
import { FilterRoster } from "../../filters/filter-roster";
import { FilterRosterProvider } from "../../filters/filter-roster-context";
import type { FilterBarProps } from "./types";
import { useDockedDisclosure } from "./use-docked-disclosure";
import { useDockedDismissal } from "./use-docked-dismissal";
import { useIsIntersecting } from "./use-is-intersecting";
import { useRestingHeight } from "./use-resting-height";

// One row: a 24 px trigger (WCAG 2.5.8) with breathing room, well under the
// share of a short viewport a sticky band may cover.
export const DOCKED_ROW_HEIGHT = "2.5rem";

// The opened inputs scroll inside themselves rather than cover more than
// half the viewport: the row above them (2.5rem) and the gap (0.25rem) count.
const OPENED_PANEL_BOUNDS = "max-h-[calc(50dvh-2.75rem)] overflow-y-auto";

const CARD_FACE =
  "border-neutral-200 bg-white px-4 shadow dark:border-neutral-800 dark:bg-neutral-950";

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
 * while hidden, so their selections and option queries survive. A
 * collapsed row would otherwise hide that its inputs still narrow the
 * page, so the trigger counts the applied ones (`Filters · 2`).
 * Purely visual — the bar stores no filter value and children's `?id=`
 * URL-param writes are untouched.
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
  const trigger = useRef<HTMLButtonElement>(null);
  const resting = useIsIntersecting(sentinel, true);
  const { opened, setOpened, panelFocusProps } = useDockedDisclosure(resting);
  const restingHeight = useRestingHeight(bar, resting);
  const collapse = useCallback(() => setOpened(false), [setOpened]);
  const { roster, activeCount } = useInputsRoster();
  useDockedDismissal({ active: !resting && opened, bar, trigger, collapse });
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
        data-filter-bar=""
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
        {!resting && <FiltersTrigger ref={trigger} activeCount={activeCount} />}
        <Collapsible.Panel
          keepMounted
          {...panelFocusProps}
          className={cn(
            "flex flex-row flex-wrap items-end gap-4",
            !resting &&
              cn(
                CARD_FACE,
                OPENED_PANEL_BOUNDS,
                "absolute -inset-x-px top-full mt-1 rounded-md border pt-3 pb-2",
              ),
          )}
        >
          <FilterRosterProvider roster={roster}>
            {children}
          </FilterRosterProvider>
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

/** The bar's own roster of its inputs' filters, and how many are applied. */
function useInputsRoster(): { roster: FilterRoster; activeCount: number } {
  const [roster] = useState(() => new FilterRoster());
  const activeCount = useSyncExternalStore(
    roster.subscribe,
    roster.getSnapshot,
  );
  return { roster, activeCount };
}

function FiltersTrigger({
  ref,
  activeCount,
}: {
  ref: Ref<HTMLButtonElement>;
  activeCount: number;
}): ReactElement {
  const labelId = useId();
  const countId = useId();
  // The count is the button's description, not part of its name: the name
  // stays `Filters` whatever the page's state, and a screen reader still
  // announces "2 active" after it.
  return (
    <Collapsible.Trigger
      ref={ref}
      aria-labelledby={labelId}
      aria-describedby={activeCount > 0 ? countId : undefined}
      className="group flex min-h-6 cursor-pointer items-center gap-0.5 text-sm text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
    >
      <ChevronDownIcon className="shrink-0 -rotate-90 transition-transform group-data-panel-open:rotate-0" />
      <span id={labelId}>Filters</span>
      {activeCount > 0 && (
        <ActiveCount id={countId} activeCount={activeCount} />
      )}
    </Collapsible.Trigger>
  );
}

// Two faces of one number: the dot-separated figure for the eye, and one
// whole phrase for the description — assistive technology joins sibling
// inline nodes without the space between them.
function ActiveCount({
  id,
  activeCount,
}: {
  id: string;
  activeCount: number;
}): ReactElement {
  return (
    <span id={id} className="ml-1 tabular-nums">
      <span aria-hidden="true">· {activeCount}</span>
      <span className="sr-only">{`${activeCount} active`}</span>
    </span>
  );
}
