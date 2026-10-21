import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { FakeFrameWindow, topLevelWindow } from "./frame-window.stub";
import {
  isFramed,
  parentOrigin,
  useFrameHeightReporter,
  useFramed,
} from "./frame-height";
import { stubResizeObserver } from "./resize-observer.stub";
import type { FrameWindow } from "./types";

const INTRANET = "https://intranet.example.com";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A content element whose laid-out height a test sets — jsdom lays nothing out. */
function contentOfHeight(height: number): {
  element: HTMLDivElement;
  setHeight(next: number): void;
} {
  const element = document.createElement("div");
  let current = height;
  Object.defineProperty(element, "scrollHeight", { get: () => current });
  return { element, setHeight: (next) => (current = next) };
}

function renderReporter(frame: FrameWindow, element: HTMLElement) {
  return renderHook(() =>
    useFrameHeightReporter({ current: element }, [INTRANET], frame),
  );
}

describe("isFramed", () => {
  it("is true when the window's parent is another window", () => {
    expect(isFramed(new FakeFrameWindow({}))).toBe(true);
  });

  it("is false for a top-level window", () => {
    expect(isFramed(topLevelWindow())).toBe(false);
  });
});

describe("useFramed", () => {
  it("reads whether the given window is framed", () => {
    const { result } = renderHook(() => useFramed(new FakeFrameWindow({})));

    expect(result.current).toBe(true);
  });

  it("reads the page's own window by default — a test runs top-level", () => {
    const { result } = renderHook(() => useFramed());

    expect(result.current).toBe(false);
  });
});

describe("parentOrigin", () => {
  it("reads the parent's origin from ancestorOrigins", () => {
    const frame = new FakeFrameWindow({
      ancestorOrigins: [INTRANET, "https://top.example.com"],
      referrer: "https://other.example.com/page",
    });

    expect(parentOrigin(frame)).toBe(INTRANET);
  });

  it("falls back to the referrer's origin without ancestorOrigins", () => {
    const frame = new FakeFrameWindow({ referrer: `${INTRANET}/reports/q3` });

    expect(parentOrigin(frame)).toBe(INTRANET);
  });

  it("is null when neither names the parent", () => {
    expect(parentOrigin(new FakeFrameWindow({}))).toBeNull();
  });

  it("is null for a top-level window", () => {
    expect(parentOrigin(topLevelWindow())).toBeNull();
  });
});

describe("useFrameHeightReporter", () => {
  it("posts the content height to a listed parent, addressed to its origin", () => {
    const observer = stubResizeObserver();
    const frame = new FakeFrameWindow({ ancestorOrigins: [INTRANET] });
    const content = contentOfHeight(640);
    renderReporter(frame, content.element);

    act(() => observer.fire());

    expect(frame.parent.posted).toEqual([
      { message: { type: "biac:height", height: 640 }, targetOrigin: INTRANET },
    ]);
  });

  it("posts again only when the height changes", () => {
    const observer = stubResizeObserver();
    const frame = new FakeFrameWindow({ ancestorOrigins: [INTRANET] });
    const content = contentOfHeight(640);
    renderReporter(frame, content.element);

    act(() => observer.fire());
    act(() => observer.fire());
    content.setHeight(480);
    act(() => observer.fire());

    expect(frame.parent.posted.map((post) => post.message.height)).toEqual([
      640, 480,
    ]);
  });

  it("observes nothing when the parent's origin is not listed", () => {
    const observer = stubResizeObserver();
    const frame = new FakeFrameWindow({
      ancestorOrigins: ["https://elsewhere.example.com"],
    });
    renderReporter(frame, contentOfHeight(640).element);

    act(() => observer.fire());

    expect(observer.liveCount()).toBe(0);
    expect(frame.parent.posted).toEqual([]);
  });

  it("observes nothing when the browser masks the parent's origin", () => {
    const observer = stubResizeObserver();
    // Firefox reports "null" under the iframe's referrerpolicy="no-referrer".
    const frame = new FakeFrameWindow({ ancestorOrigins: ["null"] });
    renderReporter(frame, contentOfHeight(640).element);

    expect(observer.liveCount()).toBe(0);
  });

  it("observes nothing in a top-level window", () => {
    const observer = stubResizeObserver();
    renderReporter(topLevelWindow(), contentOfHeight(640).element);

    expect(observer.liveCount()).toBe(0);
  });

  it("stops observing on unmount", () => {
    const observer = stubResizeObserver();
    const frame = new FakeFrameWindow({ ancestorOrigins: [INTRANET] });
    const { unmount } = renderReporter(frame, contentOfHeight(640).element);

    unmount();

    expect(observer.liveCount()).toBe(0);
  });
});
