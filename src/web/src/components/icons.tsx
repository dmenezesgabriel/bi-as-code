import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LoaderCircle,
  Moon,
  Search,
  Sun,
  X,
  type LucideProps,
} from "lucide-react";

/**
 * The `lucide-react` wrap site — `.dependency-cruiser.cjs` keeps the icon
 * set behind `src/web/src/components/` so sizes stay consistent and the
 * library stays swappable. Icons render `aria-hidden`: they are
 * decorative, so a control carrying one must name itself.
 */

/** Sun glyph — the theme toggle shows it while the UI is dark. */
export function SunIcon(props: LucideProps) {
  return <Sun aria-hidden size={16} {...props} />;
}

/** Moon glyph — the theme toggle shows it while the UI is light. */
export function MoonIcon(props: LucideProps) {
  return <Moon aria-hidden size={16} {...props} />;
}

/** Double-ended arrow — a sortable column header with no active sort. */
export function ArrowUpDownIcon(props: LucideProps) {
  return <ArrowUpDown aria-hidden size={14} {...props} />;
}

/** Down arrow — the active sort is descending. */
export function ArrowDownIcon(props: LucideProps) {
  return <ArrowDown aria-hidden size={14} {...props} />;
}

/** Up arrow — the active sort is ascending. */
export function ArrowUpIcon(props: LucideProps) {
  return <ArrowUp aria-hidden size={14} {...props} />;
}

/** Double chevron pointing left — jump to the first page. */
export function ChevronsLeftIcon(props: LucideProps) {
  return <ChevronsLeft aria-hidden size={14} {...props} />;
}

/** Single chevron pointing left — step back one page. */
export function ChevronLeftIcon(props: LucideProps) {
  return <ChevronLeft aria-hidden size={14} {...props} />;
}

/** Single chevron pointing right — step forward one page. */
export function ChevronRightIcon(props: LucideProps) {
  return <ChevronRight aria-hidden size={14} {...props} />;
}

/** Double chevron pointing right — jump to the last page. */
export function ChevronsRightIcon(props: LucideProps) {
  return <ChevronsRight aria-hidden size={14} {...props} />;
}

/** Single chevron pointing down — a disclosure trigger's open state. */
export function ChevronDownIcon(props: LucideProps) {
  return <ChevronDown aria-hidden size={16} {...props} />;
}

/** Check mark — the selected indicator inside a `Combobox.Item`. */
export function CheckIcon(props: LucideProps) {
  return <Check aria-hidden size={14} {...props} />;
}

/** Magnifier — decorates the search input inside a combobox popup. */
export function SearchIcon(props: LucideProps) {
  return <Search aria-hidden size={14} {...props} />;
}

/** Calendar — decorates the `<DateRange>` trigger. */
export function CalendarIcon(props: LucideProps) {
  return <Calendar aria-hidden size={14} {...props} />;
}

/** Cross — removes one chip inside a multi-select field. */
export function XIcon(props: LucideProps) {
  return <X aria-hidden size={12} {...props} />;
}

/** Spinning ring — a select trigger's option query is in flight. */
export function LoaderCircleIcon(props: LucideProps) {
  return (
    <LoaderCircle
      aria-hidden
      size={14}
      className="animate-spin [animation-duration:1s]"
      {...props}
    />
  );
}
