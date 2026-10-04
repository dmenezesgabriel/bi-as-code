import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from "./theme";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
});

describe("resolveTheme", () => {
  it("prefers a stored choice over both the config default and the system", () => {
    expect(resolveTheme("dark", "light", true)).toBe("light");
    expect(resolveTheme("light", "dark", false)).toBe("dark");
    expect(resolveTheme("system", "dark", false)).toBe("dark");
  });

  it("falls back to the config default when nothing is stored", () => {
    expect(resolveTheme("dark", null, false)).toBe("dark");
    expect(resolveTheme("light", null, true)).toBe("light");
  });

  it("defers to prefers-color-scheme when the config default is system", () => {
    expect(resolveTheme("system", null, true)).toBe("dark");
    expect(resolveTheme("system", null, false)).toBe("light");
  });
});

describe("stored theme", () => {
  it("reads null when nothing is stored", () => {
    expect(readStoredTheme()).toBeNull();
  });

  it("round-trips an explicit choice", () => {
    writeStoredTheme("dark");
    expect(readStoredTheme()).toBe("dark");

    writeStoredTheme("light");
    expect(readStoredTheme()).toBe("light");
  });

  it("reads null for a value we did not write", () => {
    window.localStorage.setItem("biac.theme", "purple");
    expect(readStoredTheme()).toBeNull();
  });

  it("reads null when storage itself throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(readStoredTheme()).toBeNull();

    vi.restoreAllMocks();
  });
});

describe("applyTheme", () => {
  it("sets the dark class and color-scheme on the document root", () => {
    applyTheme("dark");

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("clears the dark class for light mode", () => {
    applyTheme("dark");
    applyTheme("light");

    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});
