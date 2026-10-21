import type { FrameHeightMessage, FrameParent, FrameWindow } from "./types";

/** A parent window that records every message posted to it, with its target origin. */
export class RecordingFrameParent implements FrameParent {
  readonly posted: { message: FrameHeightMessage; targetOrigin: string }[] = [];

  postMessage(message: FrameHeightMessage, targetOrigin: string): void {
    this.posted.push({ message, targetOrigin });
  }
}

/**
 * A page's own window framed by `parent`, naming the parent's origin the
 * way a browser does: `ancestorOrigins` (omit it for a browser without
 * one) and `referrer`.
 *
 * @example
 * const frame = new FakeFrameWindow({ ancestorOrigins: ["https://intranet.example.com"] });
 * frame.parent.posted; // → what the page posted to its parent
 */
export class FakeFrameWindow implements FrameWindow {
  readonly parent = new RecordingFrameParent();
  readonly location: { ancestorOrigins?: ArrayLike<string> };
  readonly document: { referrer: string };

  constructor({
    ancestorOrigins,
    referrer = "",
  }: {
    ancestorOrigins?: readonly string[];
    referrer?: string;
  }) {
    this.location = { ancestorOrigins };
    this.document = { referrer };
  }

  postMessage(): void {}
}

/** A top-level window: its parent is itself, so it is not framed. */
export function topLevelWindow(): FrameWindow {
  const top = new FakeFrameWindow({});
  return Object.assign(top, { parent: top });
}
