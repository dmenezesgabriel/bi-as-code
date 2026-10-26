import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { withMemoryRouter } from "../../../.storybook/decorators";
import { EditPageLink } from "./edit-page-link";

const PATHS = ["/", "/weekly-review"];

const meta: Meta<typeof EditPageLink> = {
  title: "Chrome/EditPageLink",
  component: EditPageLink,
};

export default meta;

type Story = StoryObj<typeof EditPageLink>;

/** On a page: `Edit` points at the same URL plus the edit flag. */
export const OnPage: Story = {
  decorators: [withMemoryRouter(PATHS, "/weekly-review/?region=West")],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/weekly-review/?region=West&edit=true",
    );
  },
};

/** While editing: `Done` drops only the flag, and the link flips back. */
export const Editing: Story = {
  decorators: [
    withMemoryRouter(PATHS, "/weekly-review/?region=West&edit=true"),
  ],
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("link", { name: "Done" }));
    await waitFor(() =>
      expect(canvas.getByRole("link", { name: "Edit" })).toHaveAttribute(
        "href",
        "/weekly-review/?region=West&edit=true",
      ),
    );
  },
};

/** Off a page (the not-found route) there is nothing to edit. */
export const OffPage: Story = {
  decorators: [withMemoryRouter(PATHS, "/missing")],
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("link")).toBeNull();
  },
};
