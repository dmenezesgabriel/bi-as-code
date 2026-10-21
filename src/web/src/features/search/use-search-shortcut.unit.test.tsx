import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useSearchShortcut } from "./use-search-shortcut";

function ShortcutHost({ reveal }: { reveal: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(inputRef, reveal);
  return (
    <>
      <input ref={inputRef} aria-label="box" defaultValue="weekly" />
      <textarea aria-label="editor" />
      <a href="/x">link</a>
    </>
  );
}

function renderHost(reveal = vi.fn()) {
  render(<ShortcutHost reveal={reveal} />);
  return { reveal, box: screen.getByLabelText<HTMLInputElement>("box") };
}

function selectedText(box: HTMLInputElement): string {
  return box.value.slice(box.selectionStart ?? 0, box.selectionEnd ?? 0);
}

describe("useSearchShortcut — keys that focus the box", () => {
  it.each([
    ["/", { key: "/" }],
    ["Ctrl-K", { key: "k", code: "KeyK", ctrlKey: true }],
    ["⌘K", { key: "k", code: "KeyK", metaKey: true }],
  ])("%s focuses the box with its text selected", (_name, init) => {
    const { box } = renderHost();

    const unhandled = fireEvent.keyDown(document.body, init);

    expect(unhandled).toBe(false);
    expect(document.activeElement).toBe(box);
    expect(selectedText(box)).toBe("weekly");
  });

  it("works from a focused link too", () => {
    const { box } = renderHost();
    const link = screen.getByRole("link");
    link.focus();

    fireEvent.keyDown(link, { key: "/" });

    expect(document.activeElement).toBe(box);
  });

  it("reveals the box before focusing it", () => {
    const reveal = vi.fn(() => {
      expect(document.activeElement).toBe(document.body);
    });
    renderHost(reveal);

    fireEvent.keyDown(document.body, { key: "/" });

    expect(reveal).toHaveBeenCalledOnce();
  });
});

describe("useSearchShortcut — keys it leaves alone", () => {
  it("lets / type into an editable field", () => {
    const { reveal } = renderHost();
    const editor = screen.getByLabelText("editor");
    editor.focus();

    const unhandled = fireEvent.keyDown(editor, { key: "/" });

    expect(unhandled).toBe(true);
    expect(document.activeElement).toBe(editor);
    expect(reveal).not.toHaveBeenCalled();
  });

  it.each([
    ["plain k", { key: "k", code: "KeyK" }],
    ["Ctrl-Alt-K", { key: "k", code: "KeyK", ctrlKey: true, altKey: true }],
    ["Ctrl-/", { key: "/", ctrlKey: true }],
  ])("ignores %s", (_name, init) => {
    const { reveal } = renderHost();

    fireEvent.keyDown(document.body, init);

    expect(reveal).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });
});
