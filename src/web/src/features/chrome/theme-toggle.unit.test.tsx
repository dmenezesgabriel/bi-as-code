import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("names itself after the mode a click switches to", () => {
    render(<ThemeToggle mode="light" onToggle={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeInTheDocument();
  });

  it("invokes onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<ThemeToggle mode="dark" onToggle={onToggle} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows the sun icon in dark mode and the moon icon in light mode", () => {
    const { rerender } = render(<ThemeToggle mode="dark" onToggle={vi.fn()} />);

    const button = screen.getByRole("button");
    expect(button.querySelector("svg.lucide-sun")).not.toBeNull();
    expect(button.querySelector("svg.lucide-moon")).toBeNull();

    rerender(<ThemeToggle mode="light" onToggle={vi.fn()} />);

    expect(button.querySelector("svg.lucide-moon")).not.toBeNull();
    expect(button.querySelector("svg.lucide-sun")).toBeNull();
  });

  it("marks the decorative icon aria-hidden", () => {
    render(<ThemeToggle mode="light" onToggle={vi.fn()} />);

    expect(screen.getByRole("button").querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
