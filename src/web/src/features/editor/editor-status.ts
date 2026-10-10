import type { EditorStatus, EditorStatusEvent } from "./types";

/**
 * Advances the page editor's status by one event. An edit always makes the
 * buffer dirty, except mid-save, where it is remembered so the save's
 * success lands on `dirty` instead of `saved`.
 *
 * @example
 * nextEditorStatus({ kind: "clean" }, { type: "edited" }); // → { kind: "dirty" }
 */
export function nextEditorStatus(
  status: EditorStatus,
  event: EditorStatusEvent,
): EditorStatus {
  switch (event.type) {
    case "loaded":
      return { kind: "clean" };
    case "loadFailed":
    case "saveFailed":
      return { kind: event.type, message: event.message };
    case "edited":
      return status.kind === "saving"
        ? { kind: "saving", editedDuringSave: true }
        : { kind: "dirty" };
    case "saveStarted":
      return { kind: "saving", editedDuringSave: false };
    case "saveSucceeded":
      return status.kind === "saving" && status.editedDuringSave
        ? { kind: "dirty" }
        : { kind: "saved" };
  }
}
