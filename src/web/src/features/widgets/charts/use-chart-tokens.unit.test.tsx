import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { ThemeMode } from "../../chrome/theme";
import { ThemeModeProvider } from "../../chrome/theme-mode";
import { DARK_CHART_TOKENS, LIGHT_CHART_TOKENS } from "./chart-tokens.fixture";
import { useChartTokens } from "./use-chart-tokens";

/** A `ThemeModeProvider` whose mode a test can flip between renders. */
class FakeThemeToggle {
  constructor(public mode: ThemeMode) {}

  Wrapper = ({ children }: { children: ReactNode }): ReactNode => (
    <ThemeModeProvider mode={this.mode}>{children}</ThemeModeProvider>
  );
}

function renderInMode(toggle: FakeThemeToggle) {
  return renderHook(() => useChartTokens(), { wrapper: toggle.Wrapper });
}

describe("useChartTokens", () => {
  it("reads the stylesheet's tokens for the resolved mode", () => {
    const { result } = renderInMode(new FakeThemeToggle("dark"));

    expect(result.current).toEqual(DARK_CHART_TOKENS);
  });

  it("re-reads the tokens when the mode flips", () => {
    const toggle = new FakeThemeToggle("dark");
    const { result, rerender } = renderInMode(toggle);

    toggle.mode = "light";
    rerender();

    expect(result.current).toEqual(LIGHT_CHART_TOKENS);
  });

  it("keeps one tokens object while the mode holds", () => {
    const { result, rerender } = renderInMode(new FakeThemeToggle("light"));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
