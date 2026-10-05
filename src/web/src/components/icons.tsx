import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Moon,
  Sun,
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
