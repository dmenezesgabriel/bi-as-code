import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { EditPageLink } from "./edit-page-link";
import { renderWithRouter } from "./router-harness";

const paths = ["/", "/nested/page"];

describe("EditPageLink on a page", () => {
  it("links to the page's own URL with the edit flag", async () => {
    // Arrange / Act
    await renderWithRouter(<EditPageLink />, paths, "/nested/page");

    // Assert
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/nested/page?edit=true",
    );
  });

  it("keeps the page's filter params in the edit URL", async () => {
    // Arrange / Act
    await renderWithRouter(<EditPageLink />, paths, "/?region=West");

    // Assert
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/?region=West&edit=true",
    );
  });

  it("offers Done while editing, dropping only the edit flag", async () => {
    // Arrange
    const router = await renderWithRouter(
      <EditPageLink />,
      paths,
      "/?region=West&edit=true",
    );

    // Act
    fireEvent.click(screen.getByRole("link", { name: "Done" }));

    // Assert
    await waitFor(() =>
      expect(router.state.location.searchStr).toBe("?region=West"),
    );
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
  });
});

describe("EditPageLink off a page", () => {
  it("renders nothing on the not-found page", async () => {
    // Arrange / Act
    await renderWithRouter(<EditPageLink />, paths, "/missing");

    // Assert
    expect(screen.queryByRole("link")).toBeNull();
  });
});
