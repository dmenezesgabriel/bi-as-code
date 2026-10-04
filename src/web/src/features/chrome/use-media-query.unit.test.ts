import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { stubMatchMedia } from "./match-media.stub";
import { useMediaQuery } from "./use-media-query";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("returns whether the query currently matches", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 1023px)"));

    expect(result.current).toBe(true);
  });

  it("updates when the media query's match state changes", () => {
    const mql = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 1023px)"));

    act(() => mql.setMatches(true));

    expect(result.current).toBe(true);
  });

  it("unsubscribes its change listener on unmount", () => {
    const mql = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 1023px)"));

    unmount();

    expect(mql.listenerCount()).toBe(0);
  });
});
