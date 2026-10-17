/**
 * The two lines a reader scans a `<FilterBar>` row by: every input's label
 * on one, every control box on the other. The bar aligns its children to the
 * top (`items-start`), so one single-row label (`truncate` keeps a long title
 * from wrapping onto a second row) above one 36 px box puts both lines level
 * across a row, whatever a neighbour grows to below its box. A box with no
 * label row (the toggle) drops by the row's height to meet the control line.
 *
 * Tailwind reads class names literally, so the height lives here as both its
 * fixed and its minimum form: a multi-select grows past it as chips wrap.
 */
export const FIELD_LABEL_ROW =
  "mb-1 block cursor-default truncate text-sm font-medium text-label";

/**
 * Drops a box with no label row by {@link FIELD_LABEL_ROW}'s height — its
 * 20 px `text-sm` line plus the 4 px `mb-1` gap — onto the control line.
 */
export const FIELD_LABEL_ROW_OFFSET = "mt-6";

/** The height of every bordered control box on the bar. */
export const FIELD_CONTROL_HEIGHT = "h-9";

/** {@link FIELD_CONTROL_HEIGHT} for a box that grows with its content. */
export const FIELD_CONTROL_MIN_HEIGHT = "min-h-9";
