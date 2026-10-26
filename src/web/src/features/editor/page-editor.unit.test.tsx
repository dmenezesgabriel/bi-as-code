import { describe, expect, it } from "vitest";
import { useEffect, useState } from "react";
import { act, screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../chrome/router-harness";
import { ThemeModeProvider } from "../chrome/theme-mode";
import { mountedView, pressModS } from "./editor-test-view";
import {
  FakePageSourcePort,
  type FakePageSourceScript,
} from "./fake-page-source-port";
import { FakeLeaveConfirm } from "./fake-leave-confirm";
import { PageEditor } from "./page-editor";

const FILE = "pages/weekly-review.md";
const SOURCE_LABEL = "Page source";

/** Swaps the preview's text from the test, as a hot update swaps the page. */
type PreviewSwap = { show: (text: string) => void };

type EditorHarness = {
  swap: PreviewSwap;
  router: Awaited<ReturnType<typeof renderWithRouter>>;
};

/** Mounts the editor on its page's `?edit` URL, as the app routes it. */
async function renderEditor(
  port: FakePageSourcePort,
  leave = new FakeLeaveConfirm(true),
): Promise<EditorHarness> {
  const swap: PreviewSwap = { show: () => {} };
  function Host() {
    const [preview, setPreview] = useState("Rendered page");
    useEffect(() => {
      swap.show = setPreview;
    }, []);
    return (
      <ThemeModeProvider mode="light">
        <PageEditor file={FILE} port={port} confirmLeave={leave.confirm}>
          <p>{preview}</p>
        </PageEditor>
      </ThemeModeProvider>
    );
  }
  const router = await renderWithRouter(
    <Host />,
    ["/weekly-review", "/orders"],
    "/weekly-review?edit",
  );
  return { swap, router };
}

async function renderLoaded(
  script: FakePageSourceScript = {},
  leave?: FakeLeaveConfirm,
) {
  const port = new FakePageSourcePort({ source: "# Weekly\n", ...script });
  const harness = await renderEditor(port, leave);
  await screen.findByRole("textbox", { name: SOURCE_LABEL });
  return { port, ...harness };
}

function typeAtStart(text: string): void {
  act(() => {
    mountedView(SOURCE_LABEL).dispatch({ changes: { from: 0, insert: text } });
  });
}

describe("PageEditor loading", () => {
  it("reports loading until the source arrives", async () => {
    // Arrange / Act
    await renderEditor(new FakePageSourcePort({ hangRead: true }));

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
    await renderEditor(new FakePageSourcePort({ readError: "HTTP 404" }));

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
    const { swap } = await renderLoaded();
    const viewBefore = mountedView(SOURCE_LABEL);
    typeAtStart("x");

    // Act
    act(() => swap.show("Re-rendered page"));

    // Assert
    expect(
      screen.getByRole("region", { name: "Live preview" }),
    ).toHaveTextContent("Re-rendered page");
    expect(mountedView(SOURCE_LABEL)).toBe(viewBefore);
    expect(viewBefore.state.doc.toString()).toBe("x# Weekly\n");
  });
});

describe("PageEditor leaving", () => {
  it("asks before navigating away from an unsaved edit, and stays", async () => {
    // Arrange
    const leave = new FakeLeaveConfirm(false);
    const { router } = await renderLoaded({}, leave);
    typeAtStart("x");

    // Act — a blocked navigation never settles, so it is not awaited
    void router.navigate({ to: "/orders" });

    // Assert
    await waitFor(() => expect(leave.asked).toHaveLength(1));
    expect(router.state.location.pathname).toBe("/weekly-review/");
    expect(mountedView(SOURCE_LABEL).state.doc.toString()).toBe("x# Weekly\n");
  });
});
