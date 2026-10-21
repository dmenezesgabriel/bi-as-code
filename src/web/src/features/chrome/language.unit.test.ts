import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyDocumentLanguage,
  languageDisplayName,
  readStoredLanguage,
  resolveLanguage,
  writeStoredLanguage,
} from "./language";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "en";
});

describe("resolveLanguage", () => {
  const declared = ["en", "fr"];

  it("prefers the URL's language over a stored one", () => {
    expect(resolveLanguage(declared, "fr", "en")).toBe("fr");
  });

  it("falls back to the stored language when the URL names none", () => {
    expect(resolveLanguage(declared, undefined, "fr")).toBe("fr");
  });

  it("falls back to the first declared language when neither is declared", () => {
    expect(resolveLanguage(declared, "de", "es")).toBe("en");
  });

  it("ignores a URL value that is not a string", () => {
    expect(resolveLanguage(declared, 42, "fr")).toBe("fr");
  });

  it("ignores names inherited from Object.prototype", () => {
    expect(resolveLanguage(declared, "constructor", null)).toBe("en");
  });

  it("is undefined when no language is declared", () => {
    expect(resolveLanguage([], "fr", "fr")).toBeUndefined();
  });
});

describe("stored language", () => {
  it("reads null when nothing is stored", () => {
    expect(readStoredLanguage()).toBeNull();
  });

  it("round-trips a choice", () => {
    writeStoredLanguage("fr");

    expect(readStoredLanguage()).toBe("fr");
  });

  it("reads null when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("denied");
    });

    expect(readStoredLanguage()).toBeNull();
  });

  it("swallows a write that storage refuses", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("quota");
    });

    expect(() => writeStoredLanguage("fr")).not.toThrow();
  });
});

describe("applyDocumentLanguage", () => {
  it("sets the document's language", () => {
    applyDocumentLanguage("fr");

    expect(document.documentElement.lang).toBe("fr");
  });
});

describe("languageDisplayName", () => {
  it("names a language in itself, capitalised", () => {
    expect(languageDisplayName("fr")).toBe("Français");
    expect(languageDisplayName("en")).toBe("English");
  });

  it("falls back to the upper-cased code when the runtime has no name", () => {
    expect(languageDisplayName("zz")).toBe("ZZ");
  });
});
