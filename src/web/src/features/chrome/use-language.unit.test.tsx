import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithRouter } from "./router-harness";
import { useLanguage } from "./use-language";

const paths = ["/"];
let choose: (language: string) => void = () => {};

function LanguageProbe({ languages }: { languages: readonly string[] }) {
  const current = useLanguage(languages);
  choose = current.choose;
  return <output>{current.language ?? "none"}</output>;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "en";
});

describe("useLanguage", () => {
  it("renders the URL's language and declares it on <html lang>", async () => {
    // Arrange / Act
    await renderWithRouter(
      <LanguageProbe languages={["en", "fr"]} />,
      paths,
      "/?lang=fr",
    );

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("fr");
    expect(document.documentElement.lang).toBe("fr");
  });

  it("falls back to the stored choice when the URL names none", async () => {
    // Arrange
    window.localStorage.setItem("biac.lang", "fr");

    // Act
    await renderWithRouter(
      <LanguageProbe languages={["en", "fr"]} />,
      paths,
      "/",
    );

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("fr");
  });

  it("stores a choice and writes it to the URL, keeping the filters", async () => {
    // Arrange
    const router = await renderWithRouter(
      <LanguageProbe languages={["en", "fr"]} />,
      paths,
      "/?region=West",
    );

    // Act
    await act(async () => choose("fr"));

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("fr");
    expect(router.state.location.search).toEqual({
      region: "West",
      lang: "fr",
    });
    expect(window.localStorage.getItem("biac.lang")).toBe("fr");
    expect(document.documentElement.lang).toBe("fr");
  });

  it("leaves <html lang> alone when no language is declared", async () => {
    // Arrange
    document.documentElement.lang = "en-GB";

    // Act
    await renderWithRouter(<LanguageProbe languages={[]} />, paths, "/");

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("none");
    expect(document.documentElement.lang).toBe("en-GB");
  });
});
