import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageMenu } from "./language-menu";

const openMenu = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Language" }));
  return screen.findByRole("menu");
};

describe("LanguageMenu", () => {
  it("lists each language by its own name, the current one checked", async () => {
    // Arrange
    render(
      <LanguageMenu
        languages={["en", "fr"]}
        language="en"
        onChoose={() => {}}
      />,
    );

    // Act
    await openMenu();

    // Assert
    const english = screen.getByRole("menuitemradio", { name: "English" });
    const french = screen.getByRole("menuitemradio", { name: "Français" });
    expect(english).toHaveAttribute("aria-checked", "true");
    expect(french).toHaveAttribute("aria-checked", "false");
    expect(french).toHaveAttribute("lang", "fr");
  });

  it("reports the picked language", async () => {
    // Arrange
    const onChoose = vi.fn();
    render(
      <LanguageMenu
        languages={["en", "fr"]}
        language="en"
        onChoose={onChoose}
      />,
    );
    await openMenu();

    // Act
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Français" }));

    // Assert
    expect(onChoose).toHaveBeenCalledWith("fr");
  });

  it.each([[[]], [["en"]]])(
    "renders nothing with fewer than two languages (%j)",
    (languages) => {
      // Arrange / Act
      const { container } = render(
        <LanguageMenu
          languages={languages}
          language={languages[0]}
          onChoose={() => {}}
        />,
      );

      // Assert
      expect(container).toBeEmptyDOMElement();
    },
  );
});
