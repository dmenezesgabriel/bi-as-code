import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import type { BiacConfig } from "virtual:biac-config";
import { stubMatchMedia } from "./match-media.stub";
import { useTheme } from "./use-theme";

/**
 * The hook has no DOM of its own — a probe renders the resolved mode and
 * exposes toggle() so assertions can read the applied `dark` class and the
 * persisted key alongside the returned value.
 */
function Probe({ configTheme }: { configTheme: BiacConfig["theme"] }) {
  const { mode, toggle } = useTheme(configTheme);
  return (
    <button type="button" data-testid="mode" data-mode={mode} onClick={toggle}>
      {mode}
    </button>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mode(): string | undefined {
  return screen.getByTestId("mode").dataset.mode;
}

describe("useTheme", () => {
  it("resolves and applies the config default when nothing is stored", () => {
    render(<Probe configTheme="dark" />);

    expect(mode()).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("prefers a stored choice over the config default", () => {
    window.localStorage.setItem("biac.theme", "light");

    render(<Probe configTheme="dark" />);

    expect(mode()).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("follows live prefers-color-scheme flips while unresolved", () => {
    const media = stubMatchMedia(true);
    render(<Probe configTheme="system" />);

    expect(mode()).toBe("dark");

    act(() => media.setMatches(false));

    expect(mode()).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("toggle flips the mode and persists the explicit choice", () => {
    render(<Probe configTheme="system" />);
    const probe = screen.getByTestId("mode");

    fireEvent.click(probe);

    expect(mode()).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("biac.theme")).toBe("dark");

    fireEvent.click(probe);

    expect(mode()).toBe("light");
    expect(window.localStorage.getItem("biac.theme")).toBe("light");
  });
});
