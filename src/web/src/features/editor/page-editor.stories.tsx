import type { Meta, StoryObj } from "@storybook/react-vite";
import { Link } from "@tanstack/react-router";
import { expect, userEvent, waitFor } from "storybook/test";
import {
  withMemoryRouter,
  withThemeMode,
} from "../../../.storybook/decorators";
import { FakeLeaveConfirm } from "./fake-leave-confirm";
import {
  FakePageSourcePort,
  type FakePageSourceScript,
} from "./fake-page-source-port";
import { PageEditor } from "./page-editor";

const FILE = "pages/weekly-review.md";
const SOURCE = [
  "# Weekly review",
  "",
  "```sql orders",
  "select region, sum(amount) as revenue from orders group by region",
  "limit 10",
  "```",
  "",
].join("\n");

/** CodeMirror reads `Mod` as Cmd on a Mac and Ctrl elsewhere. */
const SAVE_CHORD = /Mac/.test(navigator.platform)
  ? "{Meta>}s{/Meta}"
  : "{Control>}s{/Control}";

/** Stands in for the live page the preview pane hosts in the app. */
function RenderedPage() {
  return (
    <article className="px-6 py-10">
      <h1 className="text-2xl font-semibold">Weekly review</h1>
      <p className="mt-4">Revenue by region, from the orders fence.</p>
    </article>
  );
}

/** One fake per story, created once — so `saves` is the story's own log. */
function editorWith(script: FakePageSourceScript) {
  const port = new FakePageSourcePort({ source: SOURCE, ...script });
  return {
    port,
    render: () => (
      <PageEditor file={FILE} port={port}>
        <RenderedPage />
      </PageEditor>
    ),
  };
}

const meta: Meta<typeof PageEditor> = {
  title: "Editor/PageEditor",
  component: PageEditor,
  // The editor guards navigation through the router, as on its `?edit` URL.
  decorators: [
    withMemoryRouter(["/weekly-review", "/orders"], "/weekly-review?edit"),
  ],
};

export default meta;

type Story = StoryObj<typeof PageEditor>;

const clean = editorWith({});

/** Source loaded, nothing edited yet: both panes side by side. */
export const Clean: Story = {
  render: clean.render,
  play: async ({ canvas }) => {
    await canvas.findByRole("textbox", { name: "Page source" });
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "No unsaved changes",
    );
    await expect(
      canvas.getByRole("region", { name: "Live preview" }),
    ).toBeVisible();
    await expect(canvas.getByText(FILE)).toBeVisible();
  },
};

/** The source has not arrived yet: no editor, a loading status. */
export const Loading: Story = {
  render: editorWith({ hangRead: true }).render,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Loading source…",
    );
    await expect(canvas.queryByRole("textbox")).toBeNull();
  },
};

/** The dev server refused the read: the reason replaces the editor. */
export const LoadFailed: Story = {
  render: editorWith({
    readError: 'Reading "pages/weekly-review.md" failed: HTTP 404',
  }).render,
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("HTTP 404"),
    );
    await expect(canvas.queryByRole("textbox")).toBeNull();
  },
};

const saving = editorWith({});

/** Typing marks the buffer dirty; `Mod-s` writes it and reports Saved. */
export const SaveKeybinding: Story = {
  render: saving.render,
  play: async ({ canvas }) => {
    const textbox = await canvas.findByRole("textbox", { name: "Page source" });
    await userEvent.click(textbox);
    await userEvent.keyboard("{Control>}{Home}{/Control}{End} (draft)");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Unsaved changes",
    );
    await userEvent.keyboard(SAVE_CHORD);
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Saved"),
    );
    await expect(saving.port.saves.at(-1)?.source).toMatch(
      /^# Weekly review \(draft\)\n/,
    );
  },
};

const declined = new FakeLeaveConfirm(false);
const dirtyPort = new FakePageSourcePort({ source: SOURCE });

/** An unsaved edit: a link away asks first, and declining keeps the text. */
export const Dirty: Story = {
  render: () => (
    <>
      <Link to="/orders">Orders overview</Link>
      <PageEditor file={FILE} port={dirtyPort} confirmLeave={declined.confirm}>
        <RenderedPage />
      </PageEditor>
    </>
  ),
  play: async ({ canvas }) => {
    const textbox = await canvas.findByRole("textbox", { name: "Page source" });
    await userEvent.click(textbox);
    await userEvent.keyboard("{Control>}{Home}{/Control}{End} zz");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Unsaved changes",
    );
    await userEvent.click(
      canvas.getByRole("link", { name: "Orders overview" }),
    );
    await waitFor(() => expect(declined.asked).toHaveLength(1));
    await expect(textbox).toHaveTextContent("# Weekly review zz");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Unsaved changes",
    );
  },
};

const inFlight = editorWith({ hangSave: true });

/** A write still in flight. */
export const Saving: Story = {
  render: inFlight.render,
  play: async ({ canvas }) => {
    const textbox = await canvas.findByRole("textbox", { name: "Page source" });
    await userEvent.click(textbox);
    await userEvent.keyboard(SAVE_CHORD);
    await expect(canvas.getByRole("status")).toHaveTextContent("Saving…");
  },
};

const refused = editorWith({
  saveError: 'Saving "pages/weekly-review.md" failed: HTTP 413',
});

/** The dev server refused the write: the reason shows, the buffer stays. */
export const SaveFailed: Story = {
  render: refused.render,
  play: async ({ canvas }) => {
    const textbox = await canvas.findByRole("textbox", { name: "Page source" });
    await userEvent.click(textbox);
    await userEvent.keyboard(SAVE_CHORD);
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("HTTP 413"),
    );
    await expect(textbox).toHaveTextContent("# Weekly review");
  },
};

/** Dark app mode: the editor takes One Dark, the chrome its dark borders. */
export const Dark: Story = {
  render: editorWith({}).render,
  decorators: [withThemeMode("dark")],
  globals: { theme: "dark" },
  play: async ({ canvas }) => {
    await canvas.findByRole("textbox", { name: "Page source" });
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "No unsaved changes",
    );
  },
};
