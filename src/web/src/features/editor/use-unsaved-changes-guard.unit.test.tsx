import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Link } from "@tanstack/react-router";
import { EditPageLink } from "../chrome/edit-page-link";
import { renderWithRouter } from "../chrome/router-harness";
import { FakeLeaveConfirm } from "./fake-leave-confirm";
import type { EditorStatus } from "./types";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";

const PATHS = ["/weekly-review", "/orders"];
const EDITING = "/weekly-review?region=West&edit=true";
const DIRTY: EditorStatus = { kind: "dirty" };

/** The editor's guard next to the links that leave it, or stay in it. */
function GuardProbe(props: { status: EditorStatus; leave: FakeLeaveConfirm }) {
  useUnsavedChangesGuard(props.status, props.leave.confirm);
  return (
    <>
      <Link to="/orders">Orders overview</Link>
      <Link to="." search={{ region: "East", edit: true }}>
        East in the editor
      </Link>
      <EditPageLink />
    </>
  );
}

async function renderGuard(status: EditorStatus, leave: FakeLeaveConfirm) {
  return renderWithRouter(
    <GuardProbe status={status} leave={leave} />,
    PATHS,
    EDITING,
  );
}

/** Clicks the sidebar stand-in and waits until the router reaches it. */
async function followOrdersLink(
  router: Awaited<ReturnType<typeof renderGuard>>,
) {
  fireEvent.click(screen.getByRole("link", { name: "Orders overview" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/orders"));
}

describe("useUnsavedChangesGuard with unsaved changes", () => {
  it("asks before a sidebar link leaves, and stays when declined", async () => {
    // Arrange
    const leave = new FakeLeaveConfirm(false);
    const router = await renderGuard(DIRTY, leave);

    // Act
    fireEvent.click(screen.getByRole("link", { name: "Orders overview" }));

    // Assert
    await waitFor(() => expect(leave.asked).toHaveLength(1));
    expect(leave.asked[0]).toMatch(/unsaved changes/i);
    expect(router.state.location.href).toBe(EDITING);
  });

  it("leaves when the author confirms", async () => {
    // Arrange
    const leave = new FakeLeaveConfirm(true);
    const router = await renderGuard(DIRTY, leave);

    // Act
    await followOrdersLink(router);

    // Assert
    expect(leave.asked).toHaveLength(1);
  });

  it("asks before Done drops the edit flag on the same page", async () => {
    // Arrange
    const leave = new FakeLeaveConfirm(false);
    const router = await renderGuard(DIRTY, leave);

    // Act
    fireEvent.click(screen.getByRole("link", { name: "Done" }));

    // Assert
    await waitFor(() => expect(leave.asked).toHaveLength(1));
    expect(router.state.location.href).toBe(EDITING);
  });

  it("lets a search change that stays in the editor through unasked", async () => {
    // Arrange
    const leave = new FakeLeaveConfirm(false);
    const router = await renderGuard(DIRTY, leave);

    // Act
    fireEvent.click(screen.getByRole("link", { name: "East in the editor" }));

    // Assert
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        region: "East",
        edit: true,
      }),
    );
    expect(leave.asked).toEqual([]);
  });
});

describe("useUnsavedChangesGuard with nothing unsaved", () => {
  it("never asks when the buffer matches the file on disk", async () => {
    // Arrange
    const leave = new FakeLeaveConfirm(false);
    const router = await renderGuard({ kind: "clean" }, leave);

    // Act
    await followOrdersLink(router);

    // Assert
    expect(leave.asked).toEqual([]);
  });
});
