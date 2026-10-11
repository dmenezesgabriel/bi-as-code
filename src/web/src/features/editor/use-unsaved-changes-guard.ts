import { useCallback } from "react";
import { useBlocker, type ShouldBlockFn } from "@tanstack/react-router";
import { isEditSearch } from "./edit-search";
import { hasUnsavedChanges } from "./editor-status";
import type { EditorStatus } from "./types";

const LEAVE_MESSAGE = "Leave this page? Your unsaved changes will be lost.";

type GuardedLocation = Parameters<ShouldBlockFn>[0]["current"];

/**
 * Asks before a navigation throws away unsaved editor text. Only a
 * navigation that leaves the editor is guarded — another page, or the same
 * page without its edit flag (`Done`); filter writes go through
 * `history.replaceState` and never reach the router. A reload or tab close
 * gets the browser's own prompt through the router's single `beforeunload`
 * listener, which runs only while the predicate is true: the router enables
 * it by default, and MDN advises listening only while changes are unsaved
 * (https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).
 * `confirmLeave` returns true to leave.
 *
 * @example
 * useUnsavedChangesGuard(status, (message) => window.confirm(message));
 */
export function useUnsavedChangesGuard(
  status: EditorStatus,
  confirmLeave: (message: string) => boolean,
): void {
  const unsaved = hasUnsavedChanges(status);
  const shouldBlockFn = useCallback<ShouldBlockFn>(
    ({ current, next }) =>
      unsaved && leavesEditor(current, next) && !confirmLeave(LEAVE_MESSAGE),
    [unsaved, confirmLeave],
  );
  const enableBeforeUnload = useCallback(() => unsaved, [unsaved]);
  useBlocker({ shouldBlockFn, enableBeforeUnload });
}

function leavesEditor(
  current: GuardedLocation,
  next: GuardedLocation,
): boolean {
  return next.pathname !== current.pathname || !isEditSearch(next.search);
}
