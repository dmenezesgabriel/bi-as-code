import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "../../chrome/match-media.stub";
import { Details } from "./details";
import type { DetailsProps } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
});

// `title` is required in DetailsProps, so the missing-title paths cast
// through Partial — mirroring the untyped MDX call site they exercise.
function renderDetails(props: Partial<DetailsProps> = {}) {
  const merged = {
    title: "Metric definitions",
    children: "body copy",
    ...props,
  };
  return render(<Details {...(merged as DetailsProps)} />);
}

const trigger = () =>
  screen.getByRole("button", { name: "Metric definitions" });

describe("Details", () => {
  it("renders the title on a disclosure button, collapsed by default", () => {
    renderDetails();

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("body copy")).toBeNull();
  });

  it("starts expanded when open is set", () => {
    renderDetails({ open: true });

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body copy")).toBeInTheDocument();
  });

  it("toggles the panel on trigger click", () => {
    renderDetails();
    const button = trigger();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("data-panel-open");
    expect(screen.getByText("body copy")).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("wires the chevron to rotate when the panel opens", () => {
    renderDetails();

    // The class string is static; `data-panel-open` on the trigger (asserted
    // in the toggle test) is what activates the `group-data-*` variant.
    const chevron = trigger().querySelector("svg");
    expect(chevron?.getAttribute("class")).toContain("-rotate-90");
    expect(chevron?.getAttribute("class")).toContain(
      "group-data-panel-open:rotate-0",
    );
  });

  it("renders an inline alert when title is missing", () => {
    renderDetails({ title: undefined });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Details");
    expect(alert).toHaveTextContent("title");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders an inline alert when title is empty", () => {
    renderDetails({ title: "" });

    expect(screen.getByRole("alert")).toHaveTextContent("Details");
  });

  it("resolves openMobile on a mobile viewport at mount", () => {
    stubMatchMedia(true);
    renderDetails({ openMobile: true });

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("lets openMobile override open on a mobile viewport", () => {
    stubMatchMedia(true);
    renderDetails({ open: true, openMobile: false });

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("falls back to open on mobile when openMobile is unset", () => {
    stubMatchMedia(true);
    renderDetails({ open: true });

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("ignores openMobile on a desktop viewport", () => {
    stubMatchMedia(false);
    renderDetails({ openMobile: true });

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("does not re-resolve openMobile when the breakpoint crosses after mount", () => {
    const mql = stubMatchMedia(false);
    renderDetails({ openMobile: true });

    act(() => mql.setMatches(true));

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });
});
