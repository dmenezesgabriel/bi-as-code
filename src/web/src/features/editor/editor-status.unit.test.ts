import { describe, expect, it } from "vitest";
import { hasUnsavedChanges, nextEditorStatus } from "./editor-status";
import type { EditorStatus, EditorStatusEvent } from "./types";

function replay(events: EditorStatusEvent[]): EditorStatus {
  return events.reduce(nextEditorStatus, { kind: "loading" });
}

describe("nextEditorStatus while loading", () => {
  it("becomes clean once the source arrives", () => {
    // Arrange / Act
    const status = replay([{ type: "loaded" }]);

    // Assert
    expect(status).toEqual({ kind: "clean" });
  });

  it("keeps the failure message when the source cannot be read", () => {
    // Arrange / Act
    const status = replay([{ type: "loadFailed", message: "HTTP 404" }]);

    // Assert
    expect(status).toEqual({ kind: "loadFailed", message: "HTTP 404" });
  });
});

describe("nextEditorStatus while editing", () => {
  it("turns dirty on the first edit", () => {
    // Arrange / Act
    const status = replay([{ type: "loaded" }, { type: "edited" }]);

    // Assert
    expect(status).toEqual({ kind: "dirty" });
  });

  it("turns dirty again when a saved buffer is edited", () => {
    // Arrange
    const saved = replay([
      { type: "loaded" },
      { type: "edited" },
      { type: "saveStarted" },
      { type: "saveSucceeded" },
    ]);

    // Act
    const status = nextEditorStatus(saved, { type: "edited" });

    // Assert
    expect(saved).toEqual({ kind: "saved" });
    expect(status).toEqual({ kind: "dirty" });
  });

  it("turns dirty when a buffer whose save failed is edited", () => {
    // Arrange
    const failed: EditorStatus = { kind: "saveFailed", message: "HTTP 413" };

    // Act
    const status = nextEditorStatus(failed, { type: "edited" });

    // Assert
    expect(status).toEqual({ kind: "dirty" });
  });
});

describe("nextEditorStatus while saving", () => {
  it("is saved when nothing was typed during the save", () => {
    // Arrange / Act
    const status = replay([
      { type: "loaded" },
      { type: "edited" },
      { type: "saveStarted" },
      { type: "saveSucceeded" },
    ]);

    // Assert
    expect(status).toEqual({ kind: "saved" });
  });

  it("stays dirty when the buffer changed while the save was in flight", () => {
    // Arrange / Act
    const status = replay([
      { type: "loaded" },
      { type: "edited" },
      { type: "saveStarted" },
      { type: "edited" },
      { type: "saveSucceeded" },
    ]);

    // Assert
    expect(status).toEqual({ kind: "dirty" });
  });

  it("reports the save failure message", () => {
    // Arrange / Act
    const status = replay([
      { type: "loaded" },
      { type: "saveStarted" },
      { type: "saveFailed", message: "HTTP 403" },
    ]);

    // Assert
    expect(status).toEqual({ kind: "saveFailed", message: "HTTP 403" });
  });
});

describe("hasUnsavedChanges", () => {
  it.each<[EditorStatus, boolean]>([
    [{ kind: "loading" }, false],
    [{ kind: "loadFailed", message: "HTTP 404" }, false],
    [{ kind: "clean" }, false],
    [{ kind: "dirty" }, true],
    [{ kind: "saving", editedDuringSave: false }, true],
    [{ kind: "saved" }, false],
    [{ kind: "saveFailed", message: "HTTP 403" }, true],
  ])("reads %o as unsaved: %s", (status, expected) => {
    // Arrange / Act
    const unsaved = hasUnsavedChanges(status);

    // Assert
    expect(unsaved).toBe(expected);
  });
});
