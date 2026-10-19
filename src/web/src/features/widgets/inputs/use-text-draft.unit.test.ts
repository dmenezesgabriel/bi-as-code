import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { Filter } from "../../filters/filter";
import { Filters } from "../../filters/filters";
import { useTextDraft } from "./use-text-draft";

function textFilter(search = ""): Filter<string> {
  const filters = new Filters(new FakeFilterUrlPort(search));
  return filters.ensure<string>("q", { column: false });
}

describe("useTextDraft — draft", () => {
  it("starts from the filter's held value", () => {
    const filter = textFilter("?q=north");

    const { result } = renderHook(() => useTextDraft(filter));

    expect(result.current.draft).toBe("north");
  });

  it("starts empty with no filter", () => {
    const { result } = renderHook(() => useTextDraft(undefined));

    expect(result.current.draft).toBe("");
  });
});

describe("useTextDraft — commit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("commits the draft after the quiet window, not before", async () => {
    vi.useFakeTimers();
    const filter = textFilter();
    const { result } = renderHook(() => useTextDraft(filter));

    act(() => result.current.setDraft("north"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(filter.value).toBeUndefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(filter.value).toBe("north");
  });

  it("commits an empty text as undefined", () => {
    const filter = textFilter("?q=north");
    const { result } = renderHook(() => useTextDraft(filter));

    act(() => result.current.commit(""));

    expect(filter.value).toBeUndefined();
  });

  it("ignores a commit with no filter", () => {
    const { result } = renderHook(() => useTextDraft(undefined));

    expect(() => result.current.commit("north")).not.toThrow();
  });
});
