import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { withMemoryRouter } from "../../../.storybook/decorators";
import { FakePageSourcePort } from "../editor/fake-page-source-port";
import { EditablePage } from "./editable-page";

const FILE = "pages/weekly-review.md";
const PATHS = ["/weekly-review"];

const meta: Meta<typeof EditablePage> = {
  title: "Pages/EditablePage",
  component: EditablePage,
  args: {
    file: FILE,
    pageSource: new FakePageSourcePort({ source: "# Weekly review\n" }),
    children: <h1 className="px-6 py-10 text-2xl">Weekly review</h1>,
  },
};

export default meta;

type Story = StoryObj<typeof EditablePage>;

/** Without `?edit` the page renders on its own. */
export const Plain: Story = {
  decorators: [withMemoryRouter(PATHS, "/weekly-review?region=West")],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Weekly review" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("region", { name: "Live preview" }),
    ).toBeNull();
  },
};

/** `?edit` opens the split pane: source loaded, the page as live preview. */
export const Editing: Story = {
  decorators: [withMemoryRouter(PATHS, "/weekly-review?region=West&edit=true")],
  play: async ({ canvas }) => {
    const source = await canvas.findByRole("textbox", { name: "Page source" });
    await expect(source).toHaveTextContent("# Weekly review");
    await expect(
      canvas.getByRole("region", { name: "Live preview" }),
    ).toContainElement(canvas.getByRole("heading", { name: "Weekly review" }));
  },
};

/** A production build passes no page-source access, so `?edit` is inert. */
export const EditFlagWithoutDevServer: Story = {
  args: { pageSource: undefined },
  decorators: [withMemoryRouter(PATHS, "/weekly-review?edit=true")],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Weekly review" }),
    ).toBeVisible();
    await expect(canvas.queryByRole("textbox")).toBeNull();
  },
};
