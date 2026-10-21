import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fixedLanguages, useDeclaredLanguages } from "./declared-languages";
import type { DeclaredLanguages } from "./types";

/** A store whose list a test replaces, as a saved translations.yaml does in dev. */
class FakeDeclaredLanguages implements DeclaredLanguages {
  private languages: readonly string[];
  private readonly listeners = new Set<() => void>();

  constructor(languages: readonly string[]) {
    this.languages = languages;
  }

  get = (): readonly string[] => this.languages;

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => void this.listeners.delete(onChange);
  };

  save(languages: readonly string[]): void {
    this.languages = languages;
    this.listeners.forEach((listener) => listener());
  }
}

function LanguagesProbe({ source }: { source: DeclaredLanguages }) {
  return <output>{useDeclaredLanguages(source).join(",")}</output>;
}

describe("useDeclaredLanguages", () => {
  it("reads a fixed list", () => {
    // Arrange / Act
    render(<LanguagesProbe source={fixedLanguages(["en", "fr"])} />);

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("en,fr");
  });

  it("re-renders when the store's list changes", () => {
    // Arrange
    const source = new FakeDeclaredLanguages(["en", "fr"]);
    render(<LanguagesProbe source={source} />);

    // Act
    act(() => source.save(["fr", "en"]));

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("fr,en");
  });
});
