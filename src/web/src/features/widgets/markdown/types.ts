import type { ReactNode } from "react";

/** The four severity variants a `<Callout>` accepts. */
export type CalloutType = "info" | "success" | "warning" | "error";

/**
 * Props of the `<Callout>` MDX widget: `type` picks the tint (default
 * `info`), `title` renders a bold heading line above the children.
 */
export interface CalloutProps {
  readonly type?: CalloutType;
  readonly title?: string;
  readonly children?: ReactNode;
}

/**
 * Props of the `<Note>` MDX widget — a muted `text-xs` block for footnotes
 * and source lines.
 */
export interface NoteProps {
  readonly children?: ReactNode;
}

/**
 * Props of the `<LineBreak>` MDX widget — `lines` `<br/>`s of vertical
 * spacing (default 1); non-positive counts render nothing.
 */
export interface LineBreakProps {
  readonly lines?: number;
}

/**
 * Props of the `<Details>` MDX widget — `title` (required) labels the
 * disclosure trigger; `open` starts the panel expanded; `openMobile`
 * overrides `open` on mobile viewports, resolved once at mount so a later
 * breakpoint crossing never overrides the reader's own toggle.
 */
export interface DetailsProps {
  readonly title: string;
  readonly open?: boolean;
  readonly openMobile?: boolean;
  readonly children?: ReactNode;
}

/** The two list styles a `<Tabs>` accepts — `default` is an underline
 * track, `well` a fitted pill track. */
export type TabsVariant = "default" | "well";

/**
 * Props of the `<Tabs>` MDX widget: `variant` picks the list style
 * (default `default`); `fullWidth` spreads the triggers across the
 * container instead of packing them on the left. Children must be
 * `<Tab>` elements — anything else renders an inline alert.
 */
export interface TabsProps {
  readonly variant?: TabsVariant;
  readonly fullWidth?: boolean;
  readonly children?: ReactNode;
}

/**
 * Props of the `<Tab>` MDX widget — a data carrier `<Tabs>` reads via
 * child inspection rather than rendering: `title` (required) labels the
 * trigger, `default` selects this panel on load (only one tab may set
 * it), and `children` become the panel's content.
 */
export interface TabProps {
  readonly title: string;
  readonly default?: boolean;
  readonly children?: ReactNode;
}

/** The three surface styles an `<Accordion>` accepts — `default` is bare,
 * `well` a tinted inset surface, `card` a raised bordered surface. */
export type AccordionVariant = "default" | "well" | "card";

/**
 * Props of the `<Accordion>` MDX widget: `variant` picks the surface
 * style (default `default`); `single` limits expansion to one item at a
 * time (default false — items open independently). Children must be
 * `<AccordionItem>` elements — anything else renders an inline alert.
 */
export interface AccordionProps {
  readonly variant?: AccordionVariant;
  readonly single?: boolean;
  readonly children?: ReactNode;
}

/**
 * Props of the `<AccordionItem>` MDX widget — a data carrier `<Accordion>`
 * reads via child inspection rather than rendering: `title` (required)
 * labels the disclosure trigger, `open` starts the panel expanded (only
 * the first `open` item wins under `single`), and `children` become the
 * panel's content.
 */
export interface AccordionItemProps {
  readonly title: string;
  readonly open?: boolean;
  readonly children?: ReactNode;
}

/** The four vertical alignments a `<Row>` accepts. */
export type RowAlign = "top" | "center" | "bottom" | "stretch";

/**
 * Props of the `<Row>` MDX widget — a wrapping horizontal layout whose
 * children share the line equally: `align` picks the vertical alignment
 * (default `stretch`).
 */
export interface RowProps {
  readonly align?: RowAlign;
  readonly children?: ReactNode;
}

/** The four horizontal alignments a `<Stack>` accepts. */
export type StackAlign = "left" | "center" | "right" | "stretch";

/**
 * Props of the `<Stack>` MDX widget — a vertical layout for its children:
 * `align` picks the horizontal alignment (default `stretch`); non-stretch
 * values shrink-wrap children so the alignment is visible.
 */
export interface StackProps {
  readonly align?: StackAlign;
  readonly children?: ReactNode;
}
