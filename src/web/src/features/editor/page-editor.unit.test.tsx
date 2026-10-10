import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ThemeModeProvider } from "../chrome/theme-mode";
import { mountedView, pressModS } from "./editor-test-view";
import {
  FakePageSourcePort,
  type FakePageSourceScript,
} from "./fake-page-source-port";
import { PageEditor } from "./page-editor";

const FILE = "pages/weekly-review.md";
const SOURCE_LABEL = "Page source";

function editorFor(port: FakePageSourcePort, preview = "Rendered page") {
  return (
    <ThemeModeProvider mode="light">
      <PageEditor file={FILE} port={port}>
        <p>{preview}</p>
      </PageEditor>
    </ThemeModeProvider>
  );
}

async function renderLoaded(script: FakePageSourceScript = {}) {
  const port = new FakePageSourcePort({ source: "# Weekly\n", ...script });
  const view = render(editorFor(port));
  await screen.findByRole("textbox", { name: SOURCE_LABEL });
  return { port, ...view };
}

function typeAtStart(text: string): void {
  act(() => {
    mountedView(SOURCE_LABEL).dispatch({ changes: { from: 0, insert: text } });
  });
}

describe("PageEditor loading", () => {
  it("reports loading until the source arrives", () => {
    // Arrange / Act
    render(editorFor(new FakePageSourcePort({ hangRead: true })));

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("Loading source…");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("puts the page's source in the editor, next to the live preview", async () => {
    // Arrange / Act
    await renderLoaded();

    // Assert
    expect(mountedView(SOURCE_LABEL).state.doc.toString()).toBe("# Weekly\n");
    expect(screen.getByRole("status")).toHaveTextContent("No unsaved changes");
    expect(
      screen.getByRole("region", { name: "Live preview" }),
    ).toHaveTextContent("Rendered page");
    expect(screen.getByText(FILE)).toBeInTheDocument();
  });

  it("shows the read failure instead of an editor", async () => {
    // Arrange / Act
    render(editorFor(new FakePageSourcePort({ readError: "HTTP 404" })));

    // Assert
    expect(await screen.findByRole("status")).toHaveTextContent("HTTP 404");
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("PageEditor saving", () => {
  it("marks the buffer dirty on an edit", async () => {
    // Arrange
    await renderLoaded();

    // Act
    typeAtStart("x");

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
  });

  it("writes the whole buffer to the page's file on Mod-s", async () => {
    // Arrange
    const { port } = await renderLoaded();
    typeAtStart("x");

    // Act
    await act(async () => pressModS(mountedView(SOURCE_LABEL)));

    // Assert
    expect(port.saves).toEqual([{ file: FILE, source: "x# Weekly\n" }]);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("reports saving while the write is in flight", async () => {
    // Arrange
    await renderLoaded({ hangSave: true });

    // Act
    await act(async () => pressModS(mountedView(SOURCE_LABEL)));

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
  });

  it("shows the save failure and keeps the buffer", async () => {
    // Arrange
    await renderLoaded({ saveError: "HTTP 413" });
    typeAtStart("x");

    // Act
    await act(async () => pressModS(mountedView(SOURCE_LABEL)));

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("HTTP 413");
    expect(mountedView(SOURCE_LABEL).state.doc.toString()).toBe("x# Weekly\n");
  });
});

describe("PageEditor live preview", () => {
  it("re-renders a new preview without rebuilding the editor", async () => {
    // Arrange
    const { port, rerender } = await renderLoaded();
    const viewBefore = mountedView(SOURCE_LABEL);
    typeAtStart("x");

    // Act
    rerender(editorFor(port, "Re-rendered page"));

    // Assert
    expect(
      screen.getByRole("region", { name: "Live preview" }),
    ).toHaveTextContent("Re-rendered page");
    expect(mountedView(SOURCE_LABEL)).toBe(viewBefore);
    expect(viewBefore.state.doc.toString()).toBe("x# Weekly\n");
  });
});
