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
